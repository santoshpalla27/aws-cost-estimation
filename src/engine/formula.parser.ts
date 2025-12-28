/**
 * Formula AST Node Types
 */
export type FormulaASTNode =
    | { type: 'number'; value: number }
    | { type: 'variable'; name: string }
    | { type: 'binary'; operator: string; left: FormulaASTNode; right: FormulaASTNode }
    | { type: 'unary'; operator: string; operand: FormulaASTNode }
    | { type: 'call'; name: string; args: FormulaASTNode[] }
    | { type: 'conditional'; condition: FormulaASTNode; consequent: FormulaASTNode; alternate: FormulaASTNode };

/**
 * Formula Parser
 * 
 * Parses formula strings into AST for safe evaluation.
 * This is a simplified parser - in production, consider using a proper parser library.
 */
export class FormulaParser {
    /**
     * Parse formula string to AST
     */
    parse(formula: string): FormulaASTNode {
        // For now, we'll use a simple approach
        // In production, implement a proper recursive descent parser
        // or use a library like mathjs

        // This is a placeholder that returns the formula as-is
        // The actual parsing will be done by the evaluator using Function constructor
        return {
            type: 'variable',
            name: formula,
        };
    }

    /**
     * Validate formula syntax
     */
    validate(formula: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Basic validation
        if (!formula || formula.trim() === '') {
            errors.push('Formula is empty');
            return { valid: false, errors };
        }

        // Check for balanced parentheses
        let parenCount = 0;
        for (const char of formula) {
            if (char === '(') parenCount++;
            if (char === ')') parenCount--;
            if (parenCount < 0) {
                errors.push('Unbalanced parentheses');
                break;
            }
        }
        if (parenCount !== 0) {
            errors.push('Unbalanced parentheses');
        }

        // Check for dangerous patterns
        const dangerous = ['eval', 'Function', 'constructor', '__proto__', 'prototype'];
        for (const pattern of dangerous) {
            if (formula.includes(pattern)) {
                errors.push(`Dangerous pattern detected: ${pattern}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    /**
     * Extract variables from formula
     */
    extractVariables(formula: string): Set<string> {
        const variables = new Set<string>();

        // Simple regex to find identifiers
        // In production, parse the AST properly
        const identifierRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
        const matches = formula.match(identifierRegex) || [];

        // Filter out known functions and keywords
        const keywords = new Set([
            'max', 'min', 'ceil', 'floor', 'round', 'abs', 'sqrt',
            'if', 'else', 'true', 'false', 'null', 'undefined',
        ]);

        for (const match of matches) {
            if (!keywords.has(match)) {
                variables.add(match);
            }
        }

        return variables;
    }
}

// Singleton instance
export const formulaParser = new FormulaParser();
