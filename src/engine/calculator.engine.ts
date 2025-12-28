import { CostFormula, CostEstimate, CostLineItem, ServiceFormState } from '@types/schema.types';
import { UsageState } from './usage.engine';
import { pricingEngine, PricingRecord } from './pricing.engine';

/**
 * Formula evaluation context
 */
interface FormulaContext {
    usage: UsageState;
    pricing: Record<string, number>;
    fields: Record<string, unknown>;
    constants: Record<string, number>;
}

/**
 * Cost Calculator Engine
 * 
 * Evaluates cost formulas and generates detailed cost breakdowns
 */
export class CalculatorEngine {
    /**
     * Calculate costs for a service configuration
     */
    async calculate(
        service: string,
        region: string,
        formState: ServiceFormState,
        usageState: UsageState,
        formulas: CostFormula[],
        pricingRecords: Map<string, PricingRecord>
    ): Promise<CostEstimate> {
        const lineItems: CostLineItem[] = [];
        const timestamp = new Date().toISOString();

        // Build pricing context
        const pricingContext: Record<string, number> = {};
        for (const [key, record] of pricingRecords) {
            pricingContext[key] = record.price;
        }

        // Build formula context
        const context: FormulaContext = {
            usage: usageState,
            pricing: pricingContext,
            fields: formState.fields,
            constants: {
                HOURS_PER_MONTH: 730,
                DAYS_PER_MONTH: 30.42,
                GB_TO_TB: 1024,
                SECONDS_PER_HOUR: 3600,
            },
        };

        // Evaluate each formula
        for (const formula of formulas) {
            try {
                const result = this.evaluateFormula(formula, context, pricingRecords);

                if (result.subtotal > 0) {
                    lineItems.push(result);
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
     * Evaluate a single cost formula
     */
    private evaluateFormula(
        formula: CostFormula,
        context: FormulaContext,
        pricingRecords: Map<string, PricingRecord>
    ): CostLineItem {
        // Parse and evaluate the formula
        const { quantity, unitPrice, details } = this.parseFormula(formula.formula, context);

        // Calculate subtotal
        const subtotal = quantity * unitPrice;

        return {
            id: formula.id,
            label: formula.label,
            formula: formula.formula,
            usage: context.usage,
            unitPrice,
            quantity,
            subtotal,
            unit: formula.unit,
            details: details || formula.description,
        };
    }

    /**
     * Parse and evaluate a formula expression
     */
    private parseFormula(
        formula: string,
        context: FormulaContext
    ): { quantity: number; unitPrice: number; details?: string } {
        try {
            // Create evaluation context - merge all context objects
            const evalContext = {
                ...context.usage,
                ...context.pricing,
                ...context.fields,  // Add form fields to context
                ...context.constants,
            };

            // Add helper functions
            const helpers = {
                max: Math.max,
                min: Math.min,
                ceil: Math.ceil,
                floor: Math.floor,
                round: Math.round,
            };

            // Evaluate formula
            const func = new Function(
                ...Object.keys(evalContext),
                ...Object.keys(helpers),
                `return ${formula};`
            );

            const result = func(...Object.values(evalContext), ...Object.values(helpers));

            // Handle different return types
            if (typeof result === 'number') {
                return { quantity: result, unitPrice: 1 };
            } else if (typeof result === 'object' && 'quantity' in result && 'unitPrice' in result) {
                return result;
            } else {
                throw new Error(`Invalid formula result type: ${typeof result}`);
            }
        } catch (error) {
            console.error(`Formula evaluation error: ${formula}`, error);
            return { quantity: 0, unitPrice: 0 };
        }
    }

    /**
     * Generate cost assumptions for transparency
     */
    private generateAssumptions(
        usageState: UsageState,
        formState: ServiceFormState
    ): string[] {
        const assumptions: string[] = [];

        // Add usage assumptions
        for (const [key, value] of Object.entries(usageState)) {
            if (value > 0) {
                assumptions.push(`${key}: ${value}`);
            }
        }

        // Add configuration assumptions
        assumptions.push(`Region: ${formState.region}`);
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
        if (difference < 0) {
            cheaper = 'estimate2';
        } else if (difference > 0) {
            cheaper = 'estimate1';
        } else {
            cheaper = 'equal';
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
        const headers = ['Component', 'Quantity', 'Unit Price', 'Subtotal', 'Unit'];
        const rows = estimate.lineItems.map(item => [
            item.label,
            item.quantity.toString(),
            item.unitPrice.toString(),
            item.subtotal.toString(),
            item.unit,
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(',')),
            '',
            `Total,,,${estimate.total},${estimate.currency}`,
        ].join('\n');

        return csv;
    }
}

// Singleton instance
export const calculatorEngine = new CalculatorEngine();
