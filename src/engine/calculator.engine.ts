import { CostFormula } from '@/schema/schema.contract';
import { FormState } from '@/schema/schema.engine';
import { UsageState, UsageTier, TieredUsageBreakdown } from './usage.engine';
import { formulaEvaluator, FormulaContext } from './formula.evaluator';
import { pricingEngine } from './pricing.engine';

/**
 * AWS Data Transfer Tiers (example - actual rates from pricing API)
 */
export const AWS_DATA_TRANSFER_TIERS: UsageTier[] = [
    { min: 0, max: 10240, rate: 0.09 },        // First 10 TB
    { min: 10240, max: 51200, rate: 0.085 },   // Next 40 TB
    { min: 51200, max: 153600, rate: 0.07 },   // Next 100 TB
    { min: 153600, rate: 0.05 },               // Over 150 TB
];

/**
 * EBS GP3 IOPS Tiers (per IOPS-month)
 */
export const EBS_GP3_IOPS_TIERS: UsageTier[] = [
    { min: 0, max: 3000, rate: 0 },            // Baseline included
    { min: 3000, max: 16000, rate: 0.005 },    // Above baseline
    { min: 16000, rate: 0.005 },               // Max IOPS
];

/**
 * EBS GP3 Throughput Tiers (per MBps-month)
 */
export const EBS_GP3_THROUGHPUT_TIERS: UsageTier[] = [
    { min: 0, max: 125, rate: 0 },             // Baseline included
    { min: 125, max: 1000, rate: 0.04 },       // Above baseline
];

/**
 * CloudWatch Metrics Tiers (per metric-month)
 */
export const CLOUDWATCH_METRICS_TIERS: UsageTier[] = [
    { min: 0, max: 10000, rate: 0.30 },        // First 10K metrics
    { min: 10000, rate: 0.10 },                // Over 10K metrics
];

/**
 * CloudWatch Logs Ingestion Tiers (per GB)
 */
export const CLOUDWATCH_LOGS_TIERS: UsageTier[] = [
    { min: 0, max: 10240, rate: 0.50 },        // First 10 TB
    { min: 10240, max: 51200, rate: 0.25 },    // Next 40 TB
    { min: 51200, rate: 0.10 },                // Over 50 TB
];

/**
 * S3 Standard Storage Tiers (per GB-month)
 */
export const S3_STANDARD_STORAGE_TIERS: UsageTier[] = [
    { min: 0, max: 51200, rate: 0.023 },       // First 50 TB
    { min: 51200, max: 512000, rate: 0.022 },  // Next 450 TB
    { min: 512000, rate: 0.021 },              // Over 500 TB
];

/**
 * Cost line item
 */
export interface CostLineItem {
    id: string;
    label: string;
    formula: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    unit: string;
    description?: string;
}

/**
 * Cost estimate
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
 * Calculator Engine
 * 
 * Evaluates cost formulas and generates detailed breakdowns.
 * Completely generic - no service-specific logic.
 */
export class CalculatorEngine {
    /**
     * Calculate costs based on schema formulas
     */
    async calculate(
        service: string,
        region: string,
        formulas: CostFormula[],
        formState: FormState,
        usageState: UsageState
    ): Promise<CostEstimate> {
        const lineItems: CostLineItem[] = [];
        const timestamp = new Date().toISOString();

        // Build pricing context (simplified - actual pricing lookups would go here)
        const pricingContext: Record<string, number> = {};

        // Build formula evaluation context
        const context: FormulaContext = {
            fields: formState,
            usage: usageState,
            pricing: pricingContext,
            constants: {
                HOURS_PER_MONTH: 730,
                HOURS_PER_YEAR: 8760,
                DAYS_PER_MONTH: 30.42,
                DAYS_PER_YEAR: 365,
                WEEKS_PER_MONTH: 4.33,
                WEEKS_PER_YEAR: 52,
                GB_TO_TB: 1024,
                MB_TO_GB: 1024,
                SECONDS_PER_HOUR: 3600,
                MINUTES_PER_HOUR: 60,
            },
            helpers: {
                // Tiered pricing helper
                calculateTiered: (usage: number, tiers: UsageTier[]): number => {
                    return this.calculateTieredCost(usage, tiers);
                },
            },
        };

        // Evaluate each formula
        for (const formula of formulas) {
            try {
                // Check condition if present
                if (formula.condition) {
                    // Use dependency engine to evaluate condition
                    // For now, skip formulas with conditions
                    // TODO: Integrate with dependency engine
                }

                const result = formulaEvaluator.evaluate(formula.formula, context);

                if (result > 0) {
                    lineItems.push({
                        id: formula.id,
                        label: formula.label,
                        formula: formula.formula,
                        quantity: result,
                        unitPrice: 1, // Simplified - actual pricing lookup would go here
                        subtotal: result,
                        unit: formula.unit,
                        description: formula.description,
                    });
                }
            } catch (error) {
                console.error(`Error evaluating formula ${formula.id}:`, error);
            }
        }

        // Calculate totals
        const subtotal = lineItems.reduce((sum, item) => sum + item.subtotal, 0);
        const total = subtotal;

        return {
            service,
            region,
            lineItems,
            subtotal,
            total,
            currency: 'USD',
            period: 'monthly',
            timestamp,
            assumptions: this.generateAssumptions(usageState, formState),
        };
    }

    /**
     * Generate assumptions for transparency
     */
    private generateAssumptions(
        usageState: UsageState,
        formState: FormState
    ): string[] {
        const assumptions: string[] = [];

        // Add usage assumptions
        for (const [key, value] of Object.entries(usageState)) {
            if (value > 0) {
                assumptions.push(`${key}: ${value}`);
            }
        }

        // Add configuration assumptions
        assumptions.push(`Calculation date: ${new Date().toLocaleDateString()}`);
        assumptions.push('Prices are subject to change');
        assumptions.push('Costs are estimates and may vary based on actual usage');

        return assumptions;
    }

    /**
     * Format cost for display
     */
    formatCost(amount: number, currency: string = 'USD'): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    }

    /**
     * Convert monthly to annual cost
     */
    toAnnual(monthlyCost: number): number {
        return monthlyCost * 12;
    }

    /**
     * Convert annual to monthly cost
     */
    toMonthly(annualCost: number): number {
        return annualCost / 12;
    }

    /**
     * Calculate cost per unit
     */
    calculatePerUnit(
        totalCost: number,
        quantity: number,
        unit: string
    ): { cost: number; label: string } {
        if (quantity === 0) {
            return { cost: 0, label: `per ${unit}` };
        }

        return {
            cost: totalCost / quantity,
            label: `per ${unit}`,
        };
    }

    /**
     * Compare two cost estimates
     */
    compare(
        estimate1: CostEstimate,
        estimate2: CostEstimate
    ): {
        difference: number;
        percentChange: number;
        cheaper: 'estimate1' | 'estimate2' | 'equal';
    } {
        const difference = estimate2.total - estimate1.total;
        const percentChange = estimate1.total === 0 ? 0 : (difference / estimate1.total) * 100;

        let cheaper: 'estimate1' | 'estimate2' | 'equal';
        if (Math.abs(difference) < 0.01) {
            cheaper = 'equal';
        } else if (difference < 0) {
            cheaper = 'estimate2';
        } else {
            cheaper = 'estimate1';
        }

        return { difference, percentChange, cheaper };
    }

    /**
     * Export estimate to JSON
     */
    exportToJSON(estimate: CostEstimate): string {
        return JSON.stringify(estimate, null, 2);
    }

    /**
     * Export estimate to CSV
     */
    exportToCSV(estimate: CostEstimate): string {
        const headers = ['Component', 'Formula', 'Quantity', 'Unit Price', 'Subtotal', 'Unit'];
        const rows = estimate.lineItems.map(item => [
            item.label,
            item.formula,
            item.quantity.toString(),
            item.unitPrice.toString(),
            item.subtotal.toString(),
            item.unit,
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
            '',
            `Total,,,,,${estimate.total}`,
            `Currency,,,,,${estimate.currency}`,
            `Period,,,,,${estimate.period}`,
        ].join('\n');

        return csv;
    }

    /**
     * Generate detailed breakdown report
     */
    generateReport(estimate: CostEstimate): string {
        const lines: string[] = [];

        lines.push('='.repeat(80));
        lines.push(`AWS COST ESTIMATE - ${estimate.service.toUpperCase()}`);
        lines.push('='.repeat(80));
        lines.push(`Region: ${estimate.region}`);
        lines.push(`Period: ${estimate.period}`);
        lines.push(`Generated: ${new Date(estimate.timestamp).toLocaleString()}`);
        lines.push('='.repeat(80));
        lines.push('');

        lines.push('COST BREAKDOWN');
        lines.push('-'.repeat(80));

        for (const item of estimate.lineItems) {
            lines.push(`${item.label}`);
            lines.push(`  Formula: ${item.formula}`);
            lines.push(`  Quantity: ${item.quantity} ${item.unit}`);
            lines.push(`  Cost: ${this.formatCost(item.subtotal)}`);
            if (item.description) {
                lines.push(`  Note: ${item.description}`);
            }
            lines.push('');
        }

        lines.push('-'.repeat(80));
        lines.push(`TOTAL: ${this.formatCost(estimate.total)} / ${estimate.period}`);
        lines.push('='.repeat(80));
        lines.push('');

        lines.push('ASSUMPTIONS');
        lines.push('-'.repeat(80));
        estimate.assumptions.forEach(assumption => {
            lines.push(`• ${assumption}`);
        });
        lines.push('='.repeat(80));

        return lines.join('\n');
    }

    /**
     * Calculate tiered cost (e.g., for data transfer)
     * Used by formula helper function
     */
    private calculateTieredCost(usage: number, tiers: UsageTier[]): number {
        let totalCost = 0;
        let remaining = usage;

        for (const tier of tiers) {
            if (remaining <= 0) break;

            const tierMax = tier.max ?? Infinity;
            const tierCapacity = tierMax - tier.min;
            const tierUsage = Math.min(remaining, tierCapacity);

            totalCost += tierUsage * tier.rate;
            remaining -= tierUsage;
        }

        return totalCost;
    }
}

// Singleton instance
export const calculatorEngine = new CalculatorEngine();
