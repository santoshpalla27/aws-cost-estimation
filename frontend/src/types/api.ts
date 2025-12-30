// API Type Definitions

export type EvaluationMode = 'STRICT' | 'CONSERVATIVE' | 'OPTIMISTIC';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export type MatchType = 'EXACT' | 'FALLBACK' | 'HEURISTIC';

export type PolicyOutcome = 'PASS' | 'WARN' | 'FAIL';

export interface Resource {
    address: string;
    type: string;
    name: string;
    index?: number | string;
    provider: string;
    region: string;
    attributes: Record<string, any>;
    is_mocked: boolean;
    mock_metadata?: MockAnnotation[];
}

export interface MockAnnotation {
    field: string;
    value: any;
    reason: string;
    confidence: ConfidenceLevel;
}

export interface CostItem {
    resource_address: string;
    service: string;
    region: string;
    usage_type: string;
    quantity: number;
    unit: string;
    price_per_unit: number;
    total_cost: number;
    sku?: string;
    confidence: ConfidenceLevel;
    match_type: MatchType;
    explanation?: string;
}

export interface Estimate {
    id: string;
    input_hash: string;
    catalog_version: string;
    total_cost: number;
    currency: string;
    confidence: ConfidenceLevel;
    service_breakdown: Record<string, number>;
    resources: Resource[];
    cost_items: CostItem[];
    assumptions: string[];
    evaluation_mode?: EvaluationMode;
}

export interface EstimateResponse {
    estimate: Estimate;
}

export interface PolicyResult {
    policy_name: string;
    outcome: PolicyOutcome;
    message: string;
    actual_value?: number;
    threshold?: number;
}

export interface PolicyResponse {
    results: PolicyResult[];
    has_violations: boolean;
    has_warnings: boolean;
}

export interface ResourceDiff {
    address: string;
    before_cost: number;
    after_cost: number;
    delta: number;
    percent_change: number;
    status: 'added' | 'removed' | 'modified' | 'unchanged';
}

export interface DiffResponse {
    diff: {
        before_total: number;
        after_total: number;
        total_delta: number;
        percent_change: number;
        service_deltas?: Record<string, number>;
        resource_changes?: ResourceDiff[];
    };
}

export interface ApiError {
    error: {
        code: string;
        message: string;
        status: number;
        details?: Record<string, any>;
    };
}

export interface UploadConfig {
    evaluation_mode: EvaluationMode;
    exclude_terraform_dir?: boolean;
}
