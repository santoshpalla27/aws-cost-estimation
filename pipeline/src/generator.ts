import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Static JSON Generator
 * 
 * Generates static pricing JSON files for frontend consumption
 */
export class PricingGenerator {
    private outputDir: string;

    constructor(outputDir: string = './public/pricing') {
        this.outputDir = outputDir;
    }

    /**
     * Generate pricing JSON file
     */
    async generate(
        service: string,
        region: string,
        dataType: string,
        data: any
    ): Promise<void> {
        const serviceDir = path.join(this.outputDir, service);
        await fs.mkdir(serviceDir, { recursive: true });

        const outputPath = path.join(serviceDir, `${dataType}.json`);

        const pricingData = {
            service,
            region,
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            data,
        };

        await fs.writeFile(
            outputPath,
            JSON.stringify(pricingData, null, 2),
            'utf-8'
        );

        console.log(`Generated: ${outputPath}`);
    }

    /**
     * Generate sample VPC pricing data
     */
    async generateSampleVPCPricing(region: string): Promise<void> {
        // Sample NAT Gateway pricing
        const natGatewayPricing = [
            {
                sku: 'NAT-GATEWAY-HOURS',
                price: 0.045,
                unit: 'hour',
                currency: 'USD',
                attributes: {
                    usageType: 'NatGateway-Hours',
                    region,
                },
            },
            {
                sku: 'NAT-GATEWAY-DATA',
                price: 0.045,
                unit: 'GB',
                currency: 'USD',
                attributes: {
                    usageType: 'NatGateway-Bytes',
                    region,
                },
            },
        ];

        await this.generate('vpc', region, 'nat-gateway', natGatewayPricing);

        // Sample data transfer pricing
        const dataTransferPricing = [
            {
                sku: 'DATA-TRANSFER-OUT',
                price: 0.09,
                unit: 'GB',
                currency: 'USD',
                attributes: {
                    transferType: 'out-to-internet',
                    region,
                },
                tiers: [
                    { min: 0, max: 10240, price: 0.09 },
                    { min: 10240, max: 51200, price: 0.085 },
                    { min: 51200, max: 153600, price: 0.07 },
                ],
            },
            {
                sku: 'DATA-TRANSFER-CROSS-AZ',
                price: 0.01,
                unit: 'GB',
                currency: 'USD',
                attributes: {
                    transferType: 'cross-az',
                    region,
                },
            },
        ];

        await this.generate('vpc', region, 'data-transfer', dataTransferPricing);

        // Sample VPC Endpoints pricing
        const endpointsPricing = [
            {
                sku: 'INTERFACE-ENDPOINT',
                price: 0.01,
                unit: 'hour',
                currency: 'USD',
                attributes: {
                    endpointType: 'Interface',
                    region,
                },
            },
        ];

        await this.generate('vpc', region, 'vpc-endpoints', endpointsPricing);
    }

    /**
     * Generate sample EC2 pricing data
     */
    async generateSampleEC2Pricing(region: string): Promise<void> {
        // Sample instance pricing
        const instancePricing = [
            {
                sku: 'T3-MEDIUM-LINUX',
                price: 0.0416,
                unit: 'hour',
                currency: 'USD',
                attributes: {
                    instanceFamily: 't3',
                    instanceSize: 'medium',
                    operatingSystem: 'linux',
                    tenancy: 'shared',
                    region,
                },
            },
            {
                sku: 'M5-LARGE-LINUX',
                price: 0.096,
                unit: 'hour',
                currency: 'USD',
                attributes: {
                    instanceFamily: 'm5',
                    instanceSize: 'large',
                    operatingSystem: 'linux',
                    tenancy: 'shared',
                    region,
                },
            },
        ];

        await this.generate('ec2', region, 'instance-pricing', instancePricing);

        // Sample EBS pricing
        const ebsPricing = [
            {
                sku: 'EBS-GP3-STORAGE',
                price: 0.08,
                unit: 'GB-month',
                currency: 'USD',
                attributes: {
                    volumeType: 'gp3',
                    region,
                },
            },
            {
                sku: 'EBS-GP3-IOPS',
                price: 0.005,
                unit: 'IOPS-month',
                currency: 'USD',
                attributes: {
                    volumeType: 'gp3',
                    usageType: 'IOPS',
                    region,
                },
            },
            {
                sku: 'EBS-GP3-THROUGHPUT',
                price: 0.04,
                unit: 'MBps-month',
                currency: 'USD',
                attributes: {
                    volumeType: 'gp3',
                    usageType: 'Throughput',
                    region,
                },
            },
        ];

        await this.generate('ec2', region, 'ebs-pricing', ebsPricing);
    }
}

/**
 * Main pipeline execution
 */
async function main() {
    const generator = new PricingGenerator();
    const region = 'us-east-1';

    console.log('Generating sample pricing data...');

    await generator.generateSampleVPCPricing(region);
    await generator.generateSampleEC2Pricing(region);

    console.log('✓ Pricing data generation complete!');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { PricingGenerator };
