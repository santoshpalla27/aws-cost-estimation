import { useState } from 'react';
import { CostEstimate } from '@types/schema.types';
import { calculatorEngine } from '@engine/calculator.engine';

interface CostBreakdownProps {
    estimate: CostEstimate | null;
}

function CostBreakdown({ estimate }: CostBreakdownProps) {
    const [expanded, setExpanded] = useState<boolean>(true);
    const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');

    if (!estimate) {
        return (
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">Cost Estimate</h3>
                </div>
                <div className="card-body">
                    <p className="text-muted text-center" style={{ padding: 'var(--spacing-xl)' }}>
                        Configure your service to see cost estimates
                    </p>
                </div>
            </div>
        );
    }

    const displayTotal = period === 'annual' ? calculatorEngine.toAnnual(estimate.total) : estimate.total;

    const handleExport = (format: 'json' | 'csv') => {
        const data = format === 'json'
            ? calculatorEngine.exportToJSON(estimate)
            : calculatorEngine.exportToCSV(estimate);

        const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aws-estimate-${estimate.service}-${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">Cost Estimate</h3>
                <div className="flex gap-sm">
                    <button
                        className={`btn btn-sm ${period === 'monthly' ? 'btn-primary' : ''}`}
                        onClick={() => setPeriod('monthly')}
                    >
                        Monthly
                    </button>
                    <button
                        className={`btn btn-sm ${period === 'annual' ? 'btn-primary' : ''}`}
                        onClick={() => setPeriod('annual')}
                    >
                        Annual
                    </button>
                </div>
            </div>

            <div className="card-body">
                {/* Total Cost */}
                <div style={{
                    padding: 'var(--spacing-lg)',
                    background: 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--spacing-lg)',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--spacing-xs)' }}>
                        Estimated {period === 'monthly' ? 'Monthly' : 'Annual'} Cost
                    </div>
                    <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-accent-primary)' }}>
                        {calculatorEngine.formatCost(displayTotal)}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--spacing-xs)' }}>
                        {estimate.region} • {estimate.service.toUpperCase()}
                    </div>
                </div>

                {/* Line Items */}
                <div>
                    <button
                        className="btn"
                        style={{ width: '100%', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}
                        onClick={() => setExpanded(!expanded)}
                    >
                        <span>Cost Breakdown ({estimate.lineItems.length} items)</span>
                        <span>{expanded ? '▼' : '▶'}</span>
                    </button>

                    {expanded && estimate.lineItems.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                            {estimate.lineItems.map((item, index) => (
                                <div
                                    key={item.id || index}
                                    style={{
                                        padding: 'var(--spacing-md)',
                                        background: 'var(--color-bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        borderLeft: '3px solid var(--color-accent-primary)'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
                                        <span style={{ fontWeight: 500 }}>{item.label}</span>
                                        <span style={{ fontWeight: 600, color: 'var(--color-accent-light)' }}>
                                            {calculatorEngine.formatCost(period === 'annual' ? item.subtotal * 12 : item.subtotal)}
                                        </span>
                                    </div>

                                    {item.details && (
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                            {item.details}
                                        </div>
                                    )}

                                    <div style={{
                                        fontSize: 'var(--font-size-xs)',
                                        color: 'var(--color-text-tertiary)',
                                        marginTop: 'var(--spacing-xs)',
                                        fontFamily: 'var(--font-family-mono)'
                                    }}>
                                        {item.quantity.toFixed(2)} × {calculatorEngine.formatCost(item.unitPrice)} {item.unit}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {expanded && estimate.lineItems.length === 0 && (
                        <div className="alert alert-info">
                            No cost components calculated. Adjust your configuration and usage.
                        </div>
                    )}
                </div>

                {/* Assumptions */}
                {estimate.assumptions && estimate.assumptions.length > 0 && (
                    <details style={{ marginTop: 'var(--spacing-lg)' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: 500, marginBottom: 'var(--spacing-sm)' }}>
                            Assumptions ({estimate.assumptions.length})
                        </summary>
                        <ul style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-muted)',
                            paddingLeft: 'var(--spacing-lg)',
                            margin: 0
                        }}>
                            {estimate.assumptions.map((assumption, index) => (
                                <li key={index} style={{ marginBottom: 'var(--spacing-xs)' }}>
                                    {assumption}
                                </li>
                            ))}
                        </ul>
                    </details>
                )}

                {/* Export */}
                <div style={{ marginTop: 'var(--spacing-lg)', display: 'flex', gap: 'var(--spacing-sm)' }}>
                    <button className="btn btn-sm" onClick={() => handleExport('json')} style={{ flex: 1 }}>
                        Export JSON
                    </button>
                    <button className="btn btn-sm" onClick={() => handleExport('csv')} style={{ flex: 1 }}>
                        Export CSV
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CostBreakdown;
