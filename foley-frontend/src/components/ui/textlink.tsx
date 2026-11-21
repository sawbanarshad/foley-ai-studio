import React from 'react';

export interface TextLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    children: React.ReactNode;
    className?: string;
}

export const TextLink: React.FC<TextLinkProps> = ({ children, className = '', ...props }) => {
    return (
        <a
            className={`text-white text-[14.4px] underline font-action font-normal hover:text-[var(--room-accent,#9947B7)] transition-colors ${className}`}
            {...props}
        >
            {children}
        </a>
    );
};
