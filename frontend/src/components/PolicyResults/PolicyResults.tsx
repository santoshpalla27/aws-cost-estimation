import React from 'react';
import type { PolicyResponse } from '../../types/api';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface PolicyResultsProps {
    results: PolicyResponse;
}

export default function PolicyResults({ results }: PolicyResultsProps) {
    const passedPolicies = results.results.filter(r => r.outcome === 'PASS');
    const warnings = results.results.filter(r => r.outcome === 'WARN');
    const failures = results.results.filter(r => r.outcome === 'FAIL');

    return (
        <div className="card">
            <h2 className="text-2xl font-bold mb-6">Policy Evaluation</h2>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <p className="font-semibold text-green-900">Passed</p>
                    </div>
                    <p className="text-2xl font-bold text-green-700">{passedPolicies.length}</p>
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-5 h-5 text-yellow-600" />
                        <p className="font-semibold text-yellow-900">Warnings</p>
                    </div>
                    <p className="text-2xl font-bold text-yellow-700">{warnings.length}</p>
                </div>

                <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <p className="font-semibold text-red-900">Failures</p>
                    </div>
                    <p className="text-2xl font-bold text-red-700">{failures.length}</p>
                </div>
            </div>

            {/* Failures (Most Important) */}
            {failures.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-red-900 mb-3">❌ Policy Violations</h3>
                    <div className="space-y-3">
                        {failures.map((policy, idx) => (
                            <div key={idx} className="border-2 border-red-300 bg-red-50 rounded-lg p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-semibold text-red-900">{policy.policy_name}</p>
                                        <p className="text-sm text-red-800 mt-1">{policy.message}</p>
                                        {policy.actual_value !== undefined && policy.threshold !== undefined && (
                                            <p className="text-xs text-red-700 mt-2">
                                                Actual: {policy.actual_value} | Threshold: {policy.threshold}
                                            </p>
                                        )}
                                    </div>
                                    <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg">
                        <p className="font-bold text-red-900">⛔ Action Blocked</p>
                        <p className="text-sm text-red-800 mt-1">
                            Cannot approve deployment until policy violations are resolved
                        </p>
                    </div>
                </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-semibold text-yellow-900 mb-3">⚠️ Warnings</h3>
                    <div className="space-y-2">
                        {warnings.map((policy, idx) => (
                            <div key={idx} className="border border-yellow-300 bg-yellow-50 rounded-lg p-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-medium text-yellow-900">{policy.policy_name}</p>
                                        <p className="text-sm text-yellow-800 mt-1">{policy.message}</p>
                                        {policy.actual_value !== undefined && policy.threshold !== undefined && (
                                            <p className="text-xs text-yellow-700 mt-1">
                                                Actual: {policy.actual_value} | Threshold: {policy.threshold}
                                            </p>
                                        )}
                                    </div>
                                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Passed Policies */}
            {passedPolicies.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold text-green-900 mb-3">✓ Passed Policies</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {passedPolicies.map((policy, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-green-50 rounded">
                                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                <p className="text-sm text-green-900">{policy.policy_name}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* All Passed */}
            {failures.length === 0 && warnings.length === 0 && passedPolicies.length > 0 && (
                <div className="mt-4 p-4 bg-green-100 border border-green-300 rounded-lg">
                    <p className="font-bold text-green-900">✓ All Policies Passed</p>
                    <p className="text-sm text-green-800 mt-1">
                        Deployment approved - no policy violations detected
                    </p>
                </div>
            )}
        </div>
    );
}
