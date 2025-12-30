/**
 * AWS Pricing Data Types
 * Type-safe representations of AWS pricing structures
 */

// ============================================================================
// AWS Offer Index Types
// ============================================================================

export interface OfferIndex {
    formatVersion: string;
    disclaimer: string;
    publicationDate: string;
    offers: Record<string, OfferEntry>;
}

export interface OfferEntry {
    offerCode: string;
    versionIndexUrl: string;
    currentVersionUrl: string;
    currentRegionIndexUrl?: string;
}

// ============================================================================
// AWS Pricing File Types
// ============================================================================

export interface PricingFile {
    formatVersion: string;
    disclaimer: string;
    offerCode: string;
    version: string;
    publicationDate: string;
    products: Record<string, Product>;
    terms: Terms;
}

export interface Product {
    sku: string;
    productFamily?: string;
    attributes: Record<string, string>;
}

export interface Terms {
    OnDemand?: Record<string, Record<string, TermDetail>>;
    Reserved?: Record<string, Record<string, TermDetail>>;
}

export interface TermDetail {
    offerTermCode: string;
    sku: string;
    effectiveDate: string;
    priceDimensions: Record<string, PriceDimension>;
    termAttributes?: Record<string, string>;
}

export interface PriceDimension {
    rateCode: string;
    description: string;
    beginRange: string;
    endRange: string;
    unit: string;
    pricePerUnit: Record<string, string>;
    appliesTo?: string[];
}

// ============================================================================
// Normalized Pricing Types (Our Internal Format)
// ============================================================================

export interface NormalizedPricingDimension {
    catalogVersionId: number;
    service: string;
    regionCode: string;
    usageType: string;
    operation: string | null;
    unit: string;
    pricePerUnit: number;
    currency: string;
    beginRange: number | null;
    endRange: number | null;
    termType: 'OnDemand' | 'Reserved' | 'Spot';
    sku: string;
    rateCode: string;
    description: string;
    productFamily: string | null;
    attributes: Record<string, string>;
}

export interface AttributeMapping {
    mappingType: string;
    sourceValue: string;
    targetValue: string;
    catalogVersionId: number;
}

export interface CatalogVersion {
    id?: number;
    service: string;
    sourceUrl: string;
    versionHash: string;
    etag: string | null;
    publicationDate: string;
    ingestedAt?: Date;
    recordCount?: number;
    status: 'pending' | 'ingesting' | 'completed' | 'failed';
    errorMessage?: string;
}

// ============================================================================
// Ingestion Types
// ============================================================================

export interface IngestionConfig {
    services?: string[];
    concurrency: number;
    batchSize: number;
    forceRefresh: boolean;
}

export interface IngestionResult {
    service: string;
    success: boolean;
    recordCount: number;
    duration: number;
    error?: string;
}

export interface IngestionStats {
    totalServices: number;
    successCount: number;
    failureCount: number;
    totalRecords: number;
    totalDuration: number;
    results: IngestionResult[];
}

// ============================================================================
// Stream Processing Types
// ============================================================================

export interface StreamContext {
    service: string;
    catalogVersionId: number;
    productMap: Map<string, Product>;
    stats: {
        productsProcessed: number;
        termsProcessed: number;
        dimensionsEmitted: number;
    };
}

export type TermType = 'OnDemand' | 'Reserved';
