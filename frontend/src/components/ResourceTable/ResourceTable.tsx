import React, { useState } from 'react';
import type { CostItem } from '../../types/api';
import ConfidenceBadge from '../ConfidenceBadge/ConfidenceBadge';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

interface ResourceTableProps {
    costItems: CostItem[];
    onSelectResource?: (address: string) => void;
}

export default function ResourceTable({ costItems, onSelectResource }: ResourceTableProps) {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<'cost' | 'confidence' | 'resource'>('cost');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const toggleRow = (address: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(address)) {
            newExpanded.delete(address);
        } else {
            newExpanded.add(address);
        }
        setExpandedRows(newExpanded);
    };

    const sortedItems = [...costItems].sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
            case 'cost':
                comparison = a.total_cost - b.total_cost;
                break;
            case 'confidence':
                const confidenceOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
                comparison = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
                break;
            case 'resource':
                comparison = a.resource_address.localeCompare(b.resource_address);
                break;
        }

        return sortOrder === 'desc' ? -comparison : comparison;
    });

    return (
        <div className="card">
            <h2 className="text-2xl font-bold mb-6">Resource Costs</h2>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left"></th>
                            <th
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                onClick={() => {
                                    if (sortBy === 'resource') {
                                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                        setSortBy('resource');
                                        setSortOrder('asc');
                                    }
                                }}
                            >
                                Resource {sortBy === 'resource' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                            <th
                                className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                onClick={() => {
                                    if (sortBy === 'cost') {
                                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                        setSortBy('cost');
                                        setSortOrder('desc');
                                    }
                                }}
                            >
                                Monthly Cost {sortBy === 'cost' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                                onClick={() => {
                                    if (sortBy === 'confidence') {
                                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                        setSortBy('confidence');
                                        setSortOrder('desc');
                                    }
                                }}
                            >
                                Confidence {sortBy === 'confidence' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Match</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {sortedItems.map((item) => (
                            <React.Fragment key={`${item.resource_address}-${item.usage_type}`}>
                                <tr className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => toggleRow(`${item.resource_address}-${item.usage_type}`)}
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            {expandedRows.has(`${item.resource_address}-${item.usage_type}`) ? (
                                                <ChevronDown className="w-4 h-4" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4" />
                                            )}
                                        </button>
                                    </td>
                                    <td
                                        className="px-4 py-3 font-mono text-sm text-gray-900 cursor-pointer hover:text-brand-600"
                                        onClick={() => onSelectResource?.(item.resource_address)}
                                    >
                                        {item.resource_address}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">{item.service}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                        ${item.total_cost.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <ConfidenceBadge level={item.confidence} showIcon={false} size="sm" />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`badge badge-${item.match_type === 'EXACT' ? 'success' : item.match_type === 'FALLBACK' ? 'warning' : 'info'}`}>
                                            {item.match_type}
                                        </span>
                                    </td>
                                </tr>

                                {expandedRows.has(`${item.resource_address}-${item.usage_type}`) && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-3 bg-gray-50">
                                            <div className="p-4 bg-white rounded border border-gray-200">
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-gray-500">Usage Type</p>
                                                        <p className="font-mono">{item.usage_type}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500">Region</p>
                                                        <p>{item.region}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500">Quantity</p>
                                                        <p>{item.quantity.toFixed(2)} {item.unit}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-gray-500">Price per Unit</p>
                                                        <p>${item.price_per_unit.toFixed(6)}</p>
                                                    </div>
                                                    {item.sku && (
                                                        <div>
                                                            <p className="text-gray-500">SKU</p>
                                                            <p className="font-mono text-xs">{item.sku}</p>
                                                        </div>
                                                    )}
                                                    {item.explanation && (
                                                        <div className="col-span-2">
                                                            <p className="text-gray-500">Formula</p>
                                                            <p className="font-mono text-sm">{item.explanation}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
