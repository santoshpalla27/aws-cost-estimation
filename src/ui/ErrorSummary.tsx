import React from 'react';
import './ErrorSummary.css';

interface ValidationError {
    field: string;
    messages: string[];
}

interface ValidationWarning {
    field: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
}

interface ErrorSummaryProps {
    errors: Record<string, string[]>;
    warnings: ValidationWarning[];
    onFieldClick?: (fieldId: string) => void;
}

export const ErrorSummary: React.FC<ErrorSummaryProps> = ({
    errors,
    warnings,
    onFieldClick,
}) => {
    const errorCount = Object.keys(errors).length;
    const warningCount = warnings.filter(w => w.severity === 'warning').length;
    const infoCount = warnings.filter(w => w.severity === 'info').length;

    if (errorCount === 0 && warningCount === 0 && infoCount === 0) {
        return null;
    }

    return (
        <div className="error-summary">
            {errorCount > 0 && (
                <div className="error-section">
                    <div className="error-header">
                        <span className="error-icon">⚠️</span>
                        <h3>Errors ({errorCount})</h3>
                    </div>
                    <ul className="error-list">
                        {Object.entries(errors).map(([field, messages]) => (
                            <li
                                key={field}
                                className="error-item"
                                onClick={() => onFieldClick?.(field)}
                            >
                                <strong>{field}:</strong>
                                <ul>
                                    {messages.map((msg, idx) => (
                                        <li key={idx}>{msg}</li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {warningCount > 0 && (
                <div className="warning-section">
                    <div className="warning-header">
                        <span className="warning-icon">⚡</span>
                        <h3>Warnings ({warningCount})</h3>
                    </div>
                    <ul className="warning-list">
                        {warnings
                            .filter(w => w.severity === 'warning')
                            .map((warning, idx) => (
                                <li
                                    key={idx}
                                    className="warning-item"
                                    onClick={() => onFieldClick?.(warning.field)}
                                >
                                    <strong>{warning.field}:</strong> {warning.message}
                                </li>
                            ))}
                    </ul>
                </div>
            )}

            {infoCount > 0 && (
                <div className="info-section">
                    <div className="info-header">
                        <span className="info-icon">ℹ️</span>
                        <h3>Information ({infoCount})</h3>
                    </div>
                    <ul className="info-list">
                        {warnings
                            .filter(w => w.severity === 'info')
                            .map((warning, idx) => (
                                <li key={idx} className="info-item">
                                    <strong>{warning.field}:</strong> {warning.message}
                                </li>
                            ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
