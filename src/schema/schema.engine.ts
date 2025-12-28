import {
    ServiceSchema,
    FieldDefinition,
    DependencyExpression,
    FieldGroup,
    UsageDimension,
    PricingDimension,
    CostFormula,
} from './schema.contract';
import { schemaValidator } from './schema.validator';

/**
 * Form state
 */
export interface FormState {
    [fieldId: string]: unknown;
}

/**
 * Schema Engine
 * 
 * This is the authoritative engine that enforces schema rules.
 * ALL UI rendering and validation MUST go through this engine.
 * 
 * NO hard-coded UI logic is allowed.
 */
export class SchemaEngine {
    private schema: ServiceSchema | null = null;
    private fieldMap: Map<string, FieldDefinition> = new Map();

    /**
     * Load and validate a schema
     */
    async load(schemaData: unknown): Promise<void> {
        // Validate schema
        const validation = schemaValidator.validate(schemaData);

        if (!validation.valid) {
            const errorMessages = validation.errors.map(e => `${e.path}: ${e.message}`).join('\n');
            throw new Error(`Schema validation failed:\n${errorMessages}`);
        }

        if (validation.warnings.length > 0) {
            console.warn('Schema validation warnings:');
            validation.warnings.forEach(w => console.warn(`  - ${w}`));
        }

        this.schema = schemaData as ServiceSchema;

        // Build field map for fast lookups
        this.buildFieldMap(this.schema.fields);

        console.log(`✓ Schema loaded: ${this.schema.service} v${this.schema.version}`);
    }

    /**
     * Build field map for fast lookups
     */
    private buildFieldMap(fields: FieldDefinition[]): void {
        fields.forEach(field => {
            this.fieldMap.set(field.id, field);

            // Recursively add nested fields
            if (field.fields) {
                this.buildFieldMap(field.fields);
            }
        });
    }

    /**
     * Get schema
     */
    getSchema(): ServiceSchema {
        if (!this.schema) {
            throw new Error('Schema not loaded');
        }
        return this.schema;
    }

    /**
     * Get field definition by ID
     */
    getField(fieldId: string): FieldDefinition | undefined {
        return this.fieldMap.get(fieldId);
    }

    /**
     * Get all fields
     */
    getFields(): FieldDefinition[] {
        if (!this.schema) {
            throw new Error('Schema not loaded');
        }
        return this.schema.fields;
    }

    /**
     * Get field groups
     */
    getGroups(): FieldGroup[] {
        if (!this.schema) {
            throw new Error('Schema not loaded');
        }
        return this.schema.groups || [];
    }

    /**
     * Get usage dimensions
     */
    getUsageDimensions(): UsageDimension[] {
        if (!this.schema) {
            throw new Error('Schema not loaded');
        }
        return this.schema.usage;
    }

    /**
     * Get ACTIVE usage dimensions based on current form state
     * STRICT: Only returns dimensions that should be visible
     */
    getActiveUsageDimensions(formState: FormState): UsageDimension[] {
        return this.getUsageDimensions().filter(dimension => {
            if (!dimension.visibleWhen) return true;
            return this.evaluateExpression(dimension.visibleWhen, formState);
        });
    }

    /**
     * Get pricing dimensions
     */
    getPricingDimensions(): PricingDimension[] {
        if (!this.schema) {
            throw new Error('Schema not loaded');
        }
        return this.schema.pricing;
    }

    /**
     * Get ACTIVE pricing dimensions based on current form state
     * STRICT: Only returns dimensions that should be active
     */
    getActivePricingDimensions(formState: FormState): PricingDimension[] {
        return this.getPricingDimensions().filter(dimension => {
            if (!dimension.condition) return true;
            return this.evaluateExpression(dimension.condition, formState);
        });
    }

    /**
     * Get cost formulas
     */
    getFormulas(): CostFormula[] {
        if (!this.schema) {
            throw new Error('Schema not loaded');
        }
        return this.schema.formulas;
    }

    /**
     * Get ACTIVE cost formulas based on current form state
     * STRICT: Only returns formulas whose conditions are met
     */
    getActiveFormulas(formState: FormState): CostFormula[] {
        return this.getFormulas().filter(formula => {
            if (!formula.condition) return true;
            return this.evaluateExpression(formula.condition, formState);
        });
    }

    /**
     * Check if field is visible based on current form state
     */
    isFieldVisible(fieldId: string, formState: FormState): boolean {
        const field = this.getField(fieldId);
        if (!field) return false;

        if (!field.visibleWhen) return true;

        return this.evaluateExpression(field.visibleWhen, formState);
    }

    /**
     * Check if field is enabled based on current form state
     * STRICT: Field must be visible to be enabled
     */
    isFieldEnabled(fieldId: string, formState: FormState): boolean {
        const field = this.getField(fieldId);
        if (!field) return false;

        // Must be visible to be enabled
        if (!this.isFieldVisible(fieldId, formState)) return false;

        if (!field.enabledWhen) return true;

        return this.evaluateExpression(field.enabledWhen, formState);
    }

    /**
     * Check if field is required based on current form state
     * STRICT: Supports both static boolean and dynamic expression
     */
    isFieldRequired(fieldId: string, formState: FormState): boolean {
        const field = this.getField(fieldId);
        if (!field) return false;

        // Static requirement
        if (typeof field.required === 'boolean') {
            return field.required;
        }

        // Dynamic requirement (DependencyExpression)
        return this.evaluateExpression(field.required, formState);
    }

    /**
     * Check if field dependencies are satisfied
     */
    areDependenciesSatisfied(fieldId: string, formState: FormState): boolean {
        const field = this.getField(fieldId);
        if (!field) return false;

        if (!field.dependsOn) return true;

        return this.evaluateExpression(field.dependsOn, formState);
    }

    /**
     * Get visible fields for current form state
     */
    getVisibleFields(formState: FormState): FieldDefinition[] {
        return this.getFields().filter(field => this.isFieldVisible(field.id, formState));
    }

    /**
     * Get visible groups for current form state
     */
    getVisibleGroups(formState: FormState): FieldGroup[] {
        return this.getGroups().filter(group => {
            if (!group.visibleWhen) return true;
            return this.evaluateExpression(group.visibleWhen, formState);
        });
    }

    /**
     * Evaluate dependency expression
     */
    evaluateExpression(expr: DependencyExpression, formState: FormState): boolean {
        switch (expr.operator) {
            case 'eq':
                return formState[expr.field!] === expr.value;

            case 'ne':
                return formState[expr.field!] !== expr.value;

            case 'gt':
                return Number(formState[expr.field!]) > Number(expr.value);

            case 'gte':
                return Number(formState[expr.field!]) >= Number(expr.value);

            case 'lt':
                return Number(formState[expr.field!]) < Number(expr.value);

            case 'lte':
                return Number(formState[expr.field!]) <= Number(expr.value);

            case 'in':
                return Array.isArray(expr.value) && expr.value.includes(formState[expr.field!]);

            case 'nin':
                return Array.isArray(expr.value) && !expr.value.includes(formState[expr.field!]);

            case 'exists':
                return formState[expr.field!] !== undefined && formState[expr.field!] !== null && formState[expr.field!] !== '';

            case 'empty':
                return formState[expr.field!] === undefined || formState[expr.field!] === null || formState[expr.field!] === '';

            case 'and':
                return expr.expressions?.every(e => this.evaluateExpression(e, formState)) ?? false;

            case 'or':
                return expr.expressions?.some(e => this.evaluateExpression(e, formState)) ?? false;

            case 'not':
                return expr.expressions ? !this.evaluateExpression(expr.expressions[0], formState) : false;

            default:
                console.warn(`Unknown operator: ${expr.operator}`);
                return false;
        }
    }

    /**
     * Get field warnings for current state
     */
    getFieldWarnings(fieldId: string, formState: FormState): Array<{ message: string; severity: string }> {
        const field = this.getField(fieldId);
        if (!field || !field.warnings) return [];

        return field.warnings
            .filter(warning => this.evaluateExpression(warning.condition, formState))
            .map(warning => ({
                message: warning.message,
                severity: warning.severity,
            }));
    }

    /**
     * Validate form state
     */
    validateForm(formState: FormState): { valid: boolean; errors: Record<string, string[]> } {
        const errors: Record<string, string[]> = {};

        for (const field of this.getFields()) {
            const fieldErrors: string[] = [];

            // Check if field is visible
            if (!this.isFieldVisible(field.id, formState)) {
                continue;
            }

            const value = formState[field.id];

            // Required validation (STRICT: use isFieldRequired for dynamic support)
            if (this.isFieldRequired(field.id, formState) && (value === undefined || value === null || value === '')) {
                fieldErrors.push(`${field.label} is required`);
            }

            // Type-specific validation
            if (value !== undefined && value !== null && value !== '') {
                if (field.type === 'number') {
                    const numValue = Number(value);
                    if (isNaN(numValue)) {
                        fieldErrors.push(`${field.label} must be a number`);
                    } else if (field.validation) {
                        if (field.validation.min !== undefined && numValue < field.validation.min) {
                            fieldErrors.push(`${field.label} must be at least ${field.validation.min}`);
                        }
                        if (field.validation.max !== undefined && numValue > field.validation.max) {
                            fieldErrors.push(`${field.label} must be at most ${field.validation.max}`);
                        }
                    }
                }

                if (field.type === 'string' && field.validation) {
                    const strValue = String(value);
                    if (field.validation.minLength && strValue.length < field.validation.minLength) {
                        fieldErrors.push(`${field.label} must be at least ${field.validation.minLength} characters`);
                    }
                    if (field.validation.maxLength && strValue.length > field.validation.maxLength) {
                        fieldErrors.push(`${field.label} must be at most ${field.validation.maxLength} characters`);
                    }
                    if (field.validation.pattern) {
                        const regex = new RegExp(field.validation.pattern);
                        if (!regex.test(strValue)) {
                            fieldErrors.push(`${field.label} format is invalid`);
                        }
                    }
                }
            }

            // Dependency validation
            if (!this.areDependenciesSatisfied(field.id, formState)) {
                fieldErrors.push(`${field.label} has unsatisfied dependencies`);
            }

            if (fieldErrors.length > 0) {
                errors[field.id] = fieldErrors;
            }
        }

        return {
            valid: Object.keys(errors).length === 0,
            errors,
        };
    }

    /**
     * Get default form state
     */
    getDefaultFormState(): FormState {
        const state: FormState = {};

        for (const field of this.getFields()) {
            if (field.default !== undefined) {
                state[field.id] = field.default;
            }
        }

        return state;
    }
}
