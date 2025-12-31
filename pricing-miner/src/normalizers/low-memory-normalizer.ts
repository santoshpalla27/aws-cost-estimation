/**
 * Low-Memory Pricing Normalizer 
 * Uses SQLite to store products on disk instead of RAM
 * Designed for large files like AmazonEC2 (7GB+)
 */

import { SQLiteProductStore } from './sqlite-product-store.js';
import { normalizeTermToDimensions } from './dimension-normalizer.js';
import { createServiceLogger } from '../utils/logger.js';
import type {
    Product,
    TermDetail,
    TermType,
    NormalizedPricingDimension,
} from '../types/pricing.js';

/**
 * Low-memory normalizer that uses SQLite for product storage
 */
export class LowMemoryNormalizer {
    private service: string;
    private catalogVersionId: number;
    private productStore: SQLiteProductStore;
    private log: ReturnType<typeof createServiceLogger>;

    private stats = {
        productsProcessed: 0,
        termsProcessed: 0,
        dimensionsCreated: 0,
        skipped: 0,
    };

    constructor(service: string, catalogVersionId: number) {
        this.service = service;
        this.catalogVersionId = catalogVersionId;
        this.productStore = new SQLiteProductStore(service);
        this.log = createServiceLogger(service);
    }

    /**
     * Add a product to the SQLite store (disk-based)
     */
    addProduct(product: Product): void {
        this.productStore.addProduct(product);
        this.stats.productsProcessed++;
    }

    /**
     * Process a term and return normalized dimensions
     */
    processTerm(sku: string, term: TermDetail, termType: TermType): NormalizedPricingDimension[] {
        // Lookup from SQLite (disk)
        const product = this.productStore.getProduct(sku);

        if (!product) {
            // Only log every 10000th skip to reduce noise
            if (this.stats.skipped % 10000 === 0) {
                this.log.warn({ sku, skippedCount: this.stats.skipped }, 'Term references unknown product SKU');
            }
            this.stats.skipped++;
            return [];
        }

        this.stats.termsProcessed++;

        const dimensions = normalizeTermToDimensions(
            product,
            term,
            termType,
            this.catalogVersionId,
            this.service
        );

        this.stats.dimensionsCreated += dimensions.length;
        return dimensions;
    }

    /**
     * Get product count
     */
    getProductCount(): number {
        return this.productStore.getCount();
    }

    /**
     * Get processing statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Cleanup SQLite database
     */
    close(): void {
        this.productStore.close();
    }
}
