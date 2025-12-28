import { DependencyExpression, ServiceFormState } from '@types/schema.types';

/**
 * Dependency Resolution Engine
 * 
 * Evaluates dependency expressions to determine field visibility,
 * enablement, and validation states.
 */
export class DependencyEngine {
    /**
     * Evaluate a dependency expression against current form state
     */
    evaluate(
        expression: DependencyExpression,
        formState: ServiceFormState
    ): boolean {
        const { operator, field, value, expressions } = expression;

        switch (operator) {
            case 'eq':
                return this.getFieldValue(formState, field!) === value;

            case 'ne':
                return this.getFieldValue(formState, field!) !== value;

            case 'gt':
                return Number(this.getFieldValue(formState, field!)) > Number(value);

            case 'gte':
                return Number(this.getFieldValue(formState, field!)) >= Number(value);

            case 'lt':
                return Number(this.getFieldValue(formState, field!)) < Number(value);

            case 'lte':
                return Number(this.getFieldValue(formState, field!)) <= Number(value);

            case 'in':
                return Array.isArray(value) && value.includes(this.getFieldValue(formState, field!));

            case 'nin':
                return Array.isArray(value) && !value.includes(this.getFieldValue(formState, field!));

            case 'and':
                return expressions?.every(expr => this.evaluate(expr, formState)) ?? false;

            case 'or':
                return expressions?.some(expr => this.evaluate(expr, formState)) ?? false;

            case 'not':
                return expressions?.length === 1 ? !this.evaluate(expressions[0], formState) : false;

            default:
                console.warn(`Unknown operator: ${operator}`);
                return false;
        }
    }

    /**
     * Get field value from form state, supporting nested paths
     */
    private getFieldValue(formState: ServiceFormState, fieldPath: string): unknown {
        const parts = fieldPath.split('.');
        let value: any = formState.fields;

        for (const part of parts) {
            if (value === null || value === undefined) {
                return undefined;
            }
            value = value[part];
        }

        return value;
    }

    /**
     * Check if a field should be visible based on its visibleWhen expression
     */
    isFieldVisible(
        visibleWhen: DependencyExpression | undefined,
        formState: ServiceFormState
    ): boolean {
        if (!visibleWhen) {
            return true;
        }
        return this.evaluate(visibleWhen, formState);
    }

    /**
     * Check if a field's dependencies are met
     */
    areDependenciesMet(
        dependsOn: DependencyExpression | undefined,
        formState: ServiceFormState
    ): boolean {
        if (!dependsOn) {
            return true;
        }
        return this.evaluate(dependsOn, formState);
    }

    /**
     * Get all fields that a given field depends on
     */
    getDependentFields(expression: DependencyExpression | undefined): Set<string> {
        const fields = new Set<string>();

        if (!expression) {
            return fields;
        }

        const traverse = (expr: DependencyExpression) => {
            if (expr.field) {
                fields.add(expr.field);
            }
            if (expr.expressions) {
                expr.expressions.forEach(traverse);
            }
        };

        traverse(expression);
        return fields;
    }

    /**
     * Build a dependency graph for all fields
     */
    buildDependencyGraph(
        fields: Array<{ id: string; dependsOn?: DependencyExpression; visibleWhen?: DependencyExpression }>
    ): Map<string, Set<string>> {
        const graph = new Map<string, Set<string>>();

        for (const field of fields) {
            const dependencies = new Set<string>();

            if (field.dependsOn) {
                this.getDependentFields(field.dependsOn).forEach(dep => dependencies.add(dep));
            }

            if (field.visibleWhen) {
                this.getDependentFields(field.visibleWhen).forEach(dep => dependencies.add(dep));
            }

            graph.set(field.id, dependencies);
        }

        return graph;
    }

    /**
     * Get fields that need to be updated when a field changes
     */
    getAffectedFields(
        changedField: string,
        dependencyGraph: Map<string, Set<string>>
    ): Set<string> {
        const affected = new Set<string>();

        for (const [fieldId, dependencies] of dependencyGraph.entries()) {
            if (dependencies.has(changedField)) {
                affected.add(fieldId);
            }
        }

        return affected;
    }

    /**
     * Validate that there are no circular dependencies
     */
    validateNoCycles(dependencyGraph: Map<string, Set<string>>): {
        valid: boolean;
        cycles?: string[][];
    } {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const cycles: string[][] = [];

        const detectCycle = (node: string, path: string[]): boolean => {
            visited.add(node);
            recursionStack.add(node);
            path.push(node);

            const dependencies = dependencyGraph.get(node) || new Set();

            for (const dep of dependencies) {
                if (!visited.has(dep)) {
                    if (detectCycle(dep, [...path])) {
                        return true;
                    }
                } else if (recursionStack.has(dep)) {
                    // Found a cycle
                    const cycleStart = path.indexOf(dep);
                    cycles.push([...path.slice(cycleStart), dep]);
                    return true;
                }
            }

            recursionStack.delete(node);
            return false;
        };

        for (const node of dependencyGraph.keys()) {
            if (!visited.has(node)) {
                detectCycle(node, []);
            }
        }

        return {
            valid: cycles.length === 0,
            cycles: cycles.length > 0 ? cycles : undefined,
        };
    }
}

// Singleton instance
export const dependencyEngine = new DependencyEngine();
