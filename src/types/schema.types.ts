import { z } from 'zod';

/**
 * Field Types supported by the schema system
 */
export type FieldType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'enum'
    | 'multiselect'
    | 'object'
    | 'array';

/**
 * Dependency expression operators
 */
export type DependencyOperator =
    | 'eq'    // equals
    | 'ne'    // not equals
    | 'gt'    // greater than
    | 'gte'   // greater than or equal
    | 'lt'    // less than
    | 'lte'   // less than or equal
    | 'in'    // value in array
    | 'nin'   // value not in array
    | 'and'   // logical AND
    | 'or'    // logical OR
    | 'not';  // logical NOT

/**
 * Dependency rule expression
 */
export interface DependencyExpression {
    operator: DependencyOperator;
    field?: string;
    value?: unknown;
    expressions?: DependencyExpression[];
}

/**
 * Usage dimension configuration
 */
export interface UsageDimension {
    id: string;
    label: string;
    unit: string;
    type: 'slider' | 'input' | 'calculated';
    min?: number;
    max?: number;
    default: number;
    step?: number;
    presets?: {
        low: number;
        medium: number;
        high: number;
    };
    description?: string;
    formula?: string; // For calculated dimensions
}

/**
 * Pricing dimension mapping
 */
export interface PricingDimension {
    attribute: string;
    source: string; // Path to pricing data file
    filters?: Record<string, unknown>;
}

/**
 * Cost formula definition
 */
export interface CostFormula {
    id: string;
    label: string;
    formula: string; // Expression like "usage.hours * pricing.hourly"
    unit: string;
    description?: string;
}

/**
 * Field validation rules
 */
export interface FieldValidation {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    custom?: string; // Custom validation function name
}

/**
 * Field definition in schema
 */
export interface FieldDefinition {
    id: string;
    label: string;
    type: FieldType;
    description?: string;
    required: boolean;
    default?: unknown;
    validation?: FieldValidation;

    // For enum and multiselect
    options?: Array<{
        value: string | number;
        label: string;
        description?: string;
    }>;

    // Dynamic options from pricing data
    optionsSource?: string;

    // Dependency rules
    dependsOn?: DependencyExpression;

    // Conditional visibility
    visibleWhen?: DependencyExpression;

    // For object and array types
    fields?: FieldDefinition[];

    // Pricing attribute mapping
    pricingAttribute?: string;

    // Help text
    helpText?: string;

    // Warning messages
    warnings?: Array<{
        condition: DependencyExpression;
        message: string;
        severity: 'info' | 'warning' | 'error';
    }>;
}

/**
 * Service category grouping
 */
export interface FieldGroup {
    id: string;
    label: string;
    description?: string;
    fields: string[]; // Field IDs
    collapsible?: boolean;
    defaultExpanded?: boolean;
}

/**
 * Complete service schema definition
 */
export interface ServiceSchema {
    service: string;
    version: string;
    metadata: {
        displayName: string;
        description: string;
        category: string;
        icon?: string;
        documentation?: string;
    };

    // Field definitions
    fields: FieldDefinition[];

    // Field grouping for UI
    groups?: FieldGroup[];

    // Usage dimensions
    usage: UsageDimension[];

    // Pricing dimensions
    pricing: PricingDimension[];

    // Cost formulas
    formulas: CostFormula[];

    // Global dependencies
    dependencies?: DependencyExpression[];

    // Validation rules
    validation?: {
        rules: Array<{
            condition: DependencyExpression;
            message: string;
            severity: 'error' | 'warning';
        }>;
    };
}

/**
 * Zod schema for runtime validation
 */
export const DependencyExpressionSchema: z.ZodType<DependencyExpression> = z.lazy(() =>
    z.object({
        operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'and', 'or', 'not']),
        field: z.string().optional(),
        value: z.unknown().optional(),
        expressions: z.array(DependencyExpressionSchema).optional(),
    })
);

export const UsageDimensionSchema = z.object({
    id: z.string(),
    label: z.string(),
    unit: z.string(),
    type: z.enum(['slider', 'input', 'calculated']),
    min: z.number().optional(),
    max: z.number().optional(),
    default: z.number(),
    step: z.number().optional(),
    presets: z.object({
        low: z.number(),
        medium: z.number(),
        high: z.number(),
    }).optional(),
    description: z.string().optional(),
    formula: z.string().optional(),
});

export const PricingDimensionSchema = z.object({
    attribute: z.string(),
    source: z.string(),
    filters: z.record(z.unknown()).optional(),
});

export const CostFormulaSchema = z.object({
    id: z.string(),
    label: z.string(),
    formula: z.string(),
    unit: z.string(),
    description: z.string().optional(),
});

export const FieldValidationSchema = z.object({
    required: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    custom: z.string().optional(),
});

export const FieldDefinitionSchema: z.ZodType<FieldDefinition> = z.lazy(() =>
    z.object({
        id: z.string(),
        label: z.string(),
        type: z.enum(['string', 'number', 'boolean', 'enum', 'multiselect', 'object', 'array']),
        description: z.string().optional(),
        required: z.boolean(),
        default: z.unknown().optional(),
        validation: FieldValidationSchema.optional(),
        options: z.array(z.object({
            value: z.union([z.string(), z.number()]),
            label: z.string(),
            description: z.string().optional(),
        })).optional(),
        optionsSource: z.string().optional(),
        dependsOn: DependencyExpressionSchema.optional(),
        visibleWhen: DependencyExpressionSchema.optional(),
        fields: z.array(FieldDefinitionSchema).optional(),
        pricingAttribute: z.string().optional(),
        helpText: z.string().optional(),
        warnings: z.array(z.object({
            condition: DependencyExpressionSchema,
            message: z.string(),
            severity: z.enum(['info', 'warning', 'error']),
        })).optional(),
    })
);

export const FieldGroupSchema = z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    fields: z.array(z.string()),
    collapsible: z.boolean().optional(),
    defaultExpanded: z.boolean().optional(),
});

export const ServiceSchemaValidator = z.object({
    service: z.string(),
    version: z.string(),
    metadata: z.object({
        displayName: z.string(),
        description: z.string(),
        category: z.string(),
        icon: z.string().optional(),
        documentation: z.string().optional(),
    }),
    fields: z.array(FieldDefinitionSchema),
    groups: z.array(FieldGroupSchema).optional(),
    usage: z.array(UsageDimensionSchema),
    pricing: z.array(PricingDimensionSchema),
    formulas: z.array(CostFormulaSchema),
    dependencies: z.array(DependencyExpressionSchema).optional(),
    validation: z.object({
        rules: z.array(z.object({
            condition: DependencyExpressionSchema,
            message: z.string(),
            severity: z.enum(['error', 'warning']),
        })),
    }).optional(),
});

/**
 * Form state for a service configuration
 */
export interface ServiceFormState {
    service: string;
    region: string;
    fields: Record<string, unknown>;
    usage: Record<string, number>;
}

/**
 * Cost breakdown line item
 */
export interface CostLineItem {
    id: string;
    label: string;
    formula: string;
    usage: Record<string, number>;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    unit: string;
    details?: string;
}

/**
 * Complete cost estimate
 */
export interface CostEstimate {
    service: string;
    region: string;
    lineItems: CostLineItem[];
    subtotal: number;
    total: number;
    currency: string;
    period: 'monthly' | 'annual';
    timestamp: string;
    assumptions: string[];
}

/**
 * Pricing data structure
 */
export interface PricingData {
    service: string;
    region: string;
    version: string;
    lastUpdated: string;
    data: Record<string, unknown>;
}
