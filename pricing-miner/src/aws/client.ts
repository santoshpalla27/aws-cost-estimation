/**
 * AWS Pricing API Client
 * Handles fetching and streaming pricing data from AWS
 */

import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import pRetry from 'p-retry';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import type { OfferIndex, OfferEntry } from '../types/pricing.js';

const API_BASE = config.aws.pricingBaseUrl;

/**
 * Fetch the AWS offer index to discover all available services
 */
export async function fetchOfferIndex(): Promise<OfferIndex> {
    const url = `${API_BASE}${config.aws.offerIndexPath}`;
    logger.info({ url }, 'Fetching AWS offer index');

    const response = await pRetry(
        async () => {
            const res = await fetch(url, {
                signal: AbortSignal.timeout(config.aws.requestTimeout),
            });
            if (!res.ok) {
                throw new Error(`Failed to fetch offer index: ${res.status} ${res.statusText}`);
            }
            return res.json() as Promise<OfferIndex>;
        },
        {
            retries: config.aws.maxRetries,
            onFailedAttempt: (error) => {
                logger.warn(
                    { attempt: error.attemptNumber, retriesLeft: error.retriesLeft },
                    'Offer index fetch failed, retrying...'
                );
            },
        }
    );

    const serviceCount = Object.keys(response.offers).length;
    logger.info({ serviceCount }, 'Offer index fetched successfully');

    return response;
}

/**
 * Get all available AWS services from the offer index
 */
export async function getAvailableServices(): Promise<OfferEntry[]> {
    const index = await fetchOfferIndex();
    return Object.values(index.offers);
}

/**
 * Get pricing URL for a specific service
 */
export function getPricingUrl(offer: OfferEntry): string {
    // Use currentVersionUrl which points to the full pricing JSON
    return `${API_BASE}${offer.currentVersionUrl}`;
}

/**
 * Fetch pricing data as a stream for memory-efficient processing
 */
export async function streamPricingData(
    service: string,
    url: string
): Promise<{ stream: Readable; etag: string | null; contentLength: number | null }> {
    logger.info({ service, url }, 'Starting pricing data stream');

    const response = await pRetry(
        async () => {
            const res = await fetch(url, {
                signal: AbortSignal.timeout(config.aws.requestTimeout),
            });
            if (!res.ok) {
                throw new Error(`Failed to fetch pricing data: ${res.status} ${res.statusText}`);
            }
            return res;
        },
        {
            retries: config.aws.maxRetries,
            onFailedAttempt: (error) => {
                logger.warn(
                    { service, attempt: error.attemptNumber, retriesLeft: error.retriesLeft },
                    'Pricing fetch failed, retrying...'
                );
            },
        }
    );

    const etag = response.headers.get('etag');
    const contentLength = response.headers.get('content-length');

    if (!response.body) {
        throw new Error('No response body received');
    }

    // Convert web stream to Node.js stream
    const nodeStream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);

    return {
        stream: nodeStream,
        etag,
        contentLength: contentLength ? parseInt(contentLength, 10) : null,
    };
}

/**
 * Generate a version hash for a pricing catalog
 */
export function generateVersionHash(etag: string | null, url: string, date?: string): string {
    const hash = createHash('sha256');
    hash.update(url);
    if (etag) hash.update(etag);
    if (date) hash.update(date);
    return hash.digest('hex').substring(0, 16);
}

/**
 * Check if a new version of pricing data is available
 */
export async function checkForUpdates(
    service: string,
    url: string,
    currentEtag: string | null
): Promise<{ hasUpdate: boolean; etag: string | null }> {
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            logger.warn({ service, status: response.status }, 'HEAD request failed');
            return { hasUpdate: true, etag: null }; // Assume update needed
        }

        const newEtag = response.headers.get('etag');
        const hasUpdate = !currentEtag || currentEtag !== newEtag;

        return { hasUpdate, etag: newEtag };
    } catch (error) {
        logger.warn({ service, error }, 'Failed to check for updates');
        return { hasUpdate: true, etag: null };
    }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}
