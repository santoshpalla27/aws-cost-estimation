import { useState } from 'react';
import { ResourceCost } from '../types/cost';

interface ResourceTableProps {
    resources: ResourceCost[];
}

export function ResourceTable({ resources }: ResourceTableProps) {
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const formatCost = (cost: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(cost);
    };

    const sortedResources = [...resources].sort(
        (a, b) => b.monthly_cost - a.monthly_cost
    );

    if (resources.length === 0) {
        return null;
    }

    return (
        <section className="breakdown-section">
            <h3>📋 Cost by Resource</h3>
            <table className="resource-table">
                <thead>
                    <tr>
                        <th>Resource</th>
                        <th>Type</th>
                        <th>Service</th>
                        <th>Monthly Cost</th>
                        <th>Confidence</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedResources.map((resource) => (
                        <>
                            <tr
                                key={resource.address}
                                className="expandable-row"
                                onClick={() =>
                                    setExpandedRow(
                                        expandedRow === resource.address ? null : resource.address
                                    )
                                }
                            >
                                <td className="resource-address">
                                    <span style={{ marginRight: '0.5rem' }}>
                                        {expandedRow === resource.address ? '▼' : '▶'}
                                    </span>
                                    {resource.address}
                                </td>
                                <td>{resource.type}</td>
                                <td>{resource.service}</td>
                                <td className="resource-cost">{formatCost(resource.monthly_cost)}</td>
                                <td>
                                    <span className={`confidence-badge confidence-${resource.confidence}`}>
                                        {resource.confidence}
                                    </span>
                                </td>
                            </tr>
                            {expandedRow === resource.address && resource.line_items.length > 0 && (
                                <>
                                    {resource.line_items.map((item, i) => (
                                        <tr key={`${resource.address}-${i}`} className="line-items">
                                            <td colSpan={2}>
                                                <span style={{ color: 'var(--text-tertiary)' }}>
                                                    {item.usage_type}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                                    {item.formula}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--accent-secondary)' }}>
                                                {formatCost(item.monthly_cost)}
                                            </td>
                                            <td>
                                                <span className={`confidence-badge confidence-${item.match_confidence}`}>
                                                    {Math.round(item.match_score * 100)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            )}
                        </>
                    ))}
                </tbody>
            </table>
        </section>
    );
}
