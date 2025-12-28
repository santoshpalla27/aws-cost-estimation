import React, { useState, useEffect } from 'react';
import { SchemaEngine } from '@/schema/schema.engine';
import { ServiceSchema } from '@/schema/schema.contract';
import { UsageEngine } from '@/engine/usage.engine';
import { pricingEngine } from '@/engine/pricing.engine';
import { calculatorEngine, CostEstimate } from '@/engine/calculator.engine';
import './index.css';
import './App.css';

// Import UI components
import ServiceConfigurator from './ui/ServiceConfigurator';
import CostBreakdown from './ui/CostBreakdown';

const AVAILABLE_SERVICES = [
    { id: 'vpc', name: 'Amazon VPC' },
    { id: 'ec2', name: 'Amazon EC2' },
];

const AVAILABLE_REGIONS = [
    { id: 'us-east-1', name: 'US East (N. Virginia)' },
    { id: 'us-east-2', name: 'US East (Ohio)' },
    { id: 'us-west-1', name: 'US West (N. California)' },
    { id: 'us-west-2', name: 'US West (Oregon)' },
    { id: 'eu-west-1', name: 'Europe (Ireland)' },
    { id: 'eu-central-1', name: 'Europe (Frankfurt)' },
    { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
    { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)' },
];

function App() {
    const [selectedService, setSelectedService] = useState('vpc');
    const [selectedRegion, setSelectedRegion] = useState('us-east-1');
    const [schemaEngine] = useState(() => new SchemaEngine());
    const [usageEngine] = useState(() => new UsageEngine());
    const [schema, setSchema] = useState<ServiceSchema | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [estimate, setEstimate] = useState<CostEstimate | null>(null);

    // Load schema when service changes
    useEffect(() => {
        loadSchema();
    }, [selectedService]);

    // Load pricing data when region changes
    useEffect(() => {
        loadPricingData();
    }, [selectedService, selectedRegion]);

    const loadSchema = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/schemas/${selectedService}.schema.json`);

            if (!response.ok) {
                throw new Error(`Failed to load schema: ${response.statusText}`);
            }

            const schemaData = await response.json();

            // Load and validate schema
            await schemaEngine.load(schemaData);
            setSchema(schemaEngine.getSchema());

            // Initialize usage engine with schema dimensions
            usageEngine.initialize(schemaEngine.getUsageDimensions());

            setLoading(false);
        } catch (err) {
            console.error('Error loading schema:', err);
            setError(err instanceof Error ? err.message : 'Failed to load schema');
            setLoading(false);
        }
    };

    const loadPricingData = async () => {
        try {
            await pricingEngine.load(selectedService, selectedRegion);
        } catch (err) {
            console.error('Error loading pricing data:', err);
            // Non-fatal - continue with schema
        }
    };

    const handleCalculate = async (formState: Record<string, unknown>) => {
        if (!schema) return;

        try {
            const usageState = usageEngine.getState();
            const formulas = schemaEngine.getFormulas();

            const newEstimate = await calculatorEngine.calculate(
                selectedService,
                selectedRegion,
                formulas,
                formState,
                usageState
            );

            setEstimate(newEstimate);
        } catch (err) {
            console.error('Error calculating costs:', err);
        }
    };

    return (
        <div className="app">
            <header className="app-header">
                <div className="container">
                    <h1>AWS Cost Estimator</h1>
                    <p className="subtitle">Production-grade, schema-driven cost estimation</p>
                </div>
            </header>

            <div className="container">
                <div className="controls">
                    <div className="control-group">
                        <label htmlFor="service-select">Service</label>
                        <select
                            id="service-select"
                            className="form-select"
                            value={selectedService}
                            onChange={(e) => setSelectedService(e.target.value)}
                        >
                            {AVAILABLE_SERVICES.map((service) => (
                                <option key={service.id} value={service.id}>
                                    {service.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="control-group">
                        <label htmlFor="region-select">Region</label>
                        <select
                            id="region-select"
                            className="form-select"
                            value={selectedRegion}
                            onChange={(e) => setSelectedRegion(e.target.value)}
                        >
                            {AVAILABLE_REGIONS.map((region) => (
                                <option key={region.id} value={region.id}>
                                    {region.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading && (
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Loading schema...</p>
                    </div>
                )}

                {error && (
                    <div className="error-banner">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                {!loading && !error && schema && (
                    <div className="main-content">
                        <div className="configurator-panel">
                            <ServiceConfigurator
                                schemaEngine={schemaEngine}
                                usageEngine={usageEngine}
                                onCalculate={handleCalculate}
                            />
                        </div>

                        <div className="breakdown-panel">
                            <CostBreakdown
                                estimate={estimate}
                                loading={false}
                            />
                        </div>
                    </div>
                )}
            </div>

            <footer className="app-footer">
                <div className="container">
                    <p>
                        Schema-driven architecture • No AWS SDK in browser • Fully static deployment
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default App;
