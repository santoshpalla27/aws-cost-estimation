import { UsageDimension } from '@/schema/schema.contract';

/**
 * Usage state - current values for all usage dimensions
 */
export interface UsageState {
    [dimensionId: string]: number;
}

/**
 * Usage preset profile
 */
export type UsagePreset = 'low' | 'medium' | 'high';

/**
 * Usage tier for tiered pricing calculations
 */
export interface UsageTier {
    min: number;
    max?: number; // undefined means infinity
    rate: number;
}

/**
 * Tiered usage breakdown
 */
export interface TieredUsageBreakdown {
    total: number;
    tiers: Array<{
        min: number;
        max: number | undefined;
        usage: number;
        rate: number;
        cost: number;
    }>;
}

/**
 * Usage Engine
 * 
 * Manages usage dimensions and their values.
 * Completely generic - no service-specific logic.
 */
export class UsageEngine {
    private dimensions: Map<string, UsageDimension> = new Map();
    private state: UsageState = {};

    /**
     * Initialize with usage dimensions from schema
     */
    initialize(dimensions: UsageDimension[]): void {
        this.dimensions.clear();
        this.state = {};

        for (const dimension of dimensions) {
            this.dimensions.set(dimension.id, dimension);
            this.state[dimension.id] = dimension.default;
        }

        // Calculate any calculated dimensions
        this.recalculateAll();
    }

    /**
     * Get current usage state
     */
    getState(): UsageState {
        return { ...this.state };
    }

    /**
     * Set value for a dimension
     */
    setValue(dimensionId: string, value: number): void {
        const dimension = this.dimensions.get(dimensionId);

        if (!dimension) {
            console.warn(`Unknown usage dimension: ${dimensionId}`);
            return;
        }

        // Validate range
        if (dimension.min !== undefined && value < dimension.min) {
            value = dimension.min;
        }
        if (dimension.max !== undefined && value > dimension.max) {
            value = dimension.max;
        }

        this.state[dimensionId] = value;

        // Recalculate dependent dimensions
        this.recalculateDependent(dimensionId);
    }

    /**
     * Apply preset profile to all dimensions
     */
    applyPreset(preset: UsagePreset): void {
        for (const [id, dimension] of this.dimensions) {
            if (dimension.type === 'calculated') {
                continue; // Skip calculated dimensions
            }

            if (dimension.presets && dimension.presets[preset] !== undefined) {
                this.state[id] = dimension.presets[preset];
            }
        }

        // Recalculate all calculated dimensions
        this.recalculateAll();
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
    getDimensions(): UsageDimension[] {
        return Array.from(this.dimensions.values());
    }

    /**
     * Recalculate all calculated dimensions
     */
    private recalculateAll(): void {
        const calculated = Array.from(this.dimensions.values())
            .filter(d => d.type === 'calculated');

        // Sort by dependencies to ensure correct order
        const sorted = this.topologicalSort(calculated);

        for (const dimension of sorted) {
            this.recalculateDimension(dimension.id);
        }
    }

    /**
     * Recalculate dimensions that depend on the changed dimension
     */
    private recalculateDependent(changedId: string): void {
        const dependent = Array.from(this.dimensions.values())
            .filter(d => d.type === 'calculated' && d.dependsOn?.includes(changedId));

        for (const dimension of dependent) {
            this.recalculateDimension(dimension.id);
            // Recursively recalculate anything that depends on this
            this.recalculateDependent(dimension.id);
        }
    }

    /**
     * Recalculate a single calculated dimension
     */
    private recalculateDimension(dimensionId: string): void {
        const dimension = this.dimensions.get(dimensionId);

        if (!dimension || dimension.type !== 'calculated' || !dimension.formula) {
            return;
        }

        try {
            const result = this.evaluateFormula(dimension.formula);
            this.state[dimensionId] = result;
        } catch (error) {
            console.error(`Error calculating dimension ${dimensionId}:`, error);
            this.state[dimensionId] = 0;
        }
    }

    /**
     * Evaluate a formula expression
     */
    private evaluateFormula(formula: string): number {
        try {
            // Create evaluation context with current state
            const context = { ...this.state };

            // Add math functions
            const helpers = {
                max: Math.max,
                min: Math.min,
                ceil: Math.ceil,
                floor: Math.floor,
                round: Math.round,
                abs: Math.abs,
                sqrt: Math.sqrt,
            };

            // Create function with controlled context
            const func = new Function(
                ...Object.keys(context),
                ...Object.keys(helpers),
                `return ${formula};`
            );

            const result = func(...Object.values(context), ...Object.values(helpers));

            return typeof result === 'number' ? result : 0;
        } catch (error) {
            console.error(`Formula evaluation error: ${formula}`, error);
            return 0;
        }
    }

    /**
     * Topological sort for calculated dimensions
     */
    private topologicalSort(dimensions: UsageDimension[]): UsageDimension[] {
        const sorted: UsageDimension[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        const visit = (dimension: UsageDimension): void => {
            if (visited.has(dimension.id)) return;
            if (visiting.has(dimension.id)) {
                console.warn(`Circular dependency detected in usage dimension: ${dimension.id}`);
                return;
            }

            visiting.add(dimension.id);

            // Visit dependencies first
            if (dimension.dependsOn) {
                for (const depId of dimension.dependsOn) {
                    const dep = this.dimensions.get(depId);
                    if (dep && dep.type === 'calculated') {
                        visit(dep);
                    }
                }
            }

            visiting.delete(dimension.id);
            visited.add(dimension.id);
            sorted.push(dimension);
        };

        for (const dimension of dimensions) {
            visit(dimension);
        }

        return sorted;
    }

    /**
     * Validate usage state
     */
    validate(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        for (const [id, dimension] of this.dimensions) {
            const value = this.state[id];

            if (value === undefined || value === null) {
                errors.push(`Missing value for dimension: ${dimension.label}`);
                continue;
            }

            if (typeof value !== 'number' || isNaN(value)) {
                errors.push(`Invalid value for dimension ${dimension.label}: must be a number`);
                continue;
            }

            if (dimension.min !== undefined && value < dimension.min) {
                errors.push(`${dimension.label} is below minimum (${dimension.min})`);
            }

            if (dimension.max !== undefined && value > dimension.max) {
                errors.push(`${dimension.label} exceeds maximum (${dimension.max})`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Reset to default values
     */
    reset(): void {
        for (const [id, dimension] of this.dimensions) {
            this.state[id] = dimension.default;
        }
        this.recalculateAll();
    }

    /**
     * Export state as assumptions for cost breakdown
     */
    exportAssumptions(): string[] {
        const assumptions: string[] = [];

        for (const [id, dimension] of this.dimensions) {
            const value = this.state[id];
            assumptions.push(`${dimension.label}: ${value} ${dimension.unit}`);
        }

        return assumptions;
    }

    /**
     * Calculate tiered usage
     * Used for AWS-style tiered pricing (e.g., data transfer)
     */
    calculateTiered(totalUsage: number, tiers: UsageTier[]): TieredUsageBreakdown {
        const breakdown: TieredUsageBreakdown = {
            total: totalUsage,
            tiers: [],
        };

        let remaining = totalUsage;

        for (const tier of tiers) {
            if (remaining <= 0) break;

            const tierMax = tier.max ?? Infinity;
            const tierCapacity = tierMax - tier.min;
            const tierUsage = Math.min(remaining, tierCapacity);

            breakdown.tiers.push({
                min: tier.min,
                max: tier.max,
                usage: tierUsage,
                rate: tier.rate,
                cost: tierUsage * tier.rate,
            });

            remaining -= tierUsage;
        }

        return breakdown;
    }
}
