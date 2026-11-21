import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary';
    size?: 'md' | 'sm';
    href?: string;
    className?: string;
    children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    variant = 'primary',
    size = 'md',
    href,
    className = '',
    disabled,
    children,
    ...props
}) => {
    const baseClasses =
        'inline-flex items-center justify-center font-action font-semibold text-[14.4px] uppercase tracking-[0.04em] rounded-cta transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none text-center';

    const sizeClasses =
        size === 'md'
            ? 'min-h-[53px] px-[29px] py-[16px] min-w-[200px] sm:min-w-[250px]'
            : 'min-h-[44px] px-[18px] py-[10px] min-w-0';

    const variantClasses =
        variant === 'primary'
            ? 'bg-white text-black border-2 border-black hover:bg-black hover:text-white hover:border-white active:bg-neutral-800'
            : 'bg-transparent text-white border border-white hover:bg-white hover:text-black active:bg-neutral-200';

    const combinedClasses = `${baseClasses} ${sizeClasses} ${variantClasses} ${className}`;

    if (href && !disabled) {
        return (
            <a href={href} className={combinedClasses}>
                {children}
            </a>
        );
    }

    return (
        <button disabled={disabled} className={combinedClasses} {...props}>
            {children}
        </button>
    );
};