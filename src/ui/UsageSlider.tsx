import { UsageDimension } from '@types/schema.types';

interface UsageSliderProps {
    dimension: UsageDimension;
    value: number;
    onChange: (value: number) => void;
}

function UsageSlider({ dimension, value, onChange }: UsageSliderProps) {
    const handlePreset = (presetValue: number) => {
        onChange(presetValue);
    };

    return (
        <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                    {dimension.label}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    <input
                        type="number"
                        className="form-input"
                        style={{ width: '120px', padding: 'var(--spacing-xs) var(--spacing-sm)' }}
                        value={value}
                        onChange={(e) => onChange(Number(e.target.value))}
                        min={dimension.min}
                        max={dimension.max}
                        step={dimension.step || 1}
                    />
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', minWidth: '80px' }}>
                        {dimension.unit}
                    </span>
                </div>
            </div>

            {dimension.type === 'slider' && (
                <div className="slider-container">
                    <input
                        type="range"
                        className="slider"
                        value={value}
                        onChange={(e) => onChange(Number(e.target.value))}
                        min={dimension.min || 0}
                        max={dimension.max || 100}
                        step={dimension.step || 1}
                    />

                    {dimension.presets && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--spacing-sm)' }}>
                            <button
                                className="btn btn-sm"
                                onClick={() => handlePreset(dimension.presets!.low)}
                                style={{ opacity: value === dimension.presets.low ? 1 : 0.6 }}
                            >
                                Low ({dimension.presets.low})
                            </button>
                            <button
                                className="btn btn-sm"
                                onClick={() => handlePreset(dimension.presets!.medium)}
                                style={{ opacity: value === dimension.presets.medium ? 1 : 0.6 }}
                            >
                                Medium ({dimension.presets.medium})
                            </button>
                            <button
                                className="btn btn-sm"
                                onClick={() => handlePreset(dimension.presets!.high)}
                                style={{ opacity: value === dimension.presets.high ? 1 : 0.6 }}
                            >
                                High ({dimension.presets.high})
                            </button>
                        </div>
                    )}
                </div>
            )}

            {dimension.description && (
                <span className="form-help">{dimension.description}</span>
            )}
        </div>
    );
}

export default UsageSlider;
