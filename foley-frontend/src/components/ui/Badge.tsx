import React from 'react';

export interface BadgeProps {
    children: React.ReactNode;
    variant?: 'outline' | 'filled' | 'accent';
    className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'outline', className = '' }) => {
    let vClass = 'border border-rechabite-border text-white/90 bg-rechabite-black';
    if (variant === 'accent') {
        vClass = 'border border-[var(--room-accent,#9947B7)] text-white bg-[var(--room-accent,#9947B7)]/20';
    } else if (variant === 'filled') {
        vClass = 'bg-white/10 text-white border-transparent';
    }

    return (
        <span
            className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-action font-semibold uppercase tracking-wider ${vClass} ${className}`}
        >
            {children}
        </span>
    );
};