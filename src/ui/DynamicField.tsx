import React from 'react';
import { FieldDefinition } from '@/schema/schema.contract';
import { SchemaEngine, FormState } from '@/schema/schema.engine';
import './DynamicField.css';

interface DynamicFieldProps {
    field: FieldDefinition;
    value: unknown;
    onChange: (value: unknown) => void;
    formState: FormState;
    schemaEngine: SchemaEngine;
}

const DynamicField: React.FC<DynamicFieldProps> = ({
    field,
    value,
    onChange,
    formState,
    schemaEngine,
}) => {
    // Check if field is enabled
    const isEnabled = schemaEngine.isFieldEnabled(field.id, formState);

    // Check dependencies
    const dependenciesSatisfied = schemaEngine.areDependenciesSatisfied(field.id, formState);

    // Get warnings
    const warnings = schemaEngine.getFieldWarnings(field.id, formState);

    const renderInput = () => {
        switch (field.type) {
            case 'string':
                return (
                    <input
                        type="text"
                        className="form-input"
                        value={(value as string) || ''}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={!isEnabled}
                        placeholder={field.helpText}
                    />
                );

            case 'number':
                return (
                    <input
                        type="number"
                        className="form-input"
                        value={(value as number) || ''}
                        onChange={(e) => onChange(Number(e.target.value))}
                        disabled={!isEnabled}
                        min={field.validation?.min}
                        max={field.validation?.max}
                        placeholder={field.helpText}
                    />
                );

            case 'boolean':
                return (
                    <label className="checkbox-label">
                        <input
                            type="checkbox"
                            className="form-checkbox"
                            checked={(value as boolean) || false}
                            onChange={(e) => onChange(e.target.checked)}
                            disabled={!isEnabled}
                        />
                        <span>{field.label}</span>
                    </label>
                );

            case 'enum':
                return (
                    <select
                        className="form-select"
                        value={(value as string) || ''}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={!isEnabled}
                    >
                        <option value="">Select {field.label}</option>
                        {field.options?.map((option) => (
                            <option
                                key={option.value}
                                value={option.value}
                                disabled={option.disabled}
                            >
                                {option.label}
                            </option>
                        ))}
                    </select>
                );

            case 'multiselect':
                return (
                    <div className="multiselect">
                        {field.options?.map((option) => (
                            <label key={option.value} className="checkbox-label">
                                <input
                                    type="checkbox"
                                    className="form-checkbox"
                                    checked={Array.isArray(value) && value.includes(option.value)}
                                    onChange={(e) => {
                                        const currentValue = (value as unknown[]) || [];
                                        if (e.target.checked) {
                                            onChange([...currentValue, option.value]);
                                        } else {
                                            onChange(currentValue.filter((v) => v !== option.value));
                                        }
                                    }}
                                    disabled={!isEnabled || option.disabled}
                                />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </div>
                );

            default:
                return <div className="unsupported-field">Unsupported field type: {field.type}</div>;
        }
    };

    // Don't render boolean fields with labels (they render their own)
    const showLabel = field.type !== 'boolean';

    return (
        <div className={`field-wrapper ${!isEnabled ? 'disabled' : ''}`}>
            {showLabel && (
                <label className="field-label">
                    {field.label}
                    {field.required && <span className="required">*</span>}
                </label>
            )}

            {field.description && (
                <p className="field-description">{field.description}</p>
            )}

            {renderInput()}

            {field.helpText && field.type !== 'string' && field.type !== 'number' && (
                <p className="field-help">{field.helpText}</p>
            )}

            {!dependenciesSatisfied && (
                <p className="field-warning">
                    ⚠️ This field has unsatisfied dependencies
                </p>
            )}

            {warnings.map((warning, index) => (
                <p
                    key={index}
                    className={`field-warning severity-${warning.severity}`}
                >
                    {warning.severity === 'error' && '❌ '}
                    {warning.severity === 'warning' && '⚠️ '}
                    {warning.severity === 'info' && 'ℹ️ '}
                    {warning.message}
                </p>
            ))}
        </div>
    );
};

export default DynamicField;
