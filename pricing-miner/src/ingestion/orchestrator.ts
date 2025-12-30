/**
 * Ingestion Orchestrator
 * Manages parallel ingestion of multiple AWS services
 */

import { getAvailableServices } from '../aws/client.js';
import { ingestService } from './service-ingestor.js';
import { config, PRIORITY_SERVICES } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { OfferEntry, IngestionStats, IngestionResult } from '../types/pricing.js';

interface RunIngestionOptions {
    services?: string[];
    concurrency?: number;
    batchSize?: number;
    forceRefresh?: boolean;
}

/**
 * Run ingestion for all or selected AWS services
 */
export async function runIngestion(options: RunIngestionOptions = {}): Promise<IngestionStats> {
    const concurrency = options.concurrency ?? config.ingestion.concurrency;
    const services = options.services;
    const forceRefresh = options.forceRefresh ?? false;

    logger.info({ services, concurrency, forceRefresh }, 'Starting ingestion orchestrator');

    const startTime = Date.now();

    // Fetch all available services
    const allOffers = await getAvailableServices();
    logger.info({ availableServices: allOffers.length }, 'Discovered AWS services');

    // Filter services if specified
    let offersToProcess = allOffers;
    if (services && services.length > 0) {
        const serviceSet = new Set(services.map((s) => s.toLowerCase()));
        offersToProcess = allOffers.filter((o) =>
            serviceSet.has(o.offerCode.toLowerCase())
        );
        logger.info({ requestedServices: services, matchedServices: offersToProcess.length }, 'Filtered services');
    }

    // Sort by priority (priority services first)
    offersToProcess = sortByPriority(offersToProcess);

    // Process services with concurrency limit
    const results: IngestionResult[] = [];
    const queue = [...offersToProcess];

    // Simple concurrency implementation
    async function processQueue(): Promise<void> {
        while (queue.length > 0) {
            const offer = queue.shift();
            if (offer) {
                logger.info({ service: offer.offerCode }, 'Processing service');
                const result = await ingestService(offer);
                results.push(result);
            }
        }
    }

    // Start concurrent workers
    const workers: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i++) {
        workers.push(processQueue());
    }
    await Promise.all(workers);

    // Calculate statistics
    const stats: IngestionStats = {
        totalServices: results.length,
        successCount: results.filter((r) => r.success).length,
        failureCount: results.filter((r) => !r.success).length,
        totalRecords: results.reduce((sum, r) => sum + r.recordCount, 0),
        totalDuration: Date.now() - startTime,
        results,
    };

    logger.info(
        {
            totalServices: stats.totalServices,
            successCount: stats.successCount,
            failureCount: stats.failureCount,
            totalRecords: stats.totalRecords,
            durationSeconds: (stats.totalDuration / 1000).toFixed(1),
        },
        'Ingestion complete'
    );

    // Log failed services
    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
        logger.warn(
            { failures: failures.map((f) => ({ service: f.service, error: f.error })) },
            'Some services failed to ingest'
        );
    }

    return stats;
}

/**
 * Sort services by priority (important services first)
 */
function sortByPriority(offers: OfferEntry[]): OfferEntry[] {
    const priorityMap = new Map(PRIORITY_SERVICES.map((s, i) => [s, i]));

    return [...offers].sort((a, b) => {
        const priorityA = priorityMap.get(a.offerCode) ?? 999;
        const priorityB = priorityMap.get(b.offerCode) ?? 999;
        return priorityA - priorityB;
    });
}

/**
 * Get list of all available service codes
 */
export async function listAvailableServices(): Promise<string[]> {
    const offers = await getAvailableServices();
    return offers.map((o) => o.offerCode).sort();
}
