/**
 * Schema System Exports
 * 
 * This is the public API for the schema system.
 * All schema-related functionality MUST go through these exports.
 */

export * from './schema.contract';
export * from './schema.validator';
export * from './schema.engine';

// Re-export commonly used types
export type {
    ServiceSchema,
    FieldDefinition,
    FieldType,
    DependencyExpression,
    DependencyOperator,
    FieldGroup,
    UsageDimension,
    PricingDimension,
    CostFormula,
    ValidationResult,
    ValidationError,
} from './schema.contract';

export { schemaValidator } from './schema.validator';
export { SchemaEngine } from './schema.engine';
