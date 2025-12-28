import React, { useState, useEffect } from 'react';
import { SchemaEngine, FormState } from '@/schema/schema.engine';
import { UsageEngine, UsagePreset } from '@/engine/usage.engine';
import DynamicField from './DynamicField';
import UsageSlider from './UsageSlider';
import UsageProfileSelector from './UsageProfileSelector';
import './ServiceConfigurator.css';
import './ServiceConfiguratorEnhanced.css';
import './PresetButtons.css';

interface ServiceConfiguratorProps {
    schemaEngine: SchemaEngine;
    usageEngine: UsageEngine;
    onCalculate: (formState: FormState) => void;
}

const ServiceConfigurator: React.FC<ServiceConfiguratorProps> = ({
    schemaEngine,
    usageEngine,
    onCalculate,
}) => {
    const [formState, setFormState] = useState<FormState>(() =>
        schemaEngine.getDefaultFormState()
    );
    const [usageState, setUsageState] = useState(() => usageEngine.getState());
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

    const schema = schemaEngine.getSchema();
    const groups = schemaEngine.getVisibleGroups(formState);
    const dimensions = usageEngine.getDimensions();

    // Auto-calculate on state changes
    useEffect(() => {
        onCalculate(formState);
    }, [formState, usageState]);

    const handleFieldChange = (fieldId: string, value: unknown) => {
        setFormState((prev) => ({
            ...prev,
            [fieldId]: value,
        }));
    };

    const handleUsageChange = (dimensionId: string, value: number) => {
        usageEngine.setValue(dimensionId, value);
        setUsageState(usageEngine.getState());
    };

    const handleUsagePreset = (preset: UsagePreset) => {
        usageEngine.applyPreset(preset);
        setUsageState(usageEngine.getState());
    };

    const handleProfileSelect = (profileId: string) => {
        setSelectedProfile(profileId);
        usageEngine.applyProfile(profileId);
        setUsageState(usageEngine.getState());
    };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    };

    return (
        <div className="service-configurator">
            <div className="configurator-header">
                <h2>{schema.metadata.displayName}</h2>
                <p className="description">{schema.metadata.description}</p>
            </div>

            {/* Configuration Fields */}
            <div className="configuration-section">
                <h3>Configuration</h3>

                {groups.length > 0 ? (
                    groups.map((group) => {
                        const isExpanded = expandedGroups.has(group.id) || group.defaultExpanded;
                        const groupFields = group.fields
                            .map((fieldId) => schemaEngine.getField(fieldId))
                            .filter((field) => field && schemaEngine.isFieldVisible(field.id, formState));

                        if (groupFields.length === 0) return null;

                        return (
                            <div key={group.id} className="field-group">
                                <button
                                    className="group-header"
                                    onClick={() => toggleGroup(group.id)}
                                    aria-expanded={isExpanded}
                                >
                                    <span className="group-title">{group.label}</span>
                                    <span className={`group-icon ${isExpanded ? 'expanded' : ''}`}>
                                        ▼
                                    </span>
                                </button>

                                {group.description && (
                                    <p className="group-description">{group.description}</p>
                                )}

                                {isExpanded && (
                                    <div className="group-fields">
                                        {groupFields.map((field) => (
                                            <DynamicField
                                                key={field!.id}
                                                field={field!}
                                                value={formState[field!.id]}
                                                onChange={(value) => handleFieldChange(field!.id, value)}
                                                formState={formState}
                                                schemaEngine={schemaEngine}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    // No groups - render all visible fields
                    <div className="field-list">
                        {schemaEngine.getVisibleFields(formState).map((field) => (
                            <DynamicField
                                key={field.id}
                                field={field}
                                value={formState[field.id]}
                                onChange={(value) => handleFieldChange(field.id, value)}
                                formState={formState}
                                schemaEngine={schemaEngine}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Usage Assumptions */}
            {dimensions.length > 0 && (
                <div className="usage-section">
                    <div className="usage-header">
                        <h3>Usage Assumptions</h3>

                        {/* Usage Profile Selector */}
                        <UsageProfileSelector
                            selectedProfile={selectedProfile}
                            onSelectProfile={handleProfileSelect}
                        />

                        <div className="usage-presets">
                            <button
                                className="btn-preset btn-preset-low"
                                onClick={() => handleUsagePreset('low')}
                                title="Low usage profile"
                            >
                                <span className="preset-icon">📊</span>
                                <span className="preset-label">Low</span>
                            </button>
                            <button
                                className="btn-preset btn-preset-medium"
                                onClick={() => handleUsagePreset('medium')}
                                title="Medium usage profile"
                            >
                                <span className="preset-icon">📈</span>
                                <span className="preset-label">Medium</span>
                            </button>
                            <button
                                className="btn-preset btn-preset-high"
                                onClick={() => handleUsagePreset('high')}
                                title="High usage profile"
                            >
                                <span className="preset-icon">🚀</span>
                                <span className="preset-label">High</span>
                            </button>
                        </div>
                    </div>

                    <div className="usage-dimensions">
                        {dimensions
                            .filter((dim) => dim.type !== 'calculated')
                            .map((dimension) => (
                                <UsageSlider
                                    key={dimension.id}
                                    dimension={dimension}
                                    value={usageState[dimension.id]}
                                    onChange={(value) => handleUsageChange(dimension.id, value)}
                                />
                            ))}
                    </div>

                    {/* Show calculated dimensions */}
                    {dimensions.some((dim) => dim.type === 'calculated') && (
                        <div className="calculated-dimensions">
                            <h4>Calculated Values</h4>
                            {dimensions
                                .filter((dim) => dim.type === 'calculated')
                                .map((dimension) => (
                                    <div key={dimension.id} className="calculated-item">
                                        <span className="label">{dimension.label}:</span>
                                        <span className="value">
                                            {usageState[dimension.id].toFixed(2)} {dimension.unit}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ServiceConfigurator;
