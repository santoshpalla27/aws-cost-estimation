// Cost estimation API response types

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface UsageVector {
    resource_address: string;
    service: string;
    usage_type: string;
    operation?: string;
    region: string;
    unit: string;
    quantity: number;
    attributes?: Record<string, string>;
    confidence: Confidence;
    assumptions?: string[];
}

export interface PricedItem extends UsageVector {
    price_per_unit: number;
    monthly_cost: number;
    currency: string;
    match_confidence: Confidence;
    match_score: number;
    pricing_source: string;
    formula: string;
}

export interface ResourceCost {
    address: string;
    type: string;
    name: string;
    service: string;
    monthly_cost: number;
    confidence: Confidence;
    line_items: PricedItem[];
    assumptions?: string[];
}

export interface ServiceCost {
    service: string;
    monthly_cost: number;
    resource_count: number;
    confidence: Confidence;
}

export interface EstimateMetadata {
    catalog_version: string;
    input_hash: string;
    evaluated_at: string;
    engine_version: string;
}

export interface CostEstimate {
    total_monthly_cost: number;
    currency: string;
    by_service: Record<string, ServiceCost>;
    by_resource: ResourceCost[];
    overall_confidence: Confidence;
    assumptions: string[];
    warnings?: string[];
    metadata: EstimateMetadata;
}

export interface EstimateRequest {
    region: string;
    terraform_hcl?: string;
    terraform_zip?: string; // Base64 encoded
}
