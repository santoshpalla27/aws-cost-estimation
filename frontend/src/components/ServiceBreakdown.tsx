import { ServiceCost } from '../types/cost';

interface ServiceBreakdownProps {
    services: Record<string, ServiceCost>;
}

const SERVICE_ICONS: Record<string, string> = {
    AmazonEC2: '💻',
    AmazonRDS: '🗄️',
    AmazonS3: '📦',
    AWSLambda: 'λ',
    AmazonDynamoDB: '📊',
    AmazonEKS: '☸️',
    AmazonECS: '🐳',
    default: '☁️',
};

export function ServiceBreakdown({ services }: ServiceBreakdownProps) {
    const sortedServices = Object.entries(services).sort(
        ([, a], [, b]) => b.monthly_cost - a.monthly_cost
    );

    const formatCost = (cost: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(cost);
    };

    if (sortedServices.length === 0) {
        return null;
    }

    return (
        <section className="breakdown-section">
            <h3>📊 Cost by Service</h3>
            <div className="service-grid">
                {sortedServices.map(([name, service]) => (
                    <div key={name} className="service-card">
                        <div className="service-name">
                            <span>{SERVICE_ICONS[name] || SERVICE_ICONS.default}</span>
                            {name}
                            <span className={`confidence-badge confidence-${service.confidence}`}>
                                {service.confidence}
                            </span>
                        </div>
                        <div className="service-cost">{formatCost(service.monthly_cost)}</div>
                        <div className="service-resources">
                            {service.resource_count} resource{service.resource_count !== 1 ? 's' : ''}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
