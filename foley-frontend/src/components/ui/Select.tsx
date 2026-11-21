import React from 'react';

export interface SelectOption {
    value: string;
    label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    options: SelectOption[];
    className?: string;
}

export const Select: React.FC<SelectProps> = ({
    label,
    options,
    value,
    onChange,
    className = '',
    disabled,
    ...props
}) => {
    return (
        <div className={`space-y-1 ${className}`}>
            {label && (
                <label className="block text-[11px] font-action font-semibold uppercase tracking-wider text-white/70">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    value={value}
                    disabled={disabled}
                    onChange={onChange}
                    className="w-full bg-[#0F0F0F] text-white border border-rechabite-border rounded-[4px] px-3 py-2 text-[13px] font-body appearance-none focus:outline-none focus:border-[var(--room-accent,#9947B7)] disabled:opacity-40 cursor-pointer"
                    {...props}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#0F0F0F] text-white">
                            {opt.label}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/60">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
    );
};