import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';

export const SiteHeader: React.FC = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden';
            const handleEsc = (e: KeyboardEvent) => {
                if (e.key === 'Escape') setMobileMenuOpen(false);
            };
            window.addEventListener('keydown', handleEsc);
            return () => {
                document.body.style.overflow = 'auto';
                window.removeEventListener('keydown', handleEsc);
            };
        } else {
            document.body.style.overflow = 'auto';
        }
    }, [mobileMenuOpen]);

    const navLinks = [
        { label: 'STUDIO', href: '#studio' },
        { label: 'HOW IT WORKS', href: '#how' },
        { label: 'PHYSICS', href: '#physics' }
    ];

    return (
        <header className="sticky top-0 z-50 bg-[#07080E]/80 backdrop-blur-md border-b border-white/10">
            {/* Dynamic top gradient line */}
            <div className="w-full h-[2px] bg-gradient-to-r from-[#FF5598] via-[#9947B7] via-[#007AD8] to-[#FF5598]" />
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">

                {/* Mobile Header: Hamburger Left | Wordmark Center | Glyph Right */}
                <div className="flex lg:hidden items-center justify-between w-full">
                    <button
                        type="button"
                        aria-expanded={mobileMenuOpen}
                        aria-controls="mobile-menu"
                        aria-label="Toggle navigation menu"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 text-white hover:text-[var(--room-accent,#9947B7)] focus:outline-none"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {mobileMenuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>

                    <a href="#" className="font-display text-2xl tracking-wider text-white">
                        FOLEY AI
                    </a>

                    {/* Small flat SVG waveform glyph */}
                    <div className="w-6 h-6 flex items-center justify-center text-white">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="2" y="8" width="2" height="8" rx="1" />
                            <rect x="6" y="4" width="2" height="16" rx="1" />
                            <rect x="10" y="2" width="2" height="20" rx="1" />
                            <rect x="14" y="6" width="2" height="12" rx="1" />
                            <rect x="18" y="10" width="2" height="4" rx="1" />
                        </svg>
                    </div>
                </div>

                {/* Desktop Header: Wordmark Left | Nav Links Center | CTA Right */}
                <div className="hidden lg:flex items-center justify-between w-full">
                    <div className="flex items-center space-x-12">
                        <a href="#" className="font-display text-3xl tracking-wider text-white">
                            FOLEY AI
                        </a>
                        <nav className="flex items-center space-x-8" aria-label="Main Navigation">
                            {navLinks.map((link) => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    className="font-action text-[14.4px] font-semibold text-white/80 hover:text-white transition-colors"
                                >
                                    {link.label}
                                </a>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center space-x-4">
                        <Button variant="primary" size="sm" href="#studio">
                            OPEN STUDIO
                        </Button>
                    </div>
                </div>

            </div>

            {/* Mobile Full-Screen Overlay Menu */}
            {mobileMenuOpen && (
                <div
                    id="mobile-menu"
                    className="fixed inset-0 top-16 bg-[#0F0F0F] z-40 flex flex-col justify-between p-8 lg:hidden animate-in fade-in duration-200"
                >
                    <nav className="flex flex-col space-y-6 pt-8">
                        {navLinks.map((link) => (
                            <a
                                key={link.label}
                                href={link.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className="font-display text-5xl text-white hover:text-[var(--room-accent,#9947B7)] tracking-wide"
                            >
                                {link.label}
                            </a>
                        ))}
                    </nav>

                    <div className="space-y-4 pb-12">
                        <Button
                            variant="primary"
                            size="md"
                            href="#studio"
                            className="w-full"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            OPEN STUDIO
                        </Button>
                        <p className="text-xs font-action text-white/50 text-center uppercase tracking-wider">
                            E-Summit '26 · ML Track
                        </p>
                    </div>
                </div>
            )}
        </header>
    );
};