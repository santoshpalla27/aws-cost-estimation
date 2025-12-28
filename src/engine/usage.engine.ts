import { UsageDimension } from '@types/schema.types';

/**
 * Usage preset profiles
 */
export type UsageProfile = 'low' | 'medium' | 'high' | 'custom';

/**
 * Usage state for a service
 */
export interface UsageState {
    [dimensionId: string]: number;
}

/**
 * Usage Modeling Engine
 * 
 * Manages usage dimensions, presets, and calculated values
 */
export class UsageEngine {
    private dimensions: Map<string, UsageDimension> = new Map();
    private usageState: UsageState = {};

    /**
     * Initialize with usage dimensions from schema
     */
    initialize(dimensions: UsageDimension[]): void {
        this.dimensions.clear();
        this.usageState = {};

        for (const dimension of dimensions) {
            this.dimensions.set(dimension.id, dimension);
            this.usageState[dimension.id] = dimension.default;
        }
    }

    /**
     * Get current usage state
     */
    getUsageState(): UsageState {
        return { ...this.usageState };
    }

    /**
     * Set usage value for a dimension
     */
    setUsage(dimensionId: string, value: number): void {
        const dimension = this.dimensions.get(dimensionId);

        if (!dimension) {
            throw new Error(`Unknown usage dimension: ${dimensionId}`);
        }

        // Validate range
        if (dimension.min !== undefined && value < dimension.min) {
            throw new Error(`Value ${value} is below minimum ${dimension.min} for ${dimensionId}`);
        }

        if (dimension.max !== undefined && value > dimension.max) {
            throw new Error(`Value ${value} exceeds maximum ${dimension.max} for ${dimensionId}`);
        }

        this.usageState[dimensionId] = value;

        // Recalculate dependent dimensions
        this.recalculateDependent();
    }

    /**
     * Apply a usage profile preset
     */
    applyProfile(profile: UsageProfile): void {
        if (profile === 'custom') {
            return; // Keep current values
        }

        for (const [id, dimension] of this.dimensions) {
            if (dimension.type === 'calculated') {
                continue; // Skip calculated dimensions
            }

            if (dimension.presets && dimension.presets[profile] !== undefined) {
                this.usageState[id] = dimension.presets[profile];
            }
        }

        this.recalculateDependent();
    }

    /**
     * Get usage value for a dimension
     */
    getUsage(dimensionId: string): number {
        return this.usageState[dimensionId] ?? 0;
    }

    /**
     * Get dimension definition
     */
    getDimension(dimensionId: string): UsageDimension | undefined {
        return this.dimensions.get(dimensionId);
    }

    /**
     * Get all dimensions
     */
    getAllDimensions(): UsageDimension[] {
        return Array.from(this.dimensions.values());
    }

    /**
     * Recalculate all calculated dimensions
     */
    private recalculateDependent(): void {
        for (const [id, dimension] of this.dimensions) {
            if (dimension.type === 'calculated' && dimension.formula) {
                try {
                    const value = this.evaluateFormula(dimension.formula);
                    this.usageState[id] = value;
                } catch (error) {
                    console.error(`Error calculating ${id}:`, error);
                    this.usageState[id] = 0;
                }
            }
        }
    }

    /**
     * Evaluate a usage formula
     * Formula can reference other usage dimensions
     * Example: "hours * instances" or "gb_in + gb_out"
     */
    private evaluateFormula(formula: string): number {
        // Create a safe evaluation context
        const context: Record<string, number> = {};

        for (const [id, value] of Object.entries(this.usageState)) {
            context[id] = value;
        }

        // Add common constants
        context.HOURS_PER_MONTH = 730; // Average hours per month
        context.DAYS_PER_MONTH = 30.42; // Average days per month
        context.GB_TO_TB = 1024;

        try {
            // Simple formula evaluation using Function constructor
            // This is safe because formulas come from trusted schemas, not user input
            const func = new Function(...Object.keys(context), `return ${formula};`);
            const result = func(...Object.values(context));

            return typeof result === 'number' && !isNaN(result) ? result : 0;
        } catch (error) {
            console.error(`Formula evaluation error: ${formula}`, error);
            return 0;
        }
    }

    /**
     * Validate current usage state
     */
    validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        for (const [id, dimension] of this.dimensions) {
            const value = this.usageState[id];

            if (dimension.min !== undefined && value < dimension.min) {
                errors.push(`${dimension.label} must be at least ${dimension.min} ${dimension.unit}`);
            }

            if (dimension.max !== undefined && value > dimension.max) {
                errors.push(`${dimension.label} cannot exceed ${dimension.max} ${dimension.unit}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Get usage summary for display
     */
    getSummary(): Array<{
        id: string;
        label: string;
        value: number;
        unit: string;
        type: string;
    }> {
        return Array.from(this.dimensions.values()).map(dimension => ({
            id: dimension.id,
            label: dimension.label,
            value: this.usageState[dimension.id] ?? 0,
            unit: dimension.unit,
            type: dimension.type,
        }));
    }

    /**
     * Reset to defaults
     */
    reset(): void {
        for (const [id, dimension] of this.dimensions) {
            this.usageState[id] = dimension.default;
        }
        this.recalculateDependent();
    }

    /**
     * Export usage state
     */
    export(): UsageState {
        return { ...this.usageState };
    }

    /**
     * Import usage state
     */
    import(state: UsageState): void {
        for (const [id, value] of Object.entries(state)) {
            if (this.dimensions.has(id)) {
                this.usageState[id] = value;
            }
        }
        this.recalculateDependent();
    }
}

// Create singleton instance
export const usageEngine = new UsageEngine();
