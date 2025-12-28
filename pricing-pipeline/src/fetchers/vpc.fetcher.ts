import { BaseFetcher } from './base.fetcher.js';

/**
 * VPC Pricing Fetcher
 * 
 * Fetches VPC-related pricing (NAT Gateway, VPC Endpoints, Data Transfer)
 */
export class VPCFetcher extends BaseFetcher {
    constructor() {
        super('AmazonVPC');
    }

    async fetchForRegion(region: string): Promise<any[]> {
        const location = this.regionToLocation(region);

        console.log(`\nFetching VPC pricing for ${region} (${location})...`);

        // VPC pricing includes NAT Gateway, VPC Endpoints, etc.
        const vpcPricing = await this.fetchProducts([
            { Type: 'TERM_MATCH', Field: 'location', Value: location },
        ]);

        console.log(`✓ VPC: ${vpcPricing.length} pricing records`);

        return vpcPricing;
    }
}
