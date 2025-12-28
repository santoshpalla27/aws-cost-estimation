import { FormState } from '@/schema/schema.engine';
import { UsageState } from './usage.engine';
import { formulaEvaluator, FormulaContext } from './formula.evaluator';

/**
 * Derived usage calculation rule
 * Automatically calculate usage based on other services/dimensions
 */
export interface DerivedUsageRule {
    id: string;
    targetDimension: string;
    sourceDimensions: string[];
    formula: string;
    description: string;
    enabled?: boolean;
}

/**
 * Derived Usage Engine
 * 
 * Calculates usage dimensions automatically based on other dimensions or form state.
 * Examples:
 * - EC2 instance size → estimated data transfer
 * - VPC private subnets → NAT Gateway data processing
 * - Number of resources → CloudWatch metrics
 */
export class DerivedUsageEngine {
    private rules: Map<string, DerivedUsageRule> = new Map();

    /**
     * Register a derived usage rule
     */
    registerRule(rule: DerivedUsageRule): void {
        this.rules.set(rule.id, rule);
    }

    /**
     * Register multiple rules at once
     */
    registerRules(rules: DerivedUsageRule[]): void {
        for (const rule of rules) {
            this.registerRule(rule);
        }
    }

    /**
     * Calculate all derived usage values
     * Returns a map of dimension IDs to calculated values
     */
    calculateDerived(
        formState: FormState,
        usageState: UsageState
    ): Record<string, number> {
        const derived: Record<string, number> = {};

        for (const rule of this.rules.values()) {
            // Skip disabled rules
            if (rule.enabled === false) continue;

            // Check if all source dimensions are available
            const hasAllSources = rule.sourceDimensions.every(
                dim => usageState[dim] !== undefined || formState[dim] !== undefined
            );

            if (hasAllSources) {
                try {
                    // Evaluate formula to get derived value
                    const value = this.evaluateFormula(
                        rule.formula,
                        formState,
                        usageState
                    );

                    if (value >= 0 && isFinite(value)) {
                        derived[rule.targetDimension] = value;
                    }
                } catch (error) {
                    console.error(`Error evaluating derived usage rule ${rule.id}:`, error);
                }
            }
        }

        return derived;
    }

    /**
     * Evaluate a formula in the context of form and usage state
     */
    private evaluateFormula(
        formula: string,
        formState: FormState,
        usageState: UsageState
    ): number {
        // Build evaluation context
        const context: FormulaContext = {
            fields: formState,
            usage: usageState,
            pricing: {},
            constants: {
                HOURS_PER_MONTH: 730,
                HOURS_PER_YEAR: 8760,
                DAYS_PER_MONTH: 30.42,
                GB_TO_TB: 1024,
            },
            helpers: {},
        };

        const result = formulaEvaluator.evaluate(formula, context);
        return typeof result === 'number' ? result : 0;
    }

    /**
     * Get all registered rules
     */
    getRules(): DerivedUsageRule[] {
        return Array.from(this.rules.values());
    }

    /**
     * Clear all rules
     */
    clearRules(): void {
        this.rules.clear();
    }
}

/**
 * Predefined derived usage rules for common AWS scenarios
 */
export const AWS_DERIVED_USAGE_RULES: DerivedUsageRule[] = [
    // EC2 → Data Transfer estimation
    {
        id: 'ec2_to_data_transfer',
        targetDimension: 'data_transfer_out_gb',
        sourceDimensions: ['hours_per_month', 'instance_size'],
        formula: `
            hours_per_month * (
                instance_size.includes('xlarge') ? 100 :
                instance_size.includes('large') ? 50 :
                instance_size.includes('medium') ? 25 : 10
            )
        `,
        description: 'Estimate data transfer based on EC2 instance size and uptime'
    },

    // VPC → NAT Gateway data processing
    {
        id: 'vpc_nat_data_processing',
        targetDimension: 'nat_data_processed_gb',
        sourceDimensions: ['private_subnets', 'data_transfer_out_gb', 'nat_gateway_mode'],
        formula: `
            (private_subnets > 0 && nat_gateway_mode !== 'none')
                ? data_transfer_out_gb * 0.8
                : 0
        `,
        description: 'Estimate NAT Gateway data processing from private subnet traffic'
    },

    // VPC → Cross-AZ transfer estimation
    {
        id: 'vpc_cross_az_transfer',
        targetDimension: 'cross_az_data_transfer_gb',
        sourceDimensions: ['availability_zones', 'data_transfer_out_gb'],
        formula: `
            availability_zones > 1
                ? data_transfer_out_gb * 0.3 * (availability_zones - 1)
                : 0
        `,
        description: 'Estimate cross-AZ data transfer based on multi-AZ deployment'
    },

    // EC2 → CloudWatch metrics
    {
        id: 'ec2_cloudwatch_metrics',
        targetDimension: 'cloudwatch_metrics_count',
        sourceDimensions: ['enable_detailed_monitoring'],
        formula: `
            enable_detailed_monitoring ? 7 : 5
        `,
        description: 'CloudWatch metrics count based on monitoring level'
    },

    // VPC → Flow Logs volume estimation
    {
        id: 'vpc_flow_logs_volume',
        targetDimension: 'flow_logs_gb',
        sourceDimensions: ['enable_vpc_flow_logs', 'data_transfer_out_gb', 'cross_az_data_transfer_gb'],
        formula: `
            enable_vpc_flow_logs
                ? (data_transfer_out_gb + cross_az_data_transfer_gb) * 0.05
                : 0
        `,
        description: 'Estimate flow logs volume as ~5% of total traffic'
    },

    // EBS → Snapshot estimation
    {
        id: 'ebs_snapshot_volume',
        targetDimension: 'ebs_snapshot_gb',
        sourceDimensions: ['ebs_volumes'],
        formula: `
            ebs_volumes.reduce((sum, vol) => sum + vol.size_gb, 0) * 0.5
        `,
        description: 'Estimate snapshot size as 50% of total EBS volume size'
    }
];

// Singleton instance
export const derivedUsageEngine = new DerivedUsageEngine();

// Register default AWS rules
derivedUsageEngine.registerRules(AWS_DERIVED_USAGE_RULES);
