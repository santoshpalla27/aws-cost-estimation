import { useState, useEffect } from 'react';
import { ServiceSchema, ServiceFormState, CostEstimate } from '@types/schema.types';
import ServiceConfigurator from '@ui/ServiceConfigurator';
import CostBreakdown from '@ui/CostBreakdown';

// AWS Regions
const AWS_REGIONS = [
    { value: 'us-east-1', label: 'US East (N. Virginia)' },
    { value: 'us-east-2', label: 'US East (Ohio)' },
    { value: 'us-west-1', label: 'US West (N. California)' },
    { value: 'us-west-2', label: 'US West (Oregon)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
];

// Available Services
const SERVICES = [
    { value: 'vpc', label: 'Amazon VPC', icon: '🌐' },
    { value: 'ec2', label: 'Amazon EC2', icon: '💻' },
];

function App() {
    const [selectedService, setSelectedService] = useState<string>('vpc');
    const [selectedRegion, setSelectedRegion] = useState<string>('us-east-1');
    const [schema, setSchema] = useState<ServiceSchema | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [estimate, setEstimate] = useState<CostEstimate | null>(null);

    // Load schema when service changes
    useEffect(() => {
        loadSchema(selectedService);
    }, [selectedService]);

    const loadSchema = async (service: string) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/src/schemas/${service}.schema.json`);

            if (!response.ok) {
                throw new Error(`Failed to load schema: ${response.statusText}`);
            }

            const schemaData: ServiceSchema = await response.json();
            setSchema(schemaData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load schema');
            setSchema(null);
        } finally {
            setLoading(false);
        }
    };

    const handleEstimateUpdate = (newEstimate: CostEstimate) => {
        setEstimate(newEstimate);
    };

    return (
        <div className="container">
            {/* Header */}
            <header style={{ marginBottom: 'var(--spacing-2xl)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                    <div style={{ fontSize: '2.5rem' }}>☁️</div>
                    <div>
                        <h1 style={{ marginBottom: 'var(--spacing-xs)' }}>AWS Cost Estimator</h1>
                        <p style={{ margin: 0, color: 'var(--color-text-tertiary)' }}>
                            Production-grade cost estimation for AWS services
                        </p>
                    </div>
                </div>

                {/* Service & Region Selector */}
                <div className="card">
                    <div className="grid grid-2">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Service</label>
                            <select
                                className="form-select"
                                value={selectedService}
                                onChange={(e) => setSelectedService(e.target.value)}
                            >
                                {SERVICES.map((service) => (
                                    <option key={service.value} value={service.value}>
                                        {service.icon} {service.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Region</label>
                            <select
                                className="form-select"
                                value={selectedRegion}
                                onChange={(e) => setSelectedRegion(e.target.value)}
                            >
                                {AWS_REGIONS.map((region) => (
                                    <option key={region.value} value={region.value}>
                                        {region.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            {loading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-2xl)' }}>
                    <div className="spinner" />
                </div>
            )}

            {error && (
                <div className="alert alert-error">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {schema && !loading && (
                <div className="grid" style={{ gridTemplateColumns: '1fr 400px', gap: 'var(--spacing-xl)', alignItems: 'start' }}>
                    {/* Configuration Panel */}
                    <div>
                        <ServiceConfigurator
                            schema={schema}
                            region={selectedRegion}
                            onEstimateUpdate={handleEstimateUpdate}
                        />
                    </div>

                    {/* Cost Breakdown Panel */}
                    <div style={{ position: 'sticky', top: 'var(--spacing-lg)' }}>
                        <CostBreakdown estimate={estimate} />
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer style={{ marginTop: 'var(--spacing-2xl)', paddingTop: 'var(--spacing-xl)', borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
                <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)' }}>
                    Pricing data is for estimation purposes only. Actual costs may vary.
                    <br />
                    Last updated: {new Date().toLocaleDateString()}
                </p>
            </footer>
        </div>
    );
}

export default App;
