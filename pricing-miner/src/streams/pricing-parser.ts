/**
 * Streaming JSON Parser for AWS Pricing Data
 * Memory-efficient processing of multi-GB pricing files
 */

import { Transform } from 'node:stream';
import { chain } from 'stream-chain';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick.js';
import { streamObject } from 'stream-json/streamers/StreamObject.js';
import { createServiceLogger } from '../utils/logger.js';
import type { Product, TermDetail, TermType } from '../types/pricing.js';

export interface ProductEvent {
    type: 'product';
    sku: string;
    product: Product;
}

export interface TermEvent {
    type: 'term';
    termType: TermType;
    sku: string;
    term: TermDetail;
}

export interface MetadataEvent {
    type: 'metadata';
    field: string;
    value: string;
}

export type PricingEvent = ProductEvent | TermEvent | MetadataEvent;

/**
 * Create a streaming parser for AWS pricing JSON
 * Emits events for products and terms without loading the entire file
 */
export function createPricingParser(service: string): Transform {
    const log = createServiceLogger(service);
    let productsProcessed = 0;
    let termsProcessed = 0;

    return new Transform({
        objectMode: true,
        transform(chunk: { key: string; value: unknown }, _encoding, callback) {
            try {
                const { key, value } = chunk;

                // Handle metadata fields
                if (['offerCode', 'version', 'publicationDate', 'formatVersion'].includes(key)) {
                    this.push({
                        type: 'metadata',
                        field: key,
                        value: value as string,
                    } satisfies MetadataEvent);
                    callback();
                    return;
                }

                // Handle products object
                if (key === 'products' && typeof value === 'object' && value !== null) {
                    const products = value as Record<string, Product>;
                    for (const [sku, product] of Object.entries(products)) {
                        this.push({
                            type: 'product',
                            sku,
                            product: { ...product, sku },
                        } satisfies ProductEvent);
                        productsProcessed++;
                    }
                    log.debug({ productsProcessed }, 'Processed products batch');
                    callback();
                    return;
                }

                // Handle terms object
                if (key === 'terms' && typeof value === 'object' && value !== null) {
                    const terms = value as Record<string, Record<string, Record<string, TermDetail>>>;

                    for (const [termType, skuTerms] of Object.entries(terms)) {
                        if (termType !== 'OnDemand' && termType !== 'Reserved') continue;

                        for (const [sku, termVariants] of Object.entries(skuTerms)) {
                            for (const term of Object.values(termVariants)) {
                                this.push({
                                    type: 'term',
                                    termType: termType as TermType,
                                    sku,
                                    term,
                                } satisfies TermEvent);
                                termsProcessed++;
                            }
                        }
                    }
                    log.debug({ termsProcessed }, 'Processed terms batch');
                    callback();
                    return;
                }

                callback();
            } catch (error) {
                callback(error as Error);
            }
        },
        flush(callback) {
            log.info({ productsProcessed, termsProcessed }, 'Parsing complete');
            callback();
        },
    });
}

/**
 * Create product stream pipeline
 */
export function createProductStreamPipeline() {
    return chain([
        parser(),
        pick({ filter: 'products' }),
        streamObject(),
    ]);
}

/**
 * Progress tracking transform stream
 */
export function createProgressTracker(
    _service: string,
    totalBytes: number | null,
    onProgress: (progress: ProgressInfo) => void
): Transform {
    let bytesProcessed = 0;
    let lastReport = 0;
    const reportInterval = 10 * 1024 * 1024; // Report every 10MB

    return new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            bytesProcessed += chunk.length;

            if (bytesProcessed - lastReport >= reportInterval) {
                lastReport = bytesProcessed;
                onProgress({
                    bytesProcessed,
                    totalBytes,
                    percentage: totalBytes ? (bytesProcessed / totalBytes) * 100 : null,
                });
            }

            callback(null, chunk);
        },
    });
}

export interface ProgressInfo {
    bytesProcessed: number;
    totalBytes: number | null;
    percentage: number | null;
}
