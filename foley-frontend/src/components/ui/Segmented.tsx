import React, { useRef } from 'react';

export interface SegmentedOption {
    value: string;
    label: string;
}

export interface SegmentedProps {
    label?: string;
    options: SegmentedOption[];
    value: string;
    onChange: (val: string) => void;
    className?: string;
}

export const Segmented: React.FC<SegmentedProps> = ({
    label,
    options,
    value,
    onChange,
    className = ''
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        let nextIndex = index;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            nextIndex = (index + 1) % options.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            nextIndex = (index - 1 + options.length) % options.length;
        }
        if (nextIndex !== index) {
            e.preventDefault();
            onChange(options[nextIndex].value);
            const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('button');
            buttons?.[nextIndex]?.focus();
        }
    };

    return (
        <div className={`space-y-1 ${className}`}>
            {label && (
                <span className="block text-[11px] font-action font-semibold uppercase tracking-wider text-white/70">
                    {label}
                </span>
            )}
            <div
                ref={containerRef}
                role="radiogroup"
                aria-label={label}
                className="inline-flex w-full bg-[#0F0F0F] border border-rechabite-border rounded-[4px] p-0.5 gap-0.5"
            >
                {options.map((opt, i) => {
                    const isSelected = opt.value === value;
                    return (
                        <button
                            key={opt.value}
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={isSelected ? 0 : -1}
                            onClick={() => onChange(opt.value)}
                            onKeyDown={(e) => handleKeyDown(e, i)}
                            className={`flex-1 py-1.5 px-2 rounded-[3px] text-[11px] font-action font-semibold uppercase tracking-wider transition-colors text-center ${isSelected
                                    ? 'bg-white text-black'
                                    : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};