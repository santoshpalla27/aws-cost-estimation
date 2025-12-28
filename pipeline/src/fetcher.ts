import { PricingClient, GetProductsCommand } from '@aws-sdk/client-pricing';

/**
 * AWS Pricing API Fetcher
 * 
 * Fetches pricing data from AWS Pricing API
 */
export class PricingFetcher {
    private client: PricingClient;

    constructor(region: string = 'us-east-1') {
        this.client = new PricingClient({ region });
    }

    /**
     * Fetch products for a service
     */
    async fetchProducts(
        serviceCode: string,
        filters?: Array<{ Type: string; Field: string; Value: string }>
    ): Promise<any[]> {
        const products: any[] = [];
        let nextToken: string | undefined;

        try {
            do {
                const command = new GetProductsCommand({
                    ServiceCode: serviceCode,
                    Filters: filters,
                    MaxResults: 100,
                    NextToken: nextToken,
                });

                const response = await this.client.send(command);

                if (response.PriceList) {
                    for (const priceItem of response.PriceList) {
                        try {
                            const product = JSON.parse(priceItem);
                            products.push(product);
                        } catch (error) {
                            console.error('Error parsing price item:', error);
                        }
                    }
                }

                nextToken = response.NextToken;
            } while (nextToken);

            console.log(`Fetched ${products.length} products for ${serviceCode}`);
            return products;
        } catch (error) {
            console.error(`Error fetching products for ${serviceCode}:`, error);
            throw error;
        }
    }

    /**
     * Fetch EC2 pricing
     */
    async fetchEC2Pricing(region: string): Promise<any[]> {
        return this.fetchProducts('AmazonEC2', [
            { Type: 'TERM_MATCH', Field: 'location', Value: this.regionToLocation(region) },
            { Type: 'TERM_MATCH', Field: 'productFamily', Value: 'Compute Instance' },
        ]);
    }

    /**
     * Fetch VPC pricing
     */
    async fetchVPCPricing(region: string): Promise<any[]> {
        return this.fetchProducts('AmazonVPC', [
            { Type: 'TERM_MATCH', Field: 'location', Value: this.regionToLocation(region) },
        ]);
    }

    /**
     * Convert region code to location name
     */
    private regionToLocation(region: string): string {
        const regionMap: Record<string, string> = {
            'us-east-1': 'US East (N. Virginia)',
            'us-east-2': 'US East (Ohio)',
            'us-west-1': 'US West (N. California)',
            'us-west-2': 'US West (Oregon)',
            'eu-west-1': 'Europe (Ireland)',
            'eu-central-1': 'Europe (Frankfurt)',
            'ap-southeast-1': 'Asia Pacific (Singapore)',
            'ap-northeast-1': 'Asia Pacific (Tokyo)',
        };

        return regionMap[region] || region;
    }
}
