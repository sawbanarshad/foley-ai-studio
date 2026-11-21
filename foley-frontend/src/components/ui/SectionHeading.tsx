import React from 'react';

export interface SectionHeadingProps {
    children: React.ReactNode;
    subtitle?: string;
    tag?: string;
    className?: string;
    inverted?: boolean;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
    children,
    subtitle,
    tag,
    className = '',
    inverted = false
}) => {
    return (
        <div className={`space-y-2 mb-8 ${className}`}>
            {tag && (
                <span
                    className={`inline-block text-[12px] font-action font-semibold uppercase tracking-[0.1em] ${inverted ? 'text-black/70' : 'text-[var(--room-accent,#9947B7)]'
                        }`}
                >
                    {tag}
                </span>
            )}
            <h2
                className={`font-display text-section-title uppercase leading-[0.9] tracking-[0.01em] ${inverted ? 'text-black' : 'text-white'
                    }`}
            >
                {children}
            </h2>
            {subtitle && (
                <p
                    className={`text-[1.1rem] font-body max-w-2xl ${inverted ? 'text-black/80' : 'text-white/70'
                        }`}
                >
                    {subtitle}
                </p>
            )}
        </div>
    );
};