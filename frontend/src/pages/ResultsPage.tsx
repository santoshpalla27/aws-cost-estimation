import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../app/store';
import CostSummary from '../components/CostSummary/CostSummary';
import ServiceBreakdown from '../components/ServiceBreakdown/ServiceBreakdown';
import ResourceTable from '../components/ResourceTable/ResourceTable';
import ExplainabilityPanel from '../components/ExplainabilityPanel/ExplainabilityPanel';
import AuditPanel from '../components/AuditPanel/AuditPanel';
import { ArrowLeft } from 'lucide-react';

export default function ResultsPage() {
    const navigate = useNavigate();
    const { estimate, setSelectedResourceAddress } = useAppStore();

    if (!estimate) {
        navigate('/');
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <button
                        onClick={() => navigate('/')}
                        className="btn-secondary inline-flex items-center gap-2 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        New Estimate
                    </button>

                    <h1 className="text-3xl font-bold text-gray-900">
                        Cost Estimation Results
                    </h1>
                </div>

                {/* Content */}
                <div className="space-y-6">
                    {/* Cost Summary */}
                    <CostSummary estimate={estimate} />

                    {/* Service Breakdown */}
                    <ServiceBreakdown estimate={estimate} />

                    {/* Resource Table */}
                    <ResourceTable
                        costItems={estimate.cost_items}
                        onSelectResource={setSelectedResourceAddress}
                    />

                    {/* Explainability */}
                    <ExplainabilityPanel estimate={estimate} />

                    {/* Audit Panel */}
                    <AuditPanel estimate={estimate} />
                </div>
            </div>
        </div>
    );
}
