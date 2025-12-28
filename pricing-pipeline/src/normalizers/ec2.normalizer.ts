import { BaseNormalizer } from './base.normalizer.js';
import { PricingRecord } from '../contracts/pricing.contract.js';

/**
 * EC2 Pricing Normalizer
 */
export class EC2Normalizer extends BaseNormalizer {
    constructor(region: string) {
        super('ec2', region);
    }

    protected async normalizeRecord(rawRecord: any): Promise<PricingRecord | null> {
        const product = rawRecord.product;
        if (!product) return null;

        const attributes = product.attributes;
        if (!attributes) return null;

        // Extract price
        const price = this.extractOnDemandPrice(rawRecord);
        if (!price || price.usd === 0) return null;

        // Build dimensions based on product family
        const dimensions: Record<string, string | number> = {};

        if (attributes.productFamily === 'Compute Instance') {
            dimensions.instanceType = attributes.instanceType || 'unknown';
            dimensions.instanceFamily = attributes.instanceFamily || 'unknown';
            dimensions.operatingSystem = attributes.operatingSystem || 'Linux';
            dimensions.tenancy = attributes.tenancy || 'Shared';
            dimensions.vcpu = parseInt(attributes.vcpu || '0');
            dimensions.memory = attributes.memory || '0';
        } else if (attributes.productFamily === 'Storage') {
            dimensions.volumeType = attributes.volumeApiName || 'unknown';
            dimensions.storageMedia = attributes.storageMedia || 'unknown';
        }

        return {
            sku: product.sku,
            dimensions,
            price,
            metadata: {
                description: attributes.instanceType || attributes.volumeApiName || '',
                usageType: attributes.usagetype || '',
                operation: attributes.operation || '',
            },
        };
    }
}
