import React from 'react';
import type { DiffResponse } from '../../types/api';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DiffViewerProps {
    diff: DiffResponse;
}

export default function DiffViewer({ diff }: DiffViewerProps) {
    const { before_total, after_total, total_delta, percent_change } = diff.diff;

    const isIncrease = total_delta >= 0;

    return (
        <div className="card">
            <h2 className="text-2xl font-bold mb-6">Cost Difference</h2>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div>
                    <p className="text-sm text-gray-500 mb-1">Before</p>
                    <p className="text-2xl font-bold">${before_total.toFixed(2)}</p>
                </div>

                <div>
                    <p className="text-sm text-gray-500 mb-1">After</p>
                    <p className="text-2xl font-bold">${after_total.toFixed(2)}</p>
                </div>

                <div>
                    <p className="text-sm text-gray-500 mb-1">Delta</p>
                    <div className="flex items-center gap-2">
                        {isIncrease ? (
                            <>
                                <TrendingUp className="w-5 h-5 text-red-500" />
                                <p className="text-2xl font-bold text-red-600">
                                    +${Math.abs(total_delta).toFixed(2)}
                                </p>
                            </>
                        ) : (
                            <>
                                <TrendingDown className="w-5 h-5 text-green-500" />
                                <p className="text-2xl font-bold text-green-600">
                                    -${Math.abs(total_delta).toFixed(2)}
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <div>
                    <p className="text-sm text-gray-500 mb-1">Change</p>
                    <p className={`text-2xl font-bold ${isIncrease ? 'text-red-600' : 'text-green-600'}`}>
                        {isIncrease ? '+' : ''}{percent_change.toFixed(1)}%
                    </p>
                </div>
            </div>

            {/* Service Deltas */}
            {diff.diff.service_deltas && Object.keys(diff.diff.service_deltas).length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold mb-4">Service Changes</h3>
                    <div className="space-y-2">
                        {Object.entries(diff.diff.service_deltas).map(([service, delta]) => (
                            <div key={service} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="font-medium">{service}</span>
                                <span className={`font-semibold ${delta >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {delta >= 0 ? '+' : ''}${delta.toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Resource Changes */}
            {diff.diff.resource_changes && diff.diff.resource_changes.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">Resource Changes</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Before</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">After</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Delta</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {diff.diff.resource_changes.map((change) => (
                                    <tr key={change.address} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-mono text-sm">{change.address}</td>
                                        <td className="px-4 py-3 text-right">${change.before_cost.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-right">${change.after_cost.toFixed(2)}</td>
                                        <td className={`px-4 py-3 text-right font-semibold ${change.delta >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {change.delta >= 0 ? '+' : ''}${change.delta.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`badge ${change.status === 'added' ? 'badge-info' :
                                                    change.status === 'removed' ? 'badge-error' :
                                                        change.status === 'modified' ? 'badge-warning' :
                                                            'bg-gray-100 text-gray-800'
                                                }`}>
                                                {change.status.toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
