import { BaseNormalizer } from './base.normalizer.js';
import { PricingRecord } from '../contracts/pricing.contract.js';

/**
 * VPC Pricing Normalizer
 */
export class VPCNormalizer extends BaseNormalizer {
    constructor(region: string) {
        super('vpc', region);
    }

    protected async normalizeRecord(rawRecord: any): Promise<PricingRecord | null> {
        const product = rawRecord.product;
        if (!product) return null;

        const attributes = product.attributes;
        if (!attributes) return null;

        // Extract price
        const price = this.extractOnDemandPrice(rawRecord);
        if (!price || price.usd === 0) return null;

        // Build dimensions
        const dimensions: Record<string, string | number> = {};

        // Identify service type from usage type
        const usageType = attributes.usagetype || '';

        if (usageType.includes('NatGateway')) {
            dimensions.serviceType = 'nat-gateway';
            if (usageType.includes('Hours')) {
                dimensions.chargeType = 'hourly';
            } else if (usageType.includes('Bytes')) {
                dimensions.chargeType = 'data-processing';
            }
        } else if (usageType.includes('VpcEndpoint')) {
            dimensions.serviceType = 'vpc-endpoint';
            dimensions.endpointType = attributes.endpointType || 'Interface';
        } else if (usageType.includes('DataTransfer')) {
            dimensions.serviceType = 'data-transfer';
            dimensions.transferType = attributes.transferType || 'unknown';
        }

        return {
            sku: product.sku,
            dimensions,
            price,
            metadata: {
                description: attributes.description || '',
                usageType: attributes.usagetype || '',
                operation: attributes.operation || '',
            },
        };
    }
}
