import React from 'react';
import { UsageDimension } from '@/schema/schema.contract';
import './UsageSlider.css';

interface UsageSliderProps {
    dimension: UsageDimension;
    value: number;
    onChange: (value: number) => void;
}

const UsageSlider: React.FC<UsageSliderProps> = ({ dimension, value, onChange }) => {
    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(Number(e.target.value));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = Number(e.target.value);
        if (!isNaN(newValue)) {
            onChange(newValue);
        }
    };

    const min = dimension.min ?? 0;
    const max = dimension.max ?? 10000;
    const step = dimension.step ?? 1;

    return (
        <div className="usage-slider">
            <div className="slider-header">
                <label className="slider-label">{dimension.label}</label>
                <div className="slider-value">
                    <input
                        type="number"
                        className="value-input"
                        value={value}
                        onChange={handleInputChange}
                        min={min}
                        max={max}
                        step={step}
                    />
                    <span className="value-unit">{dimension.unit}</span>
                </div>
            </div>

            {dimension.description && (
                <p className="slider-description">{dimension.description}</p>
            )}

            <input
                type="range"
                className="slider-control"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleSliderChange}
            />

            <div className="slider-range">
                <span className="range-min">{min}</span>
                <span className="range-max">{max}</span>
            </div>

            {dimension.presets && (
                <div className="slider-presets">
                    <button
                        className="preset-btn"
                        onClick={() => onChange(dimension.presets!.low)}
                        title="Low usage"
                    >
                        L
                    </button>
                    <button
                        className="preset-btn"
                        onClick={() => onChange(dimension.presets!.medium)}
                        title="Medium usage"
                    >
                        M
                    </button>
                    <button
                        className="preset-btn"
                        onClick={() => onChange(dimension.presets!.high)}
                        title="High usage"
                    >
                        H
                    </button>
                </div>
            )}
        </div>
    );
};

export default UsageSlider;
