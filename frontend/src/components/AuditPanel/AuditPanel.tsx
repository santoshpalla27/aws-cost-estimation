import React from 'react';
import type { Estimate } from '../../types/api';
import { Download, Copy, Clock, Hash, Shield } from 'lucide-react';

interface AuditPanelProps {
    estimate: Estimate;
}

export default function AuditPanel({ estimate }: AuditPanelProps) {
    const handleDownloadJSON = () => {
        const dataStr = JSON.stringify(estimate, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `cost-estimate-${estimate.id}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const handleCopyAuditInfo = async () => {
        const auditInfo = `
Cost Estimate Audit Trail
==========================
Estimate ID: ${estimate.id}
Catalog Version: ${estimate.catalog_version}
Evaluation Mode: ${estimate.evaluation_mode || 'CONSERVATIVE'}
Input Hash: ${estimate.input_hash}
Timestamp: ${new Date().toISOString()}
Total Cost: $${estimate.total_cost.toFixed(2)} ${estimate.currency}
Confidence: ${estimate.confidence}
Resources: ${estimate.resources.length}
Cost Items: ${estimate.cost_items.length}
    `.trim();

        await navigator.clipboard.writeText(auditInfo);
        alert('Audit info copied to clipboard!');
    };

    return (
        <div className="card">
            <h2 className="text-2xl font-bold mb-6">Audit & Reproducibility</h2>

            {/* Audit Trail */}
            <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                    <Hash className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm text-gray-500">Estimate ID</p>
                        <p className="font-mono text-sm">{estimate.id}</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm text-gray-500">Pricing Catalog Version</p>
                        <p className="font-mono text-sm">{estimate.catalog_version}</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Hash className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm text-gray-500">Input Hash (SHA256)</p>
                        <p className="font-mono text-xs break-all">{estimate.input_hash}</p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm text-gray-500">Timestamp</p>
                        <p className="text-sm">{new Date().toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Determinism Notice */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                <p className="text-sm font-medium text-blue-900">🔒 Deterministic Estimate</p>
                <p className="text-xs text-blue-800 mt-1">
                    Same input + same catalog version = same output, always
                </p>
            </div>

            {/* Export Actions */}
            <div className="flex gap-3">
                <button
                    onClick={handleDownloadJSON}
                    className="btn-primary flex items-center gap-2"
                >
                    <Download className="w-4 h-4" />
                    Download JSON
                </button>

                <button
                    onClick={handleCopyAuditInfo}
                    className="btn-secondary flex items-center gap-2"
                >
                    <Copy className="w-4 h-4" />
                    Copy Audit Info
                </button>
            </div>

            {/* Reproducibility Instructions */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-2">Reproducibility Instructions</p>
                <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                    <li>Save the downloaded JSON file</li>
                    <li>Use the same Terraform input (hash: {estimate.input_hash.substring(0, 8)}...)</li>
                    <li>Use catalog version: {estimate.catalog_version}</li>
                    <li>Use evaluation mode: {estimate.evaluation_mode || 'CONSERVATIVE'}</li>
                    <li>Re-run estimation → results will be identical</li>
                </ol>
            </div>
        </div>
    );
}
