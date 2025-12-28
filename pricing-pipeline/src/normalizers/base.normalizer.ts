import { PricingData, PricingRecord, PricingIndex } from '../contracts/pricing.contract.js';

/**
 * Base Normalizer
 * 
 * Transforms raw AWS Pricing API data into our pricing contract format
 */
export abstract class BaseNormalizer {
    protected service: string;
    protected region: string;

    constructor(service: string, region: string) {
        this.service = service;
        this.region = region;
    }

    /**
     * Normalize raw AWS pricing data to contract format
     */
    async normalize(rawData: any[]): Promise<PricingData> {
        console.log(`\nNormalizing ${rawData.length} records for ${this.service}...`);

        const records: PricingRecord[] = [];

        for (const item of rawData) {
            try {
                const normalized = await this.normalizeRecord(item);
                if (normalized) {
                    records.push(normalized);
                }
            } catch (error) {
                console.warn(`Warning: Failed to normalize record:`, error);
            }
        }

        // Build index
        const index = this.buildIndex(records);

        console.log(`✓ Normalized ${records.length} pricing records`);

        return {
            metadata: {
                service: this.service,
                region: this.region,
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                source: 'aws-pricing-api',
                recordCount: records.length,
            },
            records,
            index,
        };
    }

    /**
     * Build dimension index for fast lookups
     */
    protected buildIndex(records: PricingRecord[]): PricingIndex {
        const index: PricingIndex = {};

        for (const record of records) {
            for (const [key, value] of Object.entries(record.dimensions)) {
                const indexKey = `${key}:${value}`;

                if (!index[indexKey]) {
                    index[indexKey] = [];
                }

                index[indexKey].push(record.sku);
            }
        }

        return index;
    }

    /**
     * Abstract method: Service-specific normalization logic
     */
    protected abstract normalizeRecord(rawRecord: any): Promise<PricingRecord | null>;

    /**
     * Extract on-demand price from AWS pricing structure
     */
    protected extractOnDemandPrice(rawRecord: any): { unit: string; usd: number } | null {
        try {
            const terms = rawRecord.terms?.OnDemand;
            if (!terms) return null;

            // Get first term
            const termKey = Object.keys(terms)[0];
            if (!termKey) return null;

            const term = terms[termKey];
            const priceDimensions = term.priceDimensions;
            if (!priceDimensions) return null;

            // Get first price dimension
            const dimensionKey = Object.keys(priceDimensions)[0];
            if (!dimensionKey) return null;

            const dimension = priceDimensions[dimensionKey];

            return {
                unit: dimension.unit || 'Unknown',
                usd: parseFloat(dimension.pricePerUnit?.USD || '0'),
            };
        } catch (error) {
            return null;
        }
    }
}
