import { formulaParser } from './formula.parser';

/**
 * Formula evaluation context
 */
export interface FormulaContext {
    fields: Record<string, unknown>;
    usage: Record<string, number>;
    pricing: Record<string, number>;
    constants: Record<string, number>;
    helpers?: Record<string, (...args: any[]) => any>; // Custom helper functions
}

/**
 * Formula Evaluator
 * 
 * Safely evaluates formulas with controlled context.
 * Completely generic - no service-specific logic.
 */
export class FormulaEvaluator {
    /**
     * Evaluate formula with given context
     */
    evaluate(formula: string, context: FormulaContext): number {
        // Validate formula first
        const validation = formulaParser.validate(formula);
        if (!validation.valid) {
            console.error('Formula validation failed:', validation.errors);
            return 0;
        }

        try {
            // Merge all context into single evaluation context
            const evalContext = {
                ...context.fields,
                ...context.usage,
                ...context.pricing,
                ...context.constants,
            };

            // Add helper functions
            const helpers = {
                max: Math.max,
                min: Math.min,
                ceil: Math.ceil,
                floor: Math.floor,
                round: Math.round,
                abs: Math.abs,
                sqrt: Math.sqrt,
                pow: Math.pow,

                // Conditional helper
                ifelse: (condition: boolean, trueValue: number, falseValue: number) =>
                    condition ? trueValue : falseValue,
            };

            // Create function with controlled context
            const func = new Function(
                ...Object.keys(evalContext),
                ...Object.keys(helpers),
                `'use strict'; return (${formula});`
            );

            const result = func(...Object.values(evalContext), ...Object.values(helpers));

            // Ensure result is a number
            if (typeof result === 'number' && !isNaN(result)) {
                return result;
            } else if (typeof result === 'boolean') {
                return result ? 1 : 0;
            } else {
                console.warn(`Formula returned non-number: ${typeof result}`);
                return 0;
            }
        } catch (error) {
            console.error(`Formula evaluation error: ${formula}`, error);
            return 0;
        }
    }

    /**
     * Evaluate formula and return detailed result
     */
    evaluateDetailed(
        formula: string,
        context: FormulaContext
    ): {
        value: number;
        success: boolean;
        error?: string;
    } {
        try {
            const value = this.evaluate(formula, context);
            return { value, success: true };
        } catch (error) {
            return {
                value: 0,
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Batch evaluate multiple formulas
     */
    evaluateBatch(
        formulas: Array<{ id: string; formula: string }>,
        context: FormulaContext
    ): Map<string, number> {
        const results = new Map<string, number>();

        for (const { id, formula } of formulas) {
            results.set(id, this.evaluate(formula, context));
        }

        return results;
    }

    /**
     * Check if all variables in formula are available in context
     */
    validateContext(formula: string, context: FormulaContext): { valid: boolean; missing: string[] } {
        const variables = formulaParser.extractVariables(formula);
        const available = new Set([
            ...Object.keys(context.fields),
            ...Object.keys(context.usage),
            ...Object.keys(context.pricing),
            ...Object.keys(context.constants),
        ]);

        const missing: string[] = [];
        for (const variable of variables) {
            if (!available.has(variable)) {
                missing.push(variable);
            }
        }

        return {
            valid: missing.length === 0,
            missing,
        };
    }
}

// Singleton instance
export const formulaEvaluator = new FormulaEvaluator();
