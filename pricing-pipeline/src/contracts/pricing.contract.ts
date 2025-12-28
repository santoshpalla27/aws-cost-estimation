/**
 * Pricing Data Contract
 * 
 * This is the authoritative contract for all pricing data.
 * The pipeline MUST output data matching this contract.
 * The frontend MUST only consume data matching this contract.
 */

/**
 * Complete pricing dataset for a service in a region
 */
export interface PricingData {
    metadata: PricingMetadata;
    records: PricingRecord[];
    index: PricingIndex;
}

/**
 * Metadata about the pricing dataset
 */
export interface PricingMetadata {
    service: string;
    region: string;
    version: string;
    generatedAt: string;
    source: 'aws-pricing-api';
    recordCount: number;
}

/**
 * Individual pricing record
 */
export interface PricingRecord {
    /** Unique SKU identifier */
    sku: string;

    /** Dimensions that identify this pricing (e.g., instanceType, volumeType) */
    dimensions: Record<string, string | number>;

    /** Price information */
    price: PriceInfo;

    /** Optional tiered pricing */
    tiers?: PricingTier[];

    /** Optional metadata */
    metadata?: {
        description?: string;
        usageType?: string;
        operation?: string;
    };
}

/**
 * Price information
 */
export interface PriceInfo {
    /** Price unit (e.g., "Hrs", "GB-Mo", "Requests") */
    unit: string;

    /** Price in USD */
    usd: number;

    /** Optional currency (defaults to USD) */
    currency?: string;
}

/**
 * Tiered pricing structure
 */
export interface PricingTier {
    /** Minimum quantity for this tier (inclusive) */
    min: number;

    /** Maximum quantity for this tier (exclusive), undefined means infinity */
    max?: number;

    /** Price per unit in this tier */
    pricePerUnit: number;
}

/**
 * Index for fast dimension-based lookups
 */
export interface PricingIndex {
    /** Map of dimension key to array of SKU IDs */
    [dimensionKey: string]: string[];
}

/**
 * Pricing lookup query
 */
export interface PricingQuery {
    /** Dimensions to match */
    dimensions: Record<string, string | number>;

    /** Whether all dimensions must match (AND) or any (OR) */
    matchMode?: 'all' | 'any';
}

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validator for pricing data contract compliance
 */
export class PricingDataValidator {
    validate(data: unknown): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!data || typeof data !== 'object') {
            errors.push('Data must be an object');
            return { valid: false, errors, warnings };
        }

        const pricingData = data as Partial<PricingData>;

        // Validate metadata
        if (!pricingData.metadata) {
            errors.push('Missing metadata');
        } else {
            if (!pricingData.metadata.service) errors.push('metadata.service is required');
            if (!pricingData.metadata.region) errors.push('metadata.region is required');
            if (!pricingData.metadata.version) errors.push('metadata.version is required');
            if (!pricingData.metadata.generatedAt) errors.push('metadata.generatedAt is required');
            if (pricingData.metadata.source !== 'aws-pricing-api') {
                errors.push('metadata.source must be "aws-pricing-api"');
            }
        }

        // Validate records
        if (!Array.isArray(pricingData.records)) {
            errors.push('records must be an array');
        } else {
            pricingData.records.forEach((record, index) => {
                if (!record.sku) errors.push(`Record ${index}: missing sku`);
                if (!record.dimensions) errors.push(`Record ${index}: missing dimensions`);
                if (!record.price) errors.push(`Record ${index}: missing price`);
                if (record.price && !record.price.unit) errors.push(`Record ${index}: price.unit is required`);
                if (record.price && typeof record.price.usd !== 'number') {
                    errors.push(`Record ${index}: price.usd must be a number`);
                }
            });
        }

        // Validate index
        if (!pricingData.index || typeof pricingData.index !== 'object') {
            errors.push('index must be an object');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
}
