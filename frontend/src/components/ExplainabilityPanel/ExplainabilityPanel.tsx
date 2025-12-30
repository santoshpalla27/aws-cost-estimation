import React from 'react';
import type { Estimate } from '../../types/api';
import { AlertCircle, Info } from 'lucide-react';

interface ExplainabilityPanelProps {
    estimate: Estimate;
}

export default function ExplainabilityPanel({ estimate }: ExplainabilityPanelProps) {
    const mockedResources = estimate.resources.filter(r => r.is_mocked);

    return (
        <div className="card">
            <h2 className="text-2xl font-bold mb-6">Explainability & Assumptions</h2>

            {/* Assumptions */}
            {estimate.assumptions.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                        Assumptions Made
                    </h3>
                    <div className="space-y-2">
                        {estimate.assumptions.map((assumption, idx) => (
                            <div key={idx} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-900">{assumption}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Mocked Values */}
            {mockedResources.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Info className="w-5 h-5 text-blue-600" />
                        Mocked Values ({mockedResources.length} resources)
                    </h3>
                    <div className="space-y-4">
                        {mockedResources.map((resource) => (
                            <div key={resource.address} className="border border-gray-200 rounded-lg p-4">
                                <p className="font-mono text-sm font-semibold mb-2">{resource.address}</p>
                                {resource.mock_metadata && resource.mock_metadata.length > 0 ? (
                                    <div className="space-y-2">
                                        {resource.mock_metadata.map((mock, idx) => (
                                            <div key={idx} className="text-sm bg-gray-50 p-2 rounded">
                                                <p className="font-medium text-gray-700">{mock.field}: <span className="font-mono">{JSON.stringify(mock.value)}</span></p>
                                                <p className="text-gray-600 text-xs mt-1">Reason: {mock.reason}</p>
                                                <p className="text-gray-500 text-xs">Confidence: {mock.confidence}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No mock details available</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Evaluation Mode Impact */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Evaluation Mode Impact</h3>
                <p className="text-sm text-blue-800">
                    Mode: <span className="font-mono">{estimate.evaluation_mode || 'CONSERVATIVE'}</span>
                </p>
                <p className="text-xs text-blue-700 mt-1">
                    {estimate.evaluation_mode === 'STRICT' && 'STRICT mode: Fails on missing values'}
                    {estimate.evaluation_mode === 'CONSERVATIVE' && 'CONSERVATIVE mode: Higher cost assumptions for missing data'}
                    {estimate.evaluation_mode === 'OPTIMISTIC' && 'OPTIMISTIC mode: Lower cost assumptions for missing data'}
                    {!estimate.evaluation_mode && 'CONSERVATIVE mode: Higher cost assumptions for missing data (default)'}
                </p>
            </div>

            {/* No Issues */}
            {estimate.assumptions.length === 0 && mockedResources.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    <Info className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>No assumptions or mocked values - all data explicit</p>
                </div>
            )}
        </div>
    );
}
