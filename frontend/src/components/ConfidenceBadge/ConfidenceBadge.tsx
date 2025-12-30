import React from 'react';
import type { ConfidenceLevel } from '../../types/api';
import { Shield, AlertTriangle, AlertCircle } from 'lucide-react';

interface ConfidenceBadgeProps {
    level: ConfidenceLevel;
    showIcon?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export default function ConfidenceBadge({ level, showIcon = true, size = 'md' }: ConfidenceBadgeProps) {
    const config = {
        HIGH: {
            icon: Shield,
            className: 'badge-success',
            label: 'HIGH',
        },
        MEDIUM: {
            icon: AlertTriangle,
            className: 'badge-warning',
            label: 'MEDIUM',
        },
        LOW: {
            icon: AlertCircle,
            className: 'badge-error',
            label: 'LOW',
        },
    };

    const { icon: Icon, className, label } = config[level];

    const sizeClasses = {
        sm: 'text-xs px-2 py-0.5',
        md: 'text-sm px-2.5 py-1',
        lg: 'text-base px-3 py-1.5',
    };

    return (
        <span className={`badge ${className} ${sizeClasses[size]} inline-flex items-center gap-1`}>
            {showIcon && <Icon className="w-3 h-3" />}
            {label}
        </span>
    );
}
