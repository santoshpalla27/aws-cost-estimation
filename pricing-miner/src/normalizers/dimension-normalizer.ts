/**
 * Universal Pricing Dimension Normalizer
 * Converts AWS pricing data into normalized rows for any service
 */

import type {
    Product,
    TermDetail,
    TermType,
    NormalizedPricingDimension,
} from '../types/pricing.js';
import { createServiceLogger } from '../utils/logger.js';

/**
 * Extract region code from product attributes
 * Handles various attribute names across services
 */
export function extractRegionCode(attributes: Record<string, string>): string {
    // Try different attribute names that AWS uses for region
    return (
        attributes['regionCode'] ??
        attributes['region'] ??
        attributes['location'] ??
        extractRegionFromLocation(attributes['location']) ??
        'global'
    );
}

/**
 * Extract region code from location name (fallback)
 */
function extractRegionFromLocation(location: string | undefined): string | null {
    if (!location) return null;

    // Common location to region mappings
    const locationMap: Record<string, string> = {
        'US East (N. Virginia)': 'us-east-1',
        'US East (Ohio)': 'us-east-2',
        'US West (N. California)': 'us-west-1',
        'US West (Oregon)': 'us-west-2',
        'EU (Ireland)': 'eu-west-1',
        'EU (Frankfurt)': 'eu-central-1',
        'EU (London)': 'eu-west-2',
        'EU (Paris)': 'eu-west-3',
        'EU (Stockholm)': 'eu-north-1',
        'Asia Pacific (Tokyo)': 'ap-northeast-1',
        'Asia Pacific (Seoul)': 'ap-northeast-2',
        'Asia Pacific (Singapore)': 'ap-southeast-1',
        'Asia Pacific (Sydney)': 'ap-southeast-2',
        'Asia Pacific (Mumbai)': 'ap-south-1',
        'South America (Sao Paulo)': 'sa-east-1',
        'Canada (Central)': 'ca-central-1',
        'AWS GovCloud (US)': 'us-gov-west-1',
        'AWS GovCloud (US-East)': 'us-gov-east-1',
        'Any': 'global',
    };

    return locationMap[location] ?? null;
}

/**
 * Extract usage type from product attributes
 */
export function extractUsageType(attributes: Record<string, string>): string {
    return attributes['usagetype'] ?? attributes['usageType'] ?? 'Unknown';
}

/**
 * Extract operation from product attributes
 */
export function extractOperation(attributes: Record<string, string>): string | null {
    return attributes['operation'] ?? null;
}

/**
 * Parse price from AWS price per unit format
 */
export function parsePrice(pricePerUnit: Record<string, string>): {
    price: number;
    currency: string;
} {
    // AWS typically uses USD, but we support any currency
    const currency = Object.keys(pricePerUnit)[0] ?? 'USD';
    const priceStr = pricePerUnit[currency] ?? '0';
    const price = parseFloat(priceStr);

    return {
        price: isNaN(price) ? 0 : price,
        currency,
    };
}

/**
 * Parse range value (can be "Inf" for infinity)
 */
export function parseRange(value: string): number | null {
    if (!value || value === 'Inf') return null;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
}

/**
 * Normalize a single product + term into pricing dimensions
 */
export function normalizeTermToDimensions(
    product: Product,
    term: TermDetail,
    termType: TermType,
    catalogVersionId: number,
    service: string
): NormalizedPricingDimension[] {
    const dimensions: NormalizedPricingDimension[] = [];
    const attributes = product.attributes ?? {};

    const regionCode = extractRegionCode(attributes);
    const usageType = extractUsageType(attributes);
    const operation = extractOperation(attributes);

    // Each term can have multiple price dimensions (tiered pricing)
    for (const [rateCode, priceDim] of Object.entries(term.priceDimensions ?? {})) {
        const { price, currency } = parsePrice(priceDim.pricePerUnit);

        dimensions.push({
            catalogVersionId,
            service,
            regionCode,
            usageType,
            operation,
            unit: priceDim.unit,
            pricePerUnit: price,
            currency,
            beginRange: parseRange(priceDim.beginRange),
            endRange: parseRange(priceDim.endRange),
            termType,
            sku: product.sku,
            rateCode,
            description: priceDim.description,
            productFamily: product.productFamily ?? null,
            attributes,
        });
    }

    return dimensions;
}

/**
 * Batch normalizer that processes products and terms
 */
export class PricingNormalizer {
    private service: string;
    private catalogVersionId: number;
    private productMap: Map<string, Product> = new Map();
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
        this.log = createServiceLogger(service);
    }

    /**
     * Register a product for later term processing
     */
    addProduct(product: Product): void {
        this.productMap.set(product.sku, product);
        this.stats.productsProcessed++;
    }

    /**
     * Process a term and return normalized dimensions
     */
    processTerm(sku: string, term: TermDetail, termType: TermType): NormalizedPricingDimension[] {
        const product = this.productMap.get(sku);

        if (!product) {
            this.log.warn({ sku }, 'Term references unknown product SKU');
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
     * Get products map for term processing
     */
    getProductMap(): Map<string, Product> {
        return this.productMap;
    }

    /**
     * Get processing statistics
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Clear product map to free memory
     */
    clear(): void {
        this.productMap.clear();
    }
}
