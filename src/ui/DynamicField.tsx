import { FieldDefinition, ServiceFormState } from '@types/schema.types';
import { dependencyEngine } from '@engine/dependency.engine';

interface DynamicFieldProps {
    field: FieldDefinition;
    value: unknown;
    formState: ServiceFormState;
    onChange: (value: unknown) => void;
}

function DynamicField({ field, value, formState, onChange }: DynamicFieldProps) {
    // Check visibility
    const isVisible = dependencyEngine.isFieldVisible(field.visibleWhen, formState);

    if (!isVisible) {
        return null;
    }

    // Check dependencies
    const dependenciesMet = dependencyEngine.areDependenciesMet(field.dependsOn, formState);

    const renderField = () => {
        switch (field.type) {
            case 'string':
                return (
                    <input
                        type="text"
                        className="form-input"
                        value={String(value || '')}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={!dependenciesMet}
                        placeholder={field.description}
                    />
                );

            case 'number':
                return (
                    <input
                        type="number"
                        className="form-input"
                        value={Number(value || 0)}
                        onChange={(e) => onChange(Number(e.target.value))}
                        disabled={!dependenciesMet}
                        min={field.validation?.min}
                        max={field.validation?.max}
                        placeholder={field.description}
                    />
                );

            case 'boolean':
                return (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            className="form-checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => onChange(e.target.checked)}
                            disabled={!dependenciesMet}
                        />
                        <span>{field.description}</span>
                    </label>
                );

            case 'enum':
                return (
                    <select
                        className="form-select"
                        value={String(value || '')}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={!dependenciesMet}
                    >
                        {field.options?.map(option => (
                            <option key={String(option.value)} value={String(option.value)}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                );

            case 'multiselect':
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                        {field.options?.map(option => {
                            const selectedValues = Array.isArray(value) ? value : [];
                            const isSelected = selectedValues.includes(option.value);

                            return (
                                <label
                                    key={String(option.value)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}
                                >
                                    <input
                                        type="checkbox"
                                        className="form-checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                            const newValues = e.target.checked
                                                ? [...selectedValues, option.value]
                                                : selectedValues.filter(v => v !== option.value);
                                            onChange(newValues);
                                        }}
                                        disabled={!dependenciesMet}
                                    />
                                    <div>
                                        <div>{option.label}</div>
                                        {option.description && (
                                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                                                {option.description}
                                            </div>
                                        )}
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                );

            default:
                return (
                    <div className="alert alert-warning">
                        Unsupported field type: {field.type}
                    </div>
                );
        }
    };

    return (
        <div className="form-group">
            {field.type !== 'boolean' && (
                <label className={`form-label ${field.required ? 'form-label-required' : ''}`}>
                    {field.label}
                </label>
            )}

            {renderField()}

            {field.helpText && (
                <span className="form-help">{field.helpText}</span>
            )}

            {!dependenciesMet && (
                <div className="alert alert-warning" style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)' }}>
                    This field depends on other configuration options
                </div>
            )}

            {field.warnings?.map((warning, index) => {
                const shouldShow = dependencyEngine.evaluate(warning.condition, formState);

                if (!shouldShow) return null;

                const alertClass = warning.severity === 'error' ? 'alert-error' :
                    warning.severity === 'warning' ? 'alert-warning' :
                        'alert-info';

                return (
                    <div key={index} className={`alert ${alertClass}`} style={{ marginTop: 'var(--spacing-sm)', padding: 'var(--spacing-sm)' }}>
                        {warning.message}
                    </div>
                );
            })}
        </div>
    );
}

export default DynamicField;
