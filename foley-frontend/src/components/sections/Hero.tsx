import React from 'react';
import { Button } from '../ui/Button';

export const Hero: React.FC = () => {
    // Deterministic 48 bars with bar index 24 (labeled frame 43) highlighted
    const barHeights = [
        25, 40, 18, 55, 30, 48, 65, 38, 50, 70, 45, 30, 60, 80, 52, 40, 75, 90, 65, 48, 85, 95, 70, 88,
        100, // Index 24: Target Hit Frame
        75, 60, 45, 50, 35, 40, 28, 45, 30, 25, 35, 20, 28, 15, 22, 18, 25, 14, 18, 12, 16, 10, 15
    ];

    return (
        <section className="relative min-h-[calc(100svh-5rem)] flex flex-col justify-between items-center text-center px-4 sm:px-6 py-12 bg-transparent overflow-hidden">

            {/* Top spacing / Badge */}
            <div className="w-full flex justify-center pt-4 sm:pt-6">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm text-[11px] sm:text-[12px] font-action font-semibold text-[#E997F4] uppercase tracking-[0.15em] shadow-[0_0_15px_rgba(153,71,183,0.25)]">
                    <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-ping" />
                    MULTIMODAL GENERATIVE AUDIO SYNTHESIS
                </span>
            </div>

            {/* Hero Centerpiece: Giant FOLEY + Tagline */}
            <div className="flex-1 flex flex-col justify-center items-center my-6 max-w-5xl relative">
                {/* Soft Colorful Backlight Aura */}
                <div className="absolute inset-0 blur-3xl opacity-35 bg-gradient-to-r from-[#FF5598] via-[#9947B7] to-[#007AD8] pointer-events-none select-none rounded-full" />

                <h1 className="relative font-display text-display text-white tracking-[0.02em] select-none drop-shadow-[0_8px_40px_rgba(153,71,183,0.4)]">
                    FOLEY
                </h1>
                <p className="relative font-heading font-semibold text-xl sm:text-2xl md:text-3xl text-white mt-4 tracking-[-0.02em] max-w-2xl">
                    Silent video in. <span className="bg-gradient-to-r from-[#FF5598] via-[#E997F4] to-[#00F0FF] bg-clip-text text-transparent">Real-sounding sound</span> out.
                </p>
            </div>

            {/* Dynamic Sound Spectrum Bar Graphic (~48 bars, mixed colors) */}
            <div className="w-full max-w-3xl my-6 flex flex-col items-center">
                <div className="w-full h-24 flex items-end justify-between gap-[3px] sm:gap-1.5 px-2">
                    {barHeights.map((h, i) => {
                        const isTarget = i === 24;
                        // Mix & match vivid spectrum colors across bars
                        let barGradient = 'bg-gradient-to-t from-[#007AD8]/70 to-[#00F0FF]';
                        if (i >= 15 && i < 24) {
                            barGradient = 'bg-gradient-to-t from-[#8338EC]/70 to-[#9947B7]';
                        } else if (i > 24 && i < 35) {
                            barGradient = 'bg-gradient-to-t from-[#9947B7]/70 to-[#FF5598]';
                        } else if (i >= 35) {
                            barGradient = 'bg-gradient-to-t from-[#FE2902]/70 to-[#FFBE0B]';
                        }

                        return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                                {isTarget && (
                                    <span className="font-action font-bold text-[9px] sm:text-[11px] text-[#FF5598] uppercase tracking-wider mb-1 whitespace-nowrap animate-pulse drop-shadow-[0_0_8px_rgba(255,85,152,0.8)]">
                                        FRAME 43
                                    </span>
                                )}
                                <div
                                    style={{ height: `${h}%` }}
                                    className={`w-full rounded-t-[2px] transition-all duration-300 ${isTarget
                                            ? 'bg-white ring-2 ring-[#FF5598] shadow-[0_0_18px_#FF5598]'
                                            : `${barGradient} hover:opacity-100 opacity-90`
                                        }`}
                                />
                            </div>
                        );
                    })}
                </div>
                <div className="w-full border-t border-white/20 mt-2 pt-1 flex justify-between text-[11px] font-action text-white/60">
                    <span className="text-[#00F0FF]">0.00s (FRAME 0)</span>
                    <span className="text-[#FF5598] font-bold">T_IMPACT = 1.43s</span>
                    <span className="text-[#FFBE0B]">10.00s (FRAME 300)</span>
                </div>
            </div>

            {/* Bottom Paired CTAs */}
            <div className="w-full max-w-md flex flex-col sm:flex-row gap-4 justify-center items-center mt-6">
                <Button variant="primary" size="md" href="#studio" className="w-full sm:w-auto shadow-lg shadow-purple-900/30">
                    OPEN STUDIO
                </Button>
                <Button variant="secondary" size="md" href="#how" className="w-full sm:w-auto">
                    HOW IT WORKS
                </Button>
            </div>

        </section>
    );
};