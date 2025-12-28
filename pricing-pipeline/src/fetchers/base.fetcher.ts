import { PricingClient, GetProductsCommand, GetProductsCommandInput } from '@aws-sdk/client-pricing';

/**
 * Base Fetcher for AWS Pricing API
 * 
 * This runs OFFLINE ONLY - never in the browser.
 * Requires AWS credentials configured via environment or AWS CLI.
 */
export abstract class BaseFetcher {
    protected client: PricingClient;
    protected serviceCode: string;

    constructor(serviceCode: string, region: string = 'us-east-1') {
        // Pricing API is only available in us-east-1 and ap-south-1
        this.client = new PricingClient({ region: 'us-east-1' });
        this.serviceCode = serviceCode;
    }

    /**
     * Fetch all products for this service with optional filters
     */
    async fetchProducts(filters?: Array<{ Type: string; Field: string; Value: string }>): Promise<any[]> {
        const products: any[] = [];
        let nextToken: string | undefined;

        console.log(`Fetching products for ${this.serviceCode}...`);

        try {
            do {
                const input: GetProductsCommandInput = {
                    ServiceCode: this.serviceCode,
                    Filters: filters,
                    MaxResults: 100,
                    NextToken: nextToken,
                };

                const command = new GetProductsCommand(input);
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

                // Progress indicator
                if (products.length % 100 === 0) {
                    console.log(`  Fetched ${products.length} products...`);
                }
            } while (nextToken);

            console.log(`✓ Fetched ${products.length} total products for ${this.serviceCode}`);
            return products;
        } catch (error) {
            console.error(`Error fetching products for ${this.serviceCode}:`, error);
            throw error;
        }
    }

    /**
     * Convert AWS region code to location name
     */
    protected regionToLocation(region: string): string {
        const regionMap: Record<string, string> = {
            'us-east-1': 'US East (N. Virginia)',
            'us-east-2': 'US East (Ohio)',
            'us-west-1': 'US West (N. California)',
            'us-west-2': 'US West (Oregon)',
            'eu-west-1': 'Europe (Ireland)',
            'eu-central-1': 'Europe (Frankfurt)',
            'eu-west-2': 'Europe (London)',
            'eu-west-3': 'Europe (Paris)',
            'ap-southeast-1': 'Asia Pacific (Singapore)',
            'ap-southeast-2': 'Asia Pacific (Sydney)',
            'ap-northeast-1': 'Asia Pacific (Tokyo)',
            'ap-northeast-2': 'Asia Pacific (Seoul)',
            'ap-south-1': 'Asia Pacific (Mumbai)',
            'sa-east-1': 'South America (Sao Paulo)',
            'ca-central-1': 'Canada (Central)',
        };

        return regionMap[region] || region;
    }

    /**
     * Abstract method: Service-specific fetch logic
     */
    abstract fetchForRegion(region: string): Promise<any[]>;
}
