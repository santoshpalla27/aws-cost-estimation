import {
    ServiceSchema,
    ServiceSchemaValidator,
    ValidationResult,
    ValidationError,
    FieldDefinition,
    DependencyExpression,
} from './schema.contract';

/**
 * Schema Validator
 * 
 * Validates schemas against the contract and enforces rules
 */
export class SchemaValidator {
    /**
     * Validate a service schema
     */
    validate(schema: unknown): ValidationResult {
        const errors: ValidationError[] = [];
        const warnings: string[] = [];

        // Zod validation
        const zodResult = ServiceSchemaValidator.safeParse(schema);

        if (!zodResult.success) {
            zodResult.error.errors.forEach(err => {
                errors.push({
                    path: err.path.join('.'),
                    message: err.message,
                    code: err.code,
                });
            });

            return { valid: false, errors, warnings };
        }

        const validSchema = zodResult.data as ServiceSchema;

        // Additional semantic validation
        this.validateFieldReferences(validSchema, errors, warnings);
        this.validateDependencyCycles(validSchema, errors);
        this.validatePricingMappings(validSchema, errors, warnings);
        this.validateFormulas(validSchema, errors, warnings);
        this.validateUsageDimensions(validSchema, errors, warnings);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validate that all field references exist
     */
    private validateFieldReferences(
        schema: ServiceSchema,
        errors: ValidationError[],
        warnings: string[]
    ): void {
        const fieldIds = new Set(schema.fields.map(f => f.id));

        // Check groups reference valid fields
        schema.groups?.forEach(group => {
            group.fields.forEach(fieldId => {
                if (!fieldIds.has(fieldId)) {
                    errors.push({
                        path: `groups.${group.id}.fields`,
                        message: `Field '${fieldId}' does not exist`,
                        code: 'invalid_field_reference',
                    });
                }
            });
        });

        // Check dependency expressions reference valid fields
        schema.fields.forEach(field => {
            this.validateExpressionFields(field.visibleWhen, fieldIds, `fields.${field.id}.visibleWhen`, errors);
            this.validateExpressionFields(field.enabledWhen, fieldIds, `fields.${field.id}.enabledWhen`, errors);
            this.validateExpressionFields(field.dependsOn, fieldIds, `fields.${field.id}.dependsOn`, errors);
        });
    }

    /**
     * Validate fields referenced in expressions exist
     */
    private validateExpressionFields(
        expr: DependencyExpression | undefined,
        validFields: Set<string>,
        path: string,
        errors: ValidationError[]
    ): void {
        if (!expr) return;

        if (expr.field && !validFields.has(expr.field)) {
            errors.push({
                path,
                message: `Referenced field '${expr.field}' does not exist`,
                code: 'invalid_field_reference',
            });
        }

        expr.expressions?.forEach((subExpr, index) => {
            this.validateExpressionFields(subExpr, validFields, `${path}.expressions[${index}]`, errors);
        });
    }

    /**
     * Validate there are no circular dependencies
     */
    private validateDependencyCycles(
        schema: ServiceSchema,
        errors: ValidationError[]
    ): void {
        const graph = new Map<string, Set<string>>();

        // Build dependency graph
        schema.fields.forEach(field => {
            const deps = new Set<string>();
            this.extractFieldDependencies(field.dependsOn, deps);
            this.extractFieldDependencies(field.visibleWhen, deps);
            this.extractFieldDependencies(field.enabledWhen, deps);
            graph.set(field.id, deps);
        });

        // Detect cycles
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const detectCycle = (fieldId: string, path: string[]): boolean => {
            visited.add(fieldId);
            recursionStack.add(fieldId);

            const deps = graph.get(fieldId) || new Set();

            for (const dep of deps) {
                if (!visited.has(dep)) {
                    if (detectCycle(dep, [...path, dep])) {
                        return true;
                    }
                } else if (recursionStack.has(dep)) {
                    errors.push({
                        path: `fields.${fieldId}`,
                        message: `Circular dependency detected: ${[...path, dep].join(' → ')}`,
                        code: 'circular_dependency',
                    });
                    return true;
                }
            }

            recursionStack.delete(fieldId);
            return false;
        };

        for (const fieldId of graph.keys()) {
            if (!visited.has(fieldId)) {
                detectCycle(fieldId, [fieldId]);
            }
        }
    }

    /**
     * Extract field dependencies from expression
     */
    private extractFieldDependencies(
        expr: DependencyExpression | undefined,
        deps: Set<string>
    ): void {
        if (!expr) return;

        if (expr.field) {
            deps.add(expr.field);
        }

        expr.expressions?.forEach(subExpr => {
            this.extractFieldDependencies(subExpr, deps);
        });
    }

    /**
     * Validate pricing mappings
     */
    private validatePricingMappings(
        schema: ServiceSchema,
        errors: ValidationError[],
        warnings: string[]
    ): void {
        const pricingIds = new Set(schema.pricing.map(p => p.id));

        // Check that fields with pricingAttribute have corresponding pricing dimension
        schema.fields.forEach(field => {
            if (field.pricingAttribute && !pricingIds.has(field.pricingAttribute)) {
                warnings.push(
                    `Field '${field.id}' references pricing attribute '${field.pricingAttribute}' which is not defined`
                );
            }
        });

        // Check pricing dimensions have valid sources
        schema.pricing.forEach(pricing => {
            if (!pricing.source) {
                errors.push({
                    path: `pricing.${pricing.id}`,
                    message: 'Pricing source is required',
                    code: 'missing_pricing_source',
                });
            }
        });
    }

    /**
     * Validate formulas
     */
    private validateFormulas(
        schema: ServiceSchema,
        errors: ValidationError[],
        warnings: string[]
    ): void {
        const fieldIds = new Set(schema.fields.map(f => f.id));
        const usageIds = new Set(schema.usage.map(u => u.id));
        const pricingIds = new Set(schema.pricing.map(p => p.id));

        schema.formulas.forEach(formula => {
            // Basic syntax check
            if (!formula.formula || formula.formula.trim() === '') {
                errors.push({
                    path: `formulas.${formula.id}`,
                    message: 'Formula expression is empty',
                    code: 'empty_formula',
                });
            }

            // Check for common formula errors
            if (formula.formula.includes('undefined')) {
                warnings.push(`Formula '${formula.id}' contains 'undefined' - may cause runtime errors`);
            }

            // Validate condition if present
            if (formula.condition) {
                this.validateExpressionFields(formula.condition, fieldIds, `formulas.${formula.id}.condition`, errors);
            }
        });
    }

    /**
     * Validate usage dimensions
     */
    private validateUsageDimensions(
        schema: ServiceSchema,
        errors: ValidationError[],
        warnings: string[]
    ): void {
        const usageIds = new Set<string>();

        schema.usage.forEach(dimension => {
            // Check for duplicate IDs
            if (usageIds.has(dimension.id)) {
                errors.push({
                    path: `usage.${dimension.id}`,
                    message: `Duplicate usage dimension ID: ${dimension.id}`,
                    code: 'duplicate_usage_id',
                });
            }
            usageIds.add(dimension.id);

            // Validate calculated dimensions
            if (dimension.type === 'calculated') {
                if (!dimension.formula) {
                    errors.push({
                        path: `usage.${dimension.id}`,
                        message: 'Calculated dimension must have a formula',
                        code: 'missing_formula',
                    });
                }
            }

            // Validate ranges
            if (dimension.min !== undefined && dimension.max !== undefined) {
                if (dimension.min > dimension.max) {
                    errors.push({
                        path: `usage.${dimension.id}`,
                        message: `Min value (${dimension.min}) is greater than max value (${dimension.max})`,
                        code: 'invalid_range',
                    });
                }
            }

            // Validate default is within range
            if (dimension.min !== undefined && dimension.default < dimension.min) {
                errors.push({
                    path: `usage.${dimension.id}`,
                    message: `Default value (${dimension.default}) is below minimum (${dimension.min})`,
                    code: 'invalid_default',
                });
            }

            if (dimension.max !== undefined && dimension.default > dimension.max) {
                errors.push({
                    path: `usage.${dimension.id}`,
                    message: `Default value (${dimension.default}) exceeds maximum (${dimension.max})`,
                    code: 'invalid_default',
                });
            }

            // Validate presets
            if (dimension.presets) {
                const { low, medium, high } = dimension.presets;
                if (low > medium || medium > high) {
                    warnings.push(`Usage dimension '${dimension.id}' presets are not in ascending order`);
                }
            }
        });

        // Validate dependsOn references
        schema.usage.forEach(dimension => {
            dimension.dependsOn?.forEach(depId => {
                if (!usageIds.has(depId)) {
                    errors.push({
                        path: `usage.${dimension.id}.dependsOn`,
                        message: `Referenced usage dimension '${depId}' does not exist`,
                        code: 'invalid_usage_reference',
                    });
                }
            });
        });
    }
}

// Singleton instance
export const schemaValidator = new SchemaValidator();
