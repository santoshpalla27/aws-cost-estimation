import { BaseFetcher } from './base.fetcher.js';

/**
 * EC2 Pricing Fetcher
 * 
 * Fetches EC2 instance and EBS pricing from AWS Pricing API
 */
export class EC2Fetcher extends BaseFetcher {
    constructor() {
        super('AmazonEC2');
    }

    async fetchForRegion(region: string): Promise<any[]> {
        const location = this.regionToLocation(region);

        console.log(`\nFetching EC2 pricing for ${region} (${location})...`);

        // Fetch instance pricing
        const instancePricing = await this.fetchProducts([
            { Type: 'TERM_MATCH', Field: 'location', Value: location },
            { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Compute Instance' },
            { Type: 'TERM_MATCH', Field: 'tenancy', Value: 'Shared' },
            { Type: 'TERM_MATCH', Field: 'capacitystatus', Value: 'Used' },
            { Type: 'TERM_MATCH', Field: 'preInstalledSw', Value: 'NA' },
        ]);

        // Fetch EBS pricing
        const ebsPricing = await this.fetchProducts([
            { Type: 'TERM_MATCH', Field: 'location', Value: location },
            { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Storage' },
        ]);

        console.log(`✓ EC2: ${instancePricing.length} instance types, ${ebsPricing.length} storage options`);

        return [...instancePricing, ...ebsPricing];
    }
}
