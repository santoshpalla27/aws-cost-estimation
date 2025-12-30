import { CostEstimate } from '../types/cost';

interface CostSummaryProps {
    estimate: CostEstimate;
}

export function CostSummary({ estimate }: CostSummaryProps) {
    const formatCost = (cost: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: estimate.currency || 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(cost);
    };

    const resourceCount = estimate.by_resource.length;
    const serviceCount = Object.keys(estimate.by_service).length;

    return (
        <div className="cost-summary">
            <h2>Estimated Monthly Cost</h2>
            <div className="cost-amount">
                {formatCost(estimate.total_monthly_cost)}
            </div>
            <div className="cost-meta">
                <div className="cost-meta-item">
                    <span>Resources:</span>
                    {resourceCount}
                </div>
                <div className="cost-meta-item">
                    <span>Services:</span>
                    {serviceCount}
                </div>
                <div className="cost-meta-item">
                    <span>Confidence:</span>
                    <span className={`confidence-badge confidence-${estimate.overall_confidence}`}>
                        {estimate.overall_confidence}
                    </span>
                </div>
                <div className="cost-meta-item">
                    <span>Catalog:</span>
                    {estimate.metadata.catalog_version}
                </div>
            </div>
        </div>
    );
}
