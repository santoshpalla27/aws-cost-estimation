/**
 * Rosetta Table - Auto-Learned Metadata Mappings
 * Extracts and stores attribute mappings from pricing data
 * NO HARDCODING - learns from the data itself
 */

import type { Product, AttributeMapping } from '../types/pricing.js';
import { createServiceLogger } from '../utils/logger.js';

/**
 * Mapping types we care about for pricing translation
 */
export const MAPPING_TYPES = {
    REGION_TO_LOCATION: 'region_to_location',
    LOCATION_TO_REGION: 'location_to_region',
    INSTANCE_FAMILY: 'instance_family',
    OPERATING_SYSTEM: 'operating_system',
    TENANCY: 'tenancy',
    LICENSE_MODEL: 'license_model',
    PURCHASE_OPTION: 'purchase_option',
    OFFER_CLASS: 'offer_class',
    PRODUCT_FAMILY: 'product_family',
    USAGE_TYPE_PREFIX: 'usage_type_prefix',
} as const;

export type MappingType = (typeof MAPPING_TYPES)[keyof typeof MAPPING_TYPES];

/**
 * Rosetta - Auto-learns mappings from pricing data
 */
export class Rosetta {
    private catalogVersionId: number;
    private mappings: Map<string, Map<string, string>> = new Map();
    private log: ReturnType<typeof createServiceLogger>;

    constructor(service: string, catalogVersionId: number) {
        this.catalogVersionId = catalogVersionId;
        this.log = createServiceLogger(service);

        // Initialize mapping containers
        for (const type of Object.values(MAPPING_TYPES)) {
            this.mappings.set(type, new Map());
        }
    }

    /**
     * Learn mappings from a product's attributes
     */
    learnFromProduct(product: Product): void {
        const attrs = product.attributes ?? {};

        // Region <-> Location mappings
        const regionCode = attrs['regionCode'];
        const location = attrs['location'];
        if (regionCode && location) {
            this.addMapping(MAPPING_TYPES.REGION_TO_LOCATION, regionCode, location);
            this.addMapping(MAPPING_TYPES.LOCATION_TO_REGION, location, regionCode);
        }

        // Operating System mappings
        const os = attrs['operatingSystem'];
        if (os) {
            this.addMapping(MAPPING_TYPES.OPERATING_SYSTEM, os.toLowerCase(), os);
        }

        // Tenancy mappings
        const tenancy = attrs['tenancy'];
        if (tenancy) {
            this.addMapping(MAPPING_TYPES.TENANCY, tenancy.toLowerCase(), tenancy);
        }

        // License model mappings
        const licenseModel = attrs['licenseModel'];
        if (licenseModel) {
            this.addMapping(MAPPING_TYPES.LICENSE_MODEL, licenseModel.toLowerCase(), licenseModel);
        }

        // Instance family (extract from instanceType)
        const instanceType = attrs['instanceType'];
        if (instanceType) {
            const family = extractInstanceFamily(instanceType);
            if (family) {
                this.addMapping(MAPPING_TYPES.INSTANCE_FAMILY, instanceType, family);
            }
        }

        // Product family
        const productFamily = attrs['productFamily'] ?? product.productFamily;
        if (productFamily) {
            this.addMapping(MAPPING_TYPES.PRODUCT_FAMILY, productFamily.toLowerCase(), productFamily);
        }

        // Usage type prefix (region prefix extraction)
        const usageType = attrs['usagetype'] ?? attrs['usageType'];
        if (usageType && regionCode) {
            const prefix = extractUsageTypePrefix(usageType);
            if (prefix) {
                this.addMapping(MAPPING_TYPES.USAGE_TYPE_PREFIX, prefix, regionCode);
            }
        }
    }

    /**
     * Add a mapping (idempotent)
     */
    private addMapping(type: MappingType, source: string, target: string): void {
        const typeMap = this.mappings.get(type);
        if (typeMap && !typeMap.has(source)) {
            typeMap.set(source, target);
        }
    }

    /**
     * Look up a mapping
     */
    lookup(type: MappingType, source: string): string | null {
        return this.mappings.get(type)?.get(source) ?? null;
    }

    /**
     * Get all mappings for a type
     */
    getMappings(type: MappingType): Map<string, string> {
        return this.mappings.get(type) ?? new Map();
    }

    /**
     * Export all mappings as database records
     */
    exportMappings(): AttributeMapping[] {
        const result: AttributeMapping[] = [];

        for (const [mappingType, typeMap] of this.mappings) {
            for (const [sourceValue, targetValue] of typeMap) {
                result.push({
                    mappingType,
                    sourceValue,
                    targetValue,
                    catalogVersionId: this.catalogVersionId,
                });
            }
        }

        this.log.info({ mappingCount: result.length }, 'Exported attribute mappings');
        return result;
    }

    /**
     * Get statistics about learned mappings
     */
    getStats(): Record<string, number> {
        const stats: Record<string, number> = {};
        for (const [type, typeMap] of this.mappings) {
            stats[type] = typeMap.size;
        }
        return stats;
    }
}

/**
 * Extract instance family from instance type (e.g., "t3.micro" -> "t3")
 */
function extractInstanceFamily(instanceType: string): string | null {
    const match = instanceType.match(/^([a-z]+\d+[a-z]*)/i);
    return match?.[1] ?? null;
}

/**
 * Extract region prefix from usage type
 * e.g., "USE1-BoxUsage:t3.micro" -> "USE1"
 * e.g., "EUW1-DataTransfer-Out-Bytes" -> "EUW1"
 */
function extractUsageTypePrefix(usageType: string): string | null {
    const match = usageType.match(/^([A-Z]{2,4}\d?)-/);
    return match?.[1] ?? null;
}

/**
 * Known AWS region code to usage type prefix mappings
 * These are learned from data, but we seed with common ones
 */
export const REGION_PREFIXES: Record<string, string> = {
    'us-east-1': 'USE1',
    'us-east-2': 'USE2',
    'us-west-1': 'USW1',
    'us-west-2': 'USW2',
    'eu-west-1': 'EUW1',
    'eu-west-2': 'EUW2',
    'eu-west-3': 'EUW3',
    'eu-central-1': 'EUC1',
    'eu-north-1': 'EUN1',
    'ap-northeast-1': 'APN1',
    'ap-northeast-2': 'APN2',
    'ap-northeast-3': 'APN3',
    'ap-southeast-1': 'APS1',
    'ap-southeast-2': 'APS2',
    'ap-south-1': 'APS3',
    'sa-east-1': 'SAE1',
    'ca-central-1': 'CAN1',
    'af-south-1': 'AFS1',
    'me-south-1': 'MES1',
};
