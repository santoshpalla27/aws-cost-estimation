import { PricingData, PricingRecord, PricingQuery } from '../../pricing-pipeline/src/contracts/pricing.contract';

/**
 * Pricing Engine
 * 
 * Loads and queries static pricing data.
 * Completely generic - no service-specific logic.
 */
export class PricingEngine {
    private data: Map<string, PricingData> = new Map();

    /**
     * Load pricing data for a service and region
     */
    async load(service: string, region: string): Promise<void> {
        const key = `${service}:${region}`;

        try {
            const response = await fetch(`/pricing/${service}/${region}.json`);

            if (!response.ok) {
                throw new Error(`Failed to load pricing data: ${response.statusText}`);
            }

            const data: PricingData = await response.json();

            // Validate metadata
            if (data.metadata.service !== service || data.metadata.region !== region) {
                console.warn(`Pricing data metadata mismatch for ${key}`);
            }

            this.data.set(key, data);

            console.log(`✓ Loaded pricing data: ${service} in ${region} (${data.metadata.recordCount} records)`);
        } catch (error) {
            console.error(`Failed to load pricing data for ${key}:`, error);
            throw error;
        }
    }

    /**
     * Query pricing records by dimensions
     */
    query(service: string, region: string, query: PricingQuery): PricingRecord[] {
        const key = `${service}:${region}`;
        const data = this.data.get(key);

        if (!data) {
            console.warn(`Pricing data not loaded for ${key}`);
            return [];
        }

        const matchMode = query.matchMode || 'all';

        return data.records.filter(record => {
            const matches = Object.entries(query.dimensions).map(([dimKey, dimValue]) => {
                return record.dimensions[dimKey] === dimValue;
            });

            return matchMode === 'all'
                ? matches.every(m => m)
                : matches.some(m => m);
        });
    }

    /**
     * Get single pricing record (first match)
     */
    getPrice(service: string, region: string, dimensions: Record<string, string | number>): PricingRecord | null {
        const results = this.query(service, region, { dimensions, matchMode: 'all' });
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Calculate tiered pricing
     */
    calculateTiered(record: PricingRecord, quantity: number): number {
        if (!record.tiers || record.tiers.length === 0) {
            // Simple pricing
            return record.price.usd * quantity;
        }

        let totalCost = 0;
        let remaining = quantity;

        for (const tier of record.tiers) {
            const tierSize = tier.max !== undefined ? tier.max - tier.min : Infinity;
            const quantityInTier = Math.min(remaining, tierSize);

            if (quantityInTier > 0) {
                totalCost += quantityInTier * tier.pricePerUnit;
                remaining -= quantityInTier;
            }

            if (remaining <= 0) break;
        }

        return totalCost;
    }

    /**
     * Get all loaded pricing data keys
     */
    getLoadedKeys(): string[] {
        return Array.from(this.data.keys());
    }

    /**
     * Check if pricing data is loaded
     */
    isLoaded(service: string, region: string): boolean {
        return this.data.has(`${service}:${region}`);
    }

    /**
     * Get pricing metadata
     */
    getMetadata(service: string, region: string) {
        const data = this.data.get(`${service}:${region}`);
        return data?.metadata;
    }

    /**
     * Clear all loaded pricing data
     */
    clear(): void {
        this.data.clear();
    }

    /**
     * Preload pricing data for multiple services/regions
     */
    async preload(services: Array<{ service: string; region: string }>): Promise<void> {
        const promises = services.map(({ service, region }) =>
            this.load(service, region).catch(error => {
                console.error(`Failed to preload ${service}:${region}`, error);
            })
        );

        await Promise.all(promises);
    }
}

// Singleton instance
export const pricingEngine = new PricingEngine();
