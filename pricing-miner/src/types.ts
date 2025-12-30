export interface PricingCatalogVersion {
    versionId: string;
    service: string;
    regionCode: string;
    sourceUrl: string;
    publishedAt: Date | null;
    ingestedAt: Date;
    fileHash: string;
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    rowCount?: number;
    errorMessage?: string;
}

export interface PricingDimension {
    catalogVersion: string;
    service: string;
    regionCode: string;
    sku: string;
    usageType: string;
    operation: string | null;
    unit: string;
    pricePerUnit: number;
    beginRange: number;
    endRange: number | null;
    termType: string;
    leaseContractLength: string | null;
    purchaseOption: string | null;
    offeringClass: string | null;
    effectiveDate: Date;
    attributes: Record<string, any>;
}

export interface ParsedPrice {
    sku: string;
    service: string;
    regionCode: string;
    productFamily: string;
    attributes: Record<string, any>;
    usageType: string;
    operation: string | null;
    unit: string;
    pricePerUnit: number;
    beginRange: number;
    endRange: number | null;
    termType: 'OnDemand' | 'Reserved';
    leaseContractLength: string | null;
    purchaseOption: string | null;
    offeringClass: string | null;
    effectiveDate: Date;
}

export interface AttributeMapping {
    mappingType: string;
    inputCode: string;
    targetValue: string;
    service: string | null;
}

// AWS Pricing API format
export interface AWSPricingCatalog {
    formatVersion: string;
    publicationDate: string;
    products: Record<string, AWSProduct>;
    terms: {
        OnDemand?: Record<string, Record<string, AWSTerm>>;
        Reserved?: Record<string, Record<string, AWSTerm>>;
    };
}

export interface AWSProduct {
    sku: string;
    productFamily: string;
    attributes: Record<string, string>;
}

export interface AWSTerm {
    offerTermCode: string;
    sku: string;
    effectiveDate: string;
    priceDimensions: Record<string, AWSPriceDimension>;
    termAttributes?: Record<string, string>;
}

export interface AWSPriceDimension {
    unit: string;
    endRange?: string;
    description: string;
    appliesTo: string[];
    rateCode: string;
    beginRange?: string;
    pricePerUnit: Record<string, string>;
}
