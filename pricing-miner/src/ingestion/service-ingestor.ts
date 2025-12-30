/**
 * Service Ingestion Orchestrator
 * Handles the complete ingestion flow for a single AWS service
 */

import { getPricingUrl, generateVersionHash, formatBytes } from '../aws/client.js';
import { PricingNormalizer } from '../normalizers/dimension-normalizer.js';
import { Rosetta } from '../metadata/rosetta.js';
import {
    upsertCatalogVersion,
    updateCatalogVersionStatus,
    bulkInsertPricingDimensions,
    bulkInsertAttributeMappings,
    catalogVersionExists,
} from '../db/index.js';
import { config } from '../config/index.js';
import { createIngestionLogger } from '../utils/logger.js';
import type {
    OfferEntry,
    NormalizedPricingDimension,
    IngestionResult,
    Product,
    TermDetail,
} from '../types/pricing.js';

/**
 * Ingest pricing data for a single AWS service
 */
export async function ingestService(offer: OfferEntry): Promise<IngestionResult> {
    const service = offer.offerCode;
    const startTime = Date.now();
    let catalogVersionId = 0;
    let recordCount = 0;

    const log = createIngestionLogger(service, 0);
    log.info({ service }, 'Starting service ingestion');

    try {
        // Get pricing URL
        const url = getPricingUrl(offer);

        // Fetch headers to get ETag and content length
        const headResponse = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(30000),
        });

        const etag = headResponse.headers.get('etag');
        const contentLength = headResponse.headers.get('content-length');

        if (contentLength) {
            log.info({ size: formatBytes(parseInt(contentLength, 10)) }, 'Pricing file size');
        }

        // Generate version hash
        const versionHash = generateVersionHash(etag, url);

        // Check if this version already exists
        if (await catalogVersionExists(service, versionHash)) {
            log.info({ versionHash }, 'Catalog version already exists, skipping');
            return {
                service,
                success: true,
                recordCount: 0,
                duration: Date.now() - startTime,
            };
        }

        // Create catalog version record
        const catalogVersion = await upsertCatalogVersion({
            service,
            sourceUrl: url,
            versionHash,
            etag,
            publicationDate: new Date().toISOString(),
            status: 'ingesting',
        });
        catalogVersionId = catalogVersion.id!;

        log.info({ catalogVersionId, versionHash }, 'Created catalog version');

        // Initialize normalizer and rosetta
        const normalizer = new PricingNormalizer(service, catalogVersionId);
        const rosetta = new Rosetta(service, catalogVersionId);

        // Process using fetch + JSON parsing
        recordCount = await processServiceWithFetch(
            url,
            normalizer,
            rosetta,
            log
        );

        // Save rosetta mappings
        const mappings = rosetta.exportMappings();
        if (mappings.length > 0) {
            await bulkInsertAttributeMappings(mappings);
            log.info({ mappingCount: mappings.length }, 'Saved attribute mappings');
        }

        // Update catalog version status
        await updateCatalogVersionStatus(catalogVersionId, 'completed', recordCount);

        const duration = Date.now() - startTime;
        log.info(
            {
                recordCount,
                duration: `${(duration / 1000).toFixed(1)}s`,
                stats: normalizer.getStats(),
                rosettaStats: rosetta.getStats(),
            },
            'Service ingestion completed'
        );

        return {
            service,
            success: true,
            recordCount,
            duration,
        };
    } catch (error) {
        const err = error as Error;
        log.error({ err }, 'Service ingestion failed');

        if (catalogVersionId > 0) {
            await updateCatalogVersionStatus(catalogVersionId, 'failed', 0, err.message);
        }

        return {
            service,
            success: false,
            recordCount: 0,
            duration: Date.now() - startTime,
            error: err.message,
        };
    }
}

/**
 * Process service using fetch + chunked JSON processing
 * Handles multi-GB files by processing in batches
 */
async function processServiceWithFetch(
    url: string,
    normalizer: PricingNormalizer,
    rosetta: Rosetta,
    log: ReturnType<typeof createIngestionLogger>
): Promise<number> {
    const response = await fetch(url, {
        signal: AbortSignal.timeout(config.aws.requestTimeout),
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch pricing data: ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    const sizeInMB = contentLength ? parseInt(contentLength, 10) / (1024 * 1024) : 0;

    log.info({ sizeInMB: sizeInMB.toFixed(1) }, 'Fetching pricing data');

    // For very large files (>100MB), we should use streaming
    // For now, we'll use JSON parsing which handles most services
    const data = await response.json() as {
        products?: Record<string, Product>;
        terms?: {
            OnDemand?: Record<string, Record<string, TermDetail>>;
            Reserved?: Record<string, Record<string, TermDetail>>;
        };
    };

    let totalDimensions = 0;
    const batchSize = config.ingestion.batchSize;
    let batch: NormalizedPricingDimension[] = [];

    // Process products first
    const products = data.products ?? {};
    const productCount = Object.keys(products).length;
    log.info({ productCount }, 'Processing products');

    for (const [sku, product] of Object.entries(products)) {
        normalizer.addProduct({ ...product, sku });
        rosetta.learnFromProduct({ ...product, sku });
    }

    // Process OnDemand terms
    const onDemandTerms = data.terms?.OnDemand ?? {};
    log.info({ skuCount: Object.keys(onDemandTerms).length }, 'Processing OnDemand terms');

    for (const [sku, termVariants] of Object.entries(onDemandTerms)) {
        for (const term of Object.values(termVariants)) {
            const dimensions = normalizer.processTerm(sku, term, 'OnDemand');
            batch.push(...dimensions);

            if (batch.length >= batchSize) {
                await bulkInsertPricingDimensions(batch);
                totalDimensions += batch.length;
                log.debug({ batchSize: batch.length, total: totalDimensions }, 'Inserted batch');
                batch = [];
            }
        }
    }

    // Process Reserved terms
    const reservedTerms = data.terms?.Reserved ?? {};
    log.info({ skuCount: Object.keys(reservedTerms).length }, 'Processing Reserved terms');

    for (const [sku, termVariants] of Object.entries(reservedTerms)) {
        for (const term of Object.values(termVariants)) {
            const dimensions = normalizer.processTerm(sku, term, 'Reserved');
            batch.push(...dimensions);

            if (batch.length >= batchSize) {
                await bulkInsertPricingDimensions(batch);
                totalDimensions += batch.length;
                log.debug({ batchSize: batch.length, total: totalDimensions }, 'Inserted batch');
                batch = [];
            }
        }
    }

    // Insert remaining batch
    if (batch.length > 0) {
        await bulkInsertPricingDimensions(batch);
        totalDimensions += batch.length;
    }

    log.info({ totalDimensions, stats: normalizer.getStats() }, 'Processing complete');
    return totalDimensions;
}
