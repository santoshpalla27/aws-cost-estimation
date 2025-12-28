import { useState, useEffect } from 'react';
import { ServiceSchema, ServiceFormState, CostEstimate } from '@types/schema.types';
import { dependencyEngine } from '@engine/dependency.engine';
import { usageEngine } from '@engine/usage.engine';
import { calculatorEngine } from '@engine/calculator.engine';
import { pricingEngine } from '@engine/pricing.engine';
import DynamicField from './DynamicField';
import UsageSlider from './UsageSlider';

interface ServiceConfiguratorProps {
    schema: ServiceSchema;
    region: string;
    onEstimateUpdate: (estimate: CostEstimate) => void;
}

function ServiceConfigurator({ schema, region, onEstimateUpdate }: ServiceConfiguratorProps) {
    const [formState, setFormState] = useState<ServiceFormState>({
        service: schema.service,
        region,
        fields: {},
        usage: {},
    });

    const [activeGroup, setActiveGroup] = useState<string | null>(
        schema.groups?.find(g => g.defaultExpanded)?.id || schema.groups?.[0]?.id || null
    );

    // Initialize form with defaults
    useEffect(() => {
        const initialFields: Record<string, unknown> = {};

        schema.fields.forEach(field => {
            if (field.default !== undefined) {
                initialFields[field.id] = field.default;
            }
        });

        setFormState(prev => ({
            ...prev,
            fields: initialFields,
            service: schema.service,
            region,
        }));

        // Initialize usage engine
        usageEngine.initialize(schema.usage);
        setFormState(prev => ({
            ...prev,
            usage: usageEngine.getUsageState(),
        }));
    }, [schema, region]);

    // Recalculate costs when form or usage changes
    useEffect(() => {
        calculateCosts();
    }, [formState]);

    const calculateCosts = async () => {
        try {
            // For demo purposes, we'll use mock pricing data
            // In production, this would load from static JSON files
            const mockPricingRecords = new Map();

            const estimate = await calculatorEngine.calculate(
                schema.service,
                region,
                formState,
                formState.usage,
                schema.formulas,
                mockPricingRecords
            );

            onEstimateUpdate(estimate);
        } catch (error) {
            console.error('Cost calculation error:', error);
        }
    };

    const handleFieldChange = (fieldId: string, value: unknown) => {
        setFormState(prev => ({
            ...prev,
            fields: {
                ...prev.fields,
                [fieldId]: value,
            },
        }));
    };

    const handleUsageChange = (dimensionId: string, value: number) => {
        usageEngine.setUsage(dimensionId, value);
        setFormState(prev => ({
            ...prev,
            usage: usageEngine.getUsageState(),
        }));
    };

    const applyUsageProfile = (profile: 'low' | 'medium' | 'high') => {
        usageEngine.applyProfile(profile);
        setFormState(prev => ({
            ...prev,
            usage: usageEngine.getUsageState(),
        }));
    };

    const getFieldsByGroup = (groupId: string) => {
        const group = schema.groups?.find(g => g.id === groupId);
        if (!group) return [];

        return schema.fields.filter(field => group.fields.includes(field.id));
    };

    const getUngroupedFields = () => {
        if (!schema.groups || schema.groups.length === 0) {
            return schema.fields;
        }

        const groupedFieldIds = new Set(
            schema.groups.flatMap(g => g.fields)
        );

        return schema.fields.filter(field => !groupedFieldIds.has(field.id));
    };

    return (
        <div>
            {/* Service Info */}
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="card-header">
                    <div>
                        <h2 className="card-title">{schema.metadata.displayName}</h2>
                        <p style={{ margin: 0, color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                            {schema.metadata.description}
                        </p>
                    </div>
                    <span className="badge badge-primary">{schema.metadata.category}</span>
                </div>
            </div>

            {/* Configuration Fields */}
            <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="card-header">
                    <h3 className="card-title">Configuration</h3>
                </div>

                {schema.groups && schema.groups.length > 0 ? (
                    <div>
                        {schema.groups.map(group => {
                            const isActive = activeGroup === group.id;
                            const fields = getFieldsByGroup(group.id);

                            return (
                                <div key={group.id} style={{ marginBottom: 'var(--spacing-md)' }}>
                                    <button
                                        className="btn"
                                        style={{ width: '100%', justifyContent: 'space-between' }}
                                        onClick={() => setActiveGroup(isActive ? null : group.id)}
                                    >
                                        <span>{group.label}</span>
                                        <span>{isActive ? '▼' : '▶'}</span>
                                    </button>

                                    {isActive && (
                                        <div style={{ marginTop: 'var(--spacing-md)', paddingLeft: 'var(--spacing-md)' }}>
                                            {group.description && (
                                                <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-md)' }}>
                                                    {group.description}
                                                </p>
                                            )}

                                            {fields.map(field => (
                                                <DynamicField
                                                    key={field.id}
                                                    field={field}
                                                    value={formState.fields[field.id]}
                                                    formState={formState}
                                                    onChange={(value) => handleFieldChange(field.id, value)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Ungrouped fields */}
                        {getUngroupedFields().map(field => (
                            <DynamicField
                                key={field.id}
                                field={field}
                                value={formState.fields[field.id]}
                                formState={formState}
                                onChange={(value) => handleFieldChange(field.id, value)}
                            />
                        ))}
                    </div>
                ) : (
                    <div>
                        {schema.fields.map(field => (
                            <DynamicField
                                key={field.id}
                                field={field}
                                value={formState.fields[field.id]}
                                formState={formState}
                                onChange={(value) => handleFieldChange(field.id, value)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Usage Configuration */}
            {schema.usage && schema.usage.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Usage Assumptions</h3>
                        <div className="flex gap-sm">
                            <button className="btn btn-sm" onClick={() => applyUsageProfile('low')}>
                                Low
                            </button>
                            <button className="btn btn-sm" onClick={() => applyUsageProfile('medium')}>
                                Medium
                            </button>
                            <button className="btn btn-sm" onClick={() => applyUsageProfile('high')}>
                                High
                            </button>
                        </div>
                    </div>

                    <div>
                        {schema.usage
                            .filter(dimension => dimension.type !== 'calculated')
                            .map(dimension => (
                                <UsageSlider
                                    key={dimension.id}
                                    dimension={dimension}
                                    value={formState.usage[dimension.id] || dimension.default}
                                    onChange={(value) => handleUsageChange(dimension.id, value)}
                                />
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ServiceConfigurator;
