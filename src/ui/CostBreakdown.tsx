import React, { useState } from 'react';
import { CostEstimate } from '@/engine/calculator.engine';
import { calculatorEngine } from '@/engine';
import './CostBreakdown.css';
import './CostBreakdownItems.css';
import './CostBreakdownEnhanced.css';

interface CostBreakdownProps {
    estimate: CostEstimate | null;
    loading: boolean;
}

const CostBreakdown: React.FC<CostBreakdownProps> = ({ estimate, loading }) => {
    const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    if (loading) {
        return (
            <div className="cost-breakdown loading">
                <div className="spinner"></div>
                <p>Calculating costs...</p>
            </div>
        );
    }

    if (!estimate) {
        return (
            <div className="cost-breakdown empty">
                <div className="empty-state">
                    <h3>No Estimate Yet</h3>
                    <p>Configure your service to see cost estimates</p>
                </div>
            </div>
        );
    }

    const displayTotal = period === 'monthly'
        ? estimate.total
        : calculatorEngine.toAnnual(estimate.total);

    const toggleItem = (itemId: string) => {
        setExpandedItems((prev) => {
            const next = new Set(prev);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    };

    const handleExport = (format: 'json' | 'csv') => {
        const content = format === 'json'
            ? calculatorEngine.exportToJSON(estimate)
            : calculatorEngine.exportToCSV(estimate);

        const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `aws-cost-estimate-${estimate.service}-${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="cost-breakdown">
            <div className="breakdown-header">
                <h2>Cost Estimate</h2>
                <div className="period-toggle">
                    <button
                        className={`toggle-btn ${period === 'monthly' ? 'active' : ''}`}
                        onClick={() => setPeriod('monthly')}
                    >
                        Monthly
                    </button>
                    <button
                        className={`toggle-btn ${period === 'annual' ? 'active' : ''}`}
                        onClick={() => setPeriod('annual')}
                    >
                        Annual
                    </button>
                </div>
            </div>

            <div className="total-cost">
                <span className="total-label">Total Cost</span>
                <span className="total-amount">
                    {calculatorEngine.formatCost(displayTotal)}
                </span>
                <span className="total-period">/ {period === 'monthly' ? 'month' : 'year'}</span>
            </div>

            {estimate.lineItems.length > 0 && (
                <div className="cost-items">
                    <h3>Cost Breakdown</h3>
                    {estimate.lineItems.map((item) => {
                        const isExpanded = expandedItems.has(item.id);
                        const itemCost = period === 'monthly'
                            ? item.subtotal
                            : calculatorEngine.toAnnual(item.subtotal);

                        return (
                            <div key={item.id} className="cost-item">
                                <button
                                    className="item-header"
                                    onClick={() => toggleItem(item.id)}
                                    aria-expanded={isExpanded}
                                >
                                    <span className="item-label">{item.label}</span>
                                    <span className="item-cost">
                                        {calculatorEngine.formatCost(itemCost)}
                                    </span>
                                    <span className={`item-icon ${isExpanded ? 'expanded' : ''}`}>
                                        ▼
                                    </span>
                                </button>

                                {isExpanded && (
                                    <div className="item-details">
                                        {item.description && (
                                            <p className="item-description">{item.description}</p>
                                        )}
                                        <div className="item-formula">
                                            <strong>Formula:</strong> <code>{item.formula}</code>
                                        </div>
                                        <div className="item-calculation">
                                            <div>
                                                <strong>Quantity:</strong> {item.quantity.toFixed(2)} {item.unit}
                                            </div>
                                            <div>
                                                <strong>Unit Price:</strong> {calculatorEngine.formatCost(item.unitPrice)}
                                            </div>
                                            <div>
                                                <strong>Subtotal:</strong> {calculatorEngine.formatCost(item.subtotal)} / month
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {estimate.assumptions.length > 0 && (
                <div className="assumptions">
                    <h3>Assumptions</h3>
                    <ul className="assumptions-list">
                        {estimate.assumptions.map((assumption, index) => (
                            <li key={index}>{assumption}</li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="breakdown-actions">
                <button
                    className="btn-export"
                    onClick={() => handleExport('json')}
                >
                    Export JSON
                </button>
                <button
                    className="btn-export"
                    onClick={() => handleExport('csv')}
                >
                    Export CSV
                </button>
            </div>

            <div className="breakdown-footer">
                <p className="disclaimer">
                    * Estimates are based on AWS public pricing and may vary based on actual usage.
                    Prices are subject to change.
                </p>
            </div>
        </div>
    );
};

export default CostBreakdown;
