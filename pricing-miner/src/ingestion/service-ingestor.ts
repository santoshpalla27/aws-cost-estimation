/**
 * Service Ingestion Orchestrator
 * Handles the complete ingestion flow for a single AWS service
 * Uses streaming for large files to avoid memory exhaustion
 */

import { Readable } from 'node:stream';
import { createReadStream, createWriteStream, unlinkSync, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pkg from 'stream-json';
import StreamJsonPick from 'stream-json/filters/Pick.js';
import StreamJsonObject from 'stream-json/streamers/StreamObject.js';
import StreamChain from 'stream-chain';

const { parser } = pkg;
const pick = StreamJsonPick.pick;
const streamObject = StreamJsonObject.streamObject;
const chain = StreamChain.chain;
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
import { saveIngestionSummary, saveIngestionLog } from '../utils/storage.js';
import type {
    OfferEntry,
    NormalizedPricingDimension,
    IngestionResult,
    Product,
    TermDetail,
} from '../types/pricing.js';

// Threshold for using streaming (20MB)
const STREAMING_THRESHOLD_BYTES = 20 * 1024 * 1024;

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
        const contentLengthStr = headResponse.headers.get('content-length');
        const contentLength = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;

        if (contentLength) {
            log.info({ size: formatBytes(contentLength) }, 'Pricing file size');
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

        // Choose processing method based on file size
        if (contentLength > STREAMING_THRESHOLD_BYTES) {
            log.info({ threshold: formatBytes(STREAMING_THRESHOLD_BYTES) }, 'Using streaming mode for large file');
            recordCount = await processServiceWithStreaming(url, normalizer, rosetta, log);
        } else {
            recordCount = await processServiceWithFetch(url, normalizer, rosetta, log);
        }

        // Save rosetta mappings
        const mappings = rosetta.exportMappings();
        if (mappings.length > 0) {
            await bulkInsertAttributeMappings(mappings);
            log.info({ mappingCount: mappings.length }, 'Saved attribute mappings');
        }

        // Update catalog version status
        await updateCatalogVersionStatus(catalogVersionId, 'completed', recordCount);

        const duration = Date.now() - startTime;
        const stats = normalizer.getStats();
        const rosettaStats = rosetta.getStats();

        log.info(
            {
                recordCount,
                duration: `${(duration / 1000).toFixed(1)}s`,
                stats,
                rosettaStats,
            },
            'Service ingestion completed'
        );

        // Save ingestion summary to data volume
        await saveIngestionSummary(service, {
            catalogVersionId,
            recordCount,
            duration,
            stats,
            rosettaStats,
            timestamp: new Date().toISOString(),
        });

        // Save ingestion log
        await saveIngestionLog({
            timestamp: new Date().toISOString(),
            service,
            status: 'completed',
            recordCount,
            duration,
        });

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

        // Save failed ingestion log
        await saveIngestionLog({
            timestamp: new Date().toISOString(),
            service,
            status: 'failed',
            error: err.message,
        });

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
 * Process large files using disk-based approach
 * Downloads file to disk first, then processes from local file
 * This allows ALL data to be processed without memory issues
 */
async function processServiceWithStreaming(
    url: string,
    normalizer: PricingNormalizer,
    rosetta: Rosetta,
    log: ReturnType<typeof createIngestionLogger>
): Promise<number> {
    // Create temp file path
    const tempFilePath = join(tmpdir(), `pricing-${Date.now()}.json`);

    log.info('Phase 0: Downloading pricing file to disk...');

    try {
        // Download file to disk first (uses minimal RAM)
        const response = await fetch(url, {
            signal: AbortSignal.timeout(config.aws.requestTimeout),
        });

        if (!response.ok || !response.body) {
            throw new Error(`Failed to fetch pricing data: ${response.status}`);
        }

        // Stream directly to disk
        const webStream = response.body as import('node:stream/web').ReadableStream;
        const nodeStream = Readable.fromWeb(webStream);
        const writeStream = createWriteStream(tempFilePath);

        await pipeline(nodeStream, writeStream);
        log.info({ path: tempFilePath }, 'Downloaded pricing file to disk');

        // Phase 1: Stream products from disk file
        log.info('Phase 1: Streaming products from disk (ALL data, no filtering)');
        const productMap = new Map<string, Product>();

        await new Promise<void>((resolve, reject) => {
            const fileStream = createReadStream(tempFilePath);
            const productPipeline = chain([
                fileStream,
                parser(),
                pick({ filter: 'products' }),
                streamObject(),
            ]);

            productPipeline.on('data', ({ key, value }: { key: string; value: Product }) => {
                const product = { ...value, sku: key };
                productMap.set(key, product);
                rosetta.learnFromProduct(product);
            });

            productPipeline.on('end', () => resolve());
            productPipeline.on('error', (err: Error) => reject(err));
        });

        log.info({ productCount: productMap.size }, 'Products loaded from disk');

        // Add products to normalizer
        for (const product of productMap.values()) {
            normalizer.addProduct(product);
        }

        // Clear productMap to free memory (normalizer has its own copy)
        productMap.clear();

        // Phase 2: Stream OnDemand terms from disk file
        let totalDimensions = 0;
        const batchSize = config.ingestion.batchSize;
        let batch: NormalizedPricingDimension[] = [];

        log.info('Phase 2: Streaming OnDemand terms from disk');

        await new Promise<void>((resolve, reject) => {
            const onDemandStream = createReadStream(tempFilePath);
            const termsPipeline = chain([
                onDemandStream,
                parser(),
                pick({ filter: 'terms.OnDemand' }),
                streamObject(),
            ]);

            termsPipeline.on('data', async ({ key: sku, value: termVariants }: { key: string; value: Record<string, TermDetail> }) => {
                for (const term of Object.values(termVariants)) {
                    const dimensions = normalizer.processTerm(sku, term, 'OnDemand');
                    batch.push(...dimensions);

                    if (batch.length >= batchSize) {
                        termsPipeline.pause();
                        try {
                            await bulkInsertPricingDimensions(batch);
                            totalDimensions += batch.length;
                            log.debug({ batchSize: batch.length, total: totalDimensions }, 'Inserted batch');
                            batch = [];
                        } finally {
                            termsPipeline.resume();
                        }
                    }
                }
            });

            termsPipeline.on('end', () => resolve());
            termsPipeline.on('error', (err: Error) => reject(err));
        });

        // Flush remaining OnDemand batch
        if (batch.length > 0) {
            await bulkInsertPricingDimensions(batch);
            totalDimensions += batch.length;
            batch = [];
        }

        log.info({ onDemandCount: totalDimensions }, 'OnDemand terms processed');

        // Phase 3: Stream Reserved terms from disk file
        log.info('Phase 3: Streaming Reserved terms from disk');
        let reservedCount = 0;

        await new Promise<void>((resolve, reject) => {
            const reservedStream = createReadStream(tempFilePath);
            const reservedPipeline = chain([
                reservedStream,
                parser(),
                pick({ filter: 'terms.Reserved' }),
                streamObject(),
            ]);

            reservedPipeline.on('data', async ({ key: sku, value: termVariants }: { key: string; value: Record<string, TermDetail> }) => {
                for (const term of Object.values(termVariants)) {
                    const dimensions = normalizer.processTerm(sku, term, 'Reserved');
                    batch.push(...dimensions);
                    reservedCount += dimensions.length;

                    if (batch.length >= batchSize) {
                        reservedPipeline.pause();
                        try {
                            await bulkInsertPricingDimensions(batch);
                            totalDimensions += batch.length;
                            log.debug({ batchSize: batch.length, total: totalDimensions }, 'Inserted batch');
                            batch = [];
                        } finally {
                            reservedPipeline.resume();
                        }
                    }
                }
            });

            reservedPipeline.on('end', () => resolve());
            reservedPipeline.on('error', (err: Error) => reject(err));
        });

        // Flush remaining Reserved batch
        if (batch.length > 0) {
            await bulkInsertPricingDimensions(batch);
            totalDimensions += batch.length;
        }

        log.info({ reservedCount, totalDimensions }, 'Reserved terms processed');
        log.info({ totalDimensions, stats: normalizer.getStats() }, 'Disk-based processing complete');

        return totalDimensions;
    } finally {
        // Cleanup: delete temp file
        try {
            if (existsSync(tempFilePath)) {
                unlinkSync(tempFilePath);
                log.info({ path: tempFilePath }, 'Cleaned up temp pricing file');
            }
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Process small files using fetch + JSON parsing (faster for small files)
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

    log.info({ sizeInMB: sizeInMB.toFixed(1) }, 'Fetching pricing data (in-memory mode)');

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
