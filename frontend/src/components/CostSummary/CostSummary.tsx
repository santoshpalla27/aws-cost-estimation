import React from 'react';
import type { Estimate } from '../../types/api';
import ConfidenceBadge from '../ConfidenceBadge/ConfidenceBadge';
import { DollarSign, TrendingUp, Settings } from 'lucide-react';

interface CostSummaryProps {
    estimate: Estimate;
}

export default function CostSummary({ estimate }: CostSummaryProps) {
    return (
        <div className="card">
            <h2 className="text-2xl font-bold mb-6">Cost Summary</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Total Cost */}
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-brand-100 rounded-lg">
                        <DollarSign className="w-6 h-6 text-brand-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Total Monthly Cost</p>
                        <p className="text-3xl font-bold text-gray-900">
                            ${estimate.total_cost.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">{estimate.currency}</p>
                    </div>
                </div>

                {/* Confidence */}
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                        <TrendingUp className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Confidence Level</p>
                        <div className="mt-2">
                            <ConfidenceBadge level={estimate.confidence} size="lg" />
                        </div>
                    </div>
                </div>

                {/* Evaluation Mode */}
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                        <Settings className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Evaluation Mode</p>
                        <p className="text-xl font-semibold text-gray-900 mt-1">
                            {estimate.evaluation_mode || 'CONSERVATIVE'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Metadata */}
            <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <p className="text-gray-500">Resources</p>
                        <p className="font-semibold">{estimate.resources.length}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Cost Items</p>
                        <p className="font-semibold">{estimate.cost_items.length}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Services</p>
                        <p className="font-semibold">{Object.keys(estimate.service_breakdown).length}</p>
                    </div>
                    <div>
                        <p className="text-gray-500">Catalog</p>
                        <p className="font-semibold">{estimate.catalog_version}</p>
                    </div>
                </div>
            </div>

            {/* Assumptions Warning */}
            {estimate.assumptions.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm font-medium text-yellow-800">
                        ⚠️ {estimate.assumptions.length} assumption(s) made
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                        Review assumptions panel for details
                    </p>
                </div>
            )}
        </div>
    );
}
