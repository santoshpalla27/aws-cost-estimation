/**
 * Schema DSL Contract
 * 
 * This is the authoritative contract for all service schemas.
 * Schemas MUST conform to this contract.
 * The schema engine MUST enforce this contract.
 * 
 * NO UI LOGIC should exist outside of schema definitions.
 */

import { z } from 'zod';

/**
 * Field types supported by the schema system
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
    | 'eq'      // equals
    | 'ne'      // not equals
    | 'gt'      // greater than
    | 'gte'     // greater than or equal
    | 'lt'      // less than
    | 'lte'     // less than or equal
    | 'in'      // value in array
    | 'nin'     // value not in array
    | 'and'     // logical AND
    | 'or'      // logical OR
    | 'not'     // logical NOT
    | 'exists'  // field has value
    | 'empty';  // field is empty

/**
 * Dependency expression for conditional logic
 */
export interface DependencyExpression {
    operator: DependencyOperator;
    field?: string;
    value?: unknown;
    expressions?: DependencyExpression[];
}

/**
 * Field validation rules
 */
export interface FieldValidation {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    custom?: string; // Custom validation function name
}

/**
 * Field option for enum/multiselect
 */
export interface FieldOption {
    value: string | number;
    label: string;
    description?: string;
    disabled?: boolean;
}

/**
 * Field definition
 */
export interface FieldDefinition {
    id: string;
    label: string;
    type: FieldType;
    description?: string;

    // Can be static boolean or dynamic expression
    required: boolean | DependencyExpression;

    default?: unknown;
    validation?: FieldValidation;

    // For enum and multiselect
    options?: FieldOption[];
    optionsSource?: string; // Path to pricing data for dynamic options

    // Conditional visibility
    visibleWhen?: DependencyExpression;

    // Conditional enablement
    enabledWhen?: DependencyExpression;

    // Dependencies (must be satisfied for field to be valid)
    dependsOn?: DependencyExpression;

    // For object and array types
    fields?: FieldDefinition[];

    // Pricing attribute mapping
    pricingAttribute?: string;

    // Help text
    helpText?: string;

    // Warnings
    warnings?: Array<{
        condition: DependencyExpression;
        message: string;
        severity: 'info' | 'warning' | 'error';
    }>;
}

/**
 * Field group for UI organization
 */
export interface FieldGroup {
    id: string;
    label: string;
    description?: string;
    fields: string[]; // Field IDs
    collapsible?: boolean;
    defaultExpanded?: boolean;
    visibleWhen?: DependencyExpression;
}

/**
 * Usage dimension for cost modeling
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
    dependsOn?: string[]; // Other dimension IDs this depends on
    visibleWhen?: DependencyExpression; // Conditional visibility
}

/**
 * Pricing dimension mapping
 */
export interface PricingDimension {
    id: string;
    attribute: string; // Attribute name in pricing data
    source: string; // Path to pricing data file
    filters?: Record<string, unknown>; // Additional filters
    required?: boolean;
    condition?: DependencyExpression; // Only active if condition is true
}

/**
 * Cost formula
 */
export interface CostFormula {
    id: string;
    label: string;
    formula: string; // Expression to evaluate
    unit: string;
    description?: string;
    condition?: DependencyExpression; // Only calculate if condition is true
}

/**
 * Schema metadata
 */
export interface SchemaMetadata {
    displayName: string;
    description: string;
    category: string;
    icon?: string;
    documentation?: string;
    version: string;
}

/**
 * Complete service schema
 */
export interface ServiceSchema {
    service: string;
    version: string;
    metadata: SchemaMetadata;

    // Field definitions
    fields: FieldDefinition[];

    // Field grouping
    groups?: FieldGroup[];

    // Usage dimensions
    usage: UsageDimension[];

    // Pricing dimensions
    pricing: PricingDimension[];

    // Cost formulas
    formulas: CostFormula[];

    // Global validation rules
    validation?: {
        rules: Array<{
            condition: DependencyExpression;
            message: string;
            severity: 'error' | 'warning';
        }>;
    };
}

/**
 * Zod validators for runtime validation
 */

export const DependencyExpressionSchema: z.ZodType<DependencyExpression> = z.lazy(() =>
    z.object({
        operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'and', 'or', 'not', 'exists', 'empty']),
        field: z.string().optional(),
        value: z.unknown().optional(),
        expressions: z.array(DependencyExpressionSchema).optional(),
    })
);

export const FieldValidationSchema = z.object({
    required: z.boolean().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    custom: z.string().optional(),
});

export const FieldOptionSchema = z.object({
    value: z.union([z.string(), z.number()]),
    label: z.string(),
    description: z.string().optional(),
    disabled: z.boolean().optional(),
});

export const FieldDefinitionSchema: z.ZodType<FieldDefinition> = z.lazy(() =>
    z.object({
        id: z.string(),
        label: z.string(),
        type: z.enum(['string', 'number', 'boolean', 'enum', 'multiselect', 'object', 'array']),
        description: z.string().optional(),
        required: z.union([z.boolean(), DependencyExpressionSchema]), // Support dynamic required
        default: z.unknown().optional(),
        validation: FieldValidationSchema.optional(),
        options: z.array(FieldOptionSchema).optional(),
        optionsSource: z.string().optional(),
        visibleWhen: DependencyExpressionSchema.optional(),
        enabledWhen: DependencyExpressionSchema.optional(),
        dependsOn: DependencyExpressionSchema.optional(),
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
    visibleWhen: DependencyExpressionSchema.optional(),
});

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
    dependsOn: z.array(z.string()).optional(),
    visibleWhen: DependencyExpressionSchema.optional(), // Support conditional visibility
});

export const PricingDimensionSchema = z.object({
    id: z.string(),
    attribute: z.string(),
    source: z.string(),
    filters: z.record(z.unknown()).optional(),
    required: z.boolean().optional(),
    condition: DependencyExpressionSchema.optional(), // Support conditional activation
});

export const CostFormulaSchema = z.object({
    id: z.string(),
    label: z.string(),
    formula: z.string(),
    unit: z.string(),
    description: z.string().optional(),
    condition: DependencyExpressionSchema.optional(),
});

export const SchemaMetadataSchema = z.object({
    displayName: z.string(),
    description: z.string(),
    category: z.string(),
    icon: z.string().optional(),
    documentation: z.string().optional(),
    version: z.string(),
});

export const ServiceSchemaValidator = z.object({
    service: z.string(),
    version: z.string(),
    metadata: SchemaMetadataSchema,
    fields: z.array(FieldDefinitionSchema),
    groups: z.array(FieldGroupSchema).optional(),
    usage: z.array(UsageDimensionSchema),
    pricing: z.array(PricingDimensionSchema),
    formulas: z.array(CostFormulaSchema),
    validation: z.object({
        rules: z.array(z.object({
            condition: DependencyExpressionSchema,
            message: z.string(),
            severity: z.enum(['error', 'warning']),
        })),
    }).optional(),
});

/**
 * Validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: string[];
}

/**
 * Validation error
 */
export interface ValidationError {
    path: string;
    message: string;
    code: string;
}
