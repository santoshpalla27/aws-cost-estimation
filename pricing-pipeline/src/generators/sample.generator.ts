import * as fs from 'fs/promises';
import * as path from 'path';
import { PricingData } from '../contracts/pricing.contract.js';

/**
 * Sample Pricing Data Generator
 * 
 * Generates sample pricing data for development/testing
 * without requiring AWS credentials
 */
export class SampleDataGenerator {
    private outputDir: string;

    constructor(outputDir: string = './output') {
        this.outputDir = outputDir;
    }

    /**
     * Generate all sample data
     */
    async generateAll(region: string = 'us-east-1'): Promise<void> {
        console.log(`\nGenerating sample pricing data for ${region}...`);

        await this.generateEC2Pricing(region);
        await this.generateVPCPricing(region);

        console.log('\n✓ Sample pricing data generation complete!');
    }

    /**
     * Generate sample EC2 pricing
     */
    private async generateEC2Pricing(region: string): Promise<void> {
        const data: PricingData = {
            metadata: {
                service: 'ec2',
                region,
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                source: 'aws-pricing-api',
                recordCount: 0,
            },
            records: [
                // t3 instances
                {
                    sku: 'EC2-T3-MICRO-LINUX',
                    dimensions: {
                        instanceType: 't3.micro',
                        instanceFamily: 't3',
                        operatingSystem: 'Linux',
                        tenancy: 'Shared',
                        vcpu: 2,
                        memory: '1 GiB',
                    },
                    price: { unit: 'Hrs', usd: 0.0104 },
                },
                {
                    sku: 'EC2-T3-SMALL-LINUX',
                    dimensions: {
                        instanceType: 't3.small',
                        instanceFamily: 't3',
                        operatingSystem: 'Linux',
                        tenancy: 'Shared',
                        vcpu: 2,
                        memory: '2 GiB',
                    },
                    price: { unit: 'Hrs', usd: 0.0208 },
                },
                {
                    sku: 'EC2-T3-MEDIUM-LINUX',
                    dimensions: {
                        instanceType: 't3.medium',
                        instanceFamily: 't3',
                        operatingSystem: 'Linux',
                        tenancy: 'Shared',
                        vcpu: 2,
                        memory: '4 GiB',
                    },
                    price: { unit: 'Hrs', usd: 0.0416 },
                },
                // m5 instances
                {
                    sku: 'EC2-M5-LARGE-LINUX',
                    dimensions: {
                        instanceType: 'm5.large',
                        instanceFamily: 'm5',
                        operatingSystem: 'Linux',
                        tenancy: 'Shared',
                        vcpu: 2,
                        memory: '8 GiB',
                    },
                    price: { unit: 'Hrs', usd: 0.096 },
                },
                {
                    sku: 'EC2-M5-XLARGE-LINUX',
                    dimensions: {
                        instanceType: 'm5.xlarge',
                        instanceFamily: 'm5',
                        operatingSystem: 'Linux',
                        tenancy: 'Shared',
                        vcpu: 4,
                        memory: '16 GiB',
                    },
                    price: { unit: 'Hrs', usd: 0.192 },
                },
                // EBS volumes
                {
                    sku: 'EBS-GP3-STORAGE',
                    dimensions: {
                        volumeType: 'gp3',
                        storageMedia: 'SSD-backed',
                    },
                    price: { unit: 'GB-Mo', usd: 0.08 },
                },
                {
                    sku: 'EBS-GP3-IOPS',
                    dimensions: {
                        volumeType: 'gp3',
                        storageMedia: 'SSD-backed',
                    },
                    price: { unit: 'IOPS-Mo', usd: 0.005 },
                },
                {
                    sku: 'EBS-GP3-THROUGHPUT',
                    dimensions: {
                        volumeType: 'gp3',
                        storageMedia: 'SSD-backed',
                    },
                    price: { unit: 'MBps-Mo', usd: 0.04 },
                },
                {
                    sku: 'EBS-GP2-STORAGE',
                    dimensions: {
                        volumeType: 'gp2',
                        storageMedia: 'SSD-backed',
                    },
                    price: { unit: 'GB-Mo', usd: 0.10 },
                },
            ],
            index: {},
        };

        // Build index
        data.index = this.buildIndex(data.records);
        data.metadata.recordCount = data.records.length;

        await this.writeFile('ec2', region, data);
        console.log(`  ✓ EC2: ${data.records.length} records`);
    }

    /**
     * Generate sample VPC pricing
     */
    private async generateVPCPricing(region: string): Promise<void> {
        const data: PricingData = {
            metadata: {
                service: 'vpc',
                region,
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                source: 'aws-pricing-api',
                recordCount: 0,
            },
            records: [
                {
                    sku: 'VPC-NAT-GATEWAY-HOURS',
                    dimensions: {
                        serviceType: 'nat-gateway',
                        chargeType: 'hourly',
                    },
                    price: { unit: 'Hrs', usd: 0.045 },
                },
                {
                    sku: 'VPC-NAT-GATEWAY-DATA',
                    dimensions: {
                        serviceType: 'nat-gateway',
                        chargeType: 'data-processing',
                    },
                    price: { unit: 'GB', usd: 0.045 },
                },
                {
                    sku: 'VPC-ENDPOINT-INTERFACE-HOURS',
                    dimensions: {
                        serviceType: 'vpc-endpoint',
                        endpointType: 'Interface',
                    },
                    price: { unit: 'Hrs', usd: 0.01 },
                },
                {
                    sku: 'VPC-ENDPOINT-INTERFACE-DATA',
                    dimensions: {
                        serviceType: 'vpc-endpoint',
                        endpointType: 'Interface',
                    },
                    price: { unit: 'GB', usd: 0.01 },
                },
                {
                    sku: 'VPC-DATA-TRANSFER-OUT',
                    dimensions: {
                        serviceType: 'data-transfer',
                        transferType: 'out-to-internet',
                    },
                    price: { unit: 'GB', usd: 0.09 },
                    tiers: [
                        { min: 0, max: 10240, pricePerUnit: 0.09 },
                        { min: 10240, max: 51200, pricePerUnit: 0.085 },
                        { min: 51200, max: 153600, pricePerUnit: 0.07 },
                        { min: 153600, pricePerUnit: 0.05 },
                    ],
                },
            ],
            index: {},
        };

        // Build index
        data.index = this.buildIndex(data.records);
        data.metadata.recordCount = data.records.length;

        await this.writeFile('vpc', region, data);
        console.log(`  ✓ VPC: ${data.records.length} records`);
    }

    /**
     * Build dimension index
     */
    private buildIndex(records: any[]): Record<string, string[]> {
        const index: Record<string, string[]> = {};

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
     * Write pricing data file
     */
    private async writeFile(service: string, region: string, data: PricingData): Promise<void> {
        const serviceDir = path.join(this.outputDir, service);
        await fs.mkdir(serviceDir, { recursive: true });

        const filepath = path.join(serviceDir, `${region}.json`);
        await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    }
}
