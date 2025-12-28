import { PricingData } from '@types/schema.types';

/**
 * Pricing lookup key
 */
export interface PricingKey {
    [attribute: string]: string | number;
}

/**
 * Pricing record
 */
export interface PricingRecord {
    sku: string;
    price: number;
    unit: string;
    currency: string;
    attributes: Record<string, unknown>;
    tiers?: Array<{
        min: number;
        max?: number;
        price: number;
    }>;
}

/**
 * Pricing Engine
 * 
 * Loads and queries static pricing data
 */
export class PricingEngine {
    private pricingCache: Map<string, PricingData> = new Map();
    private indexCache: Map<string, Map<string, PricingRecord[]>> = new Map();

    /**
     * Load pricing data for a service and region
     */
    async loadPricing(service: string, region: string, dataPath: string): Promise<void> {
        const cacheKey = `${service}:${region}:${dataPath}`;

        if (this.pricingCache.has(cacheKey)) {
            return; // Already loaded
        }

        try {
            const response = await fetch(`/pricing/${service}/${dataPath}.json`);

            if (!response.ok) {
                throw new Error(`Failed to load pricing data: ${response.statusText}`);
            }

            const data: PricingData = await response.json();

            // Validate region
            if (data.region !== region && data.region !== 'global') {
                console.warn(`Pricing data region mismatch: expected ${region}, got ${data.region}`);
            }

            this.pricingCache.set(cacheKey, data);
            this.buildIndex(cacheKey, data);
        } catch (error) {
            console.error(`Error loading pricing data for ${cacheKey}:`, error);
            throw error;
        }
    }

    /**
     * Build index for fast lookups
     */
    private buildIndex(cacheKey: string, data: PricingData): void {
        const index = new Map<string, PricingRecord[]>();

        // Assuming data.data is an array of pricing records
        const records = Array.isArray(data.data) ? data.data : Object.values(data.data);

        for (const record of records) {
            if (!this.isPricingRecord(record)) {
                continue;
            }

            // Index by each attribute
            for (const [attr, value] of Object.entries(record.attributes)) {
                const key = `${attr}:${value}`;

                if (!index.has(key)) {
                    index.set(key, []);
                }

                index.get(key)!.push(record);
            }
        }

        this.indexCache.set(cacheKey, index);
    }

    /**
     * Type guard for pricing records
     */
    private isPricingRecord(obj: unknown): obj is PricingRecord {
        return (
            typeof obj === 'object' &&
            obj !== null &&
            'price' in obj &&
            'attributes' in obj
        );
    }

    /**
     * Lookup pricing by attributes
     */
    lookup(
        service: string,
        region: string,
        dataPath: string,
        attributes: PricingKey
    ): PricingRecord | null {
        const cacheKey = `${service}:${region}:${dataPath}`;
        const index = this.indexCache.get(cacheKey);

        if (!index) {
            console.warn(`Pricing data not loaded for ${cacheKey}`);
            return null;
        }

        // Get all records that match the first attribute
        const firstAttr = Object.entries(attributes)[0];
        if (!firstAttr) {
            return null;
        }

        const [firstKey, firstValue] = firstAttr;
        const candidates = index.get(`${firstKey}:${firstValue}`) || [];

        // Filter candidates by all attributes
        const matches = candidates.filter(record => {
            return Object.entries(attributes).every(([key, value]) => {
                return record.attributes[key] === value;
            });
        });

        if (matches.length === 0) {
            console.warn(`No pricing found for ${cacheKey} with attributes:`, attributes);
            return null;
        }

        if (matches.length > 1) {
            console.warn(`Multiple pricing records found for ${cacheKey}, using first match`);
        }

        return matches[0];
    }

    /**
     * Calculate tiered pricing
     */
    calculateTieredPrice(record: PricingRecord, quantity: number): number {
        if (!record.tiers || record.tiers.length === 0) {
            return record.price * quantity;
        }

        let totalCost = 0;
        let remaining = quantity;

        for (const tier of record.tiers) {
            const tierMin = tier.min;
            const tierMax = tier.max ?? Infinity;
            const tierSize = tierMax - tierMin;

            if (remaining <= 0) {
                break;
            }

            const quantityInTier = Math.min(remaining, tierSize);
            totalCost += quantityInTier * tier.price;
            remaining -= quantityInTier;
        }

        return totalCost;
    }

    /**
     * Get all available options for an attribute
     */
    getAttributeOptions(
        service: string,
        region: string,
        dataPath: string,
        attribute: string
    ): Array<{ value: string | number; label: string }> {
        const cacheKey = `${service}:${region}:${dataPath}`;
        const data = this.pricingCache.get(cacheKey);

        if (!data) {
            return [];
        }

        const records = Array.isArray(data.data) ? data.data : Object.values(data.data);
        const values = new Set<string | number>();

        for (const record of records) {
            if (this.isPricingRecord(record) && attribute in record.attributes) {
                values.add(record.attributes[attribute] as string | number);
            }
        }

        return Array.from(values).map(value => ({
            value,
            label: String(value),
        }));
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.pricingCache.clear();
        this.indexCache.clear();
    }

    /**
     * Get pricing data version
     */
    getVersion(service: string, region: string, dataPath: string): string | null {
        const cacheKey = `${service}:${region}:${dataPath}`;
        const data = this.pricingCache.get(cacheKey);
        return data?.version ?? null;
    }

    /**
     * Get last updated timestamp
     */
    getLastUpdated(service: string, region: string, dataPath: string): string | null {
        const cacheKey = `${service}:${region}:${dataPath}`;
        const data = this.pricingCache.get(cacheKey);
        return data?.lastUpdated ?? null;
    }
}

// Singleton instance
export const pricingEngine = new PricingEngine();
