import React from 'react';
import { Badge } from '../ui/Badge';

export const HowItWorks: React.FC = () => {
    const steps = [
        {
            numeral: '01',
            title: 'WATCH',
            desc: 'Gemini watches your silent clip and names every action, material and room.',
            bg: 'linear-gradient(135deg, #003C75 0%, #007AD8 45%, #00C8D6 100%)',
            accent: '#7EC3F7',
            chips: ['Gemini 2.5 Flash', 'Multimodal Files API', 'Material Tagging']
        },
        {
            numeral: '02',
            title: 'LOCK THE FRAME',
            desc: 'OpenCV finds the exact frame of impact. Not roughly. Exactly.',
            bg: 'linear-gradient(135deg, #7A0847 0%, #FF5598 45%, #FF85B8 100%)',
            accent: '#FDA1C5',
            chips: ['cv2.absdiff', 'Negative Deceleration', 'Centroid Pan']
        },
        {
            numeral: '03',
            title: 'GENERATE',
            desc: 'A generative audio model invents brand-new sound. No stock library, no soundboard.',
            bg: 'linear-gradient(135deg, #8A0C00 0%, #FE2902 45%, #FF7F00 100%)',
            accent: '#FF8F5F',
            chips: ['cvssp/audioldm-s-full-v2', 'Crest-Factor Selection', 'Procedural Fallback']
        },
        {
            numeral: '04',
            title: 'SHAPE',
            desc: 'Room physics, material EQ and hit strength, live, in under a second.',
            bg: 'linear-gradient(135deg, #440C66 0%, #9947B7 45%, #D480FF 100%)',
            accent: '#E997F4',
            chips: ['Sabine RT60 Reverb', 'RBJ Biquad EQ', '<300ms Real-Time DSP']
        }
    ];

    return (
        <section id="how" className="w-full bg-transparent">
            {/* Intro Heading */}
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
                <span className="text-[12px] font-action font-semibold text-[#E997F4] uppercase tracking-[0.15em] block mb-2">
                    THE VISION-TO-AUDIO PIPELINE
                </span>
                <h2 className="font-display text-section-title uppercase text-white tracking-[0.01em]">
                    FOUR STEPS. ZERO STOCK SOUNDS.
                </h2>
            </div>

            {/* 4 Full-Bleed Saturated Colour Panels */}
            <div className="flex flex-col w-full shadow-2xl">
                {steps.map((s) => (
                    <div
                        key={s.numeral}
                        style={{ background: s.bg }}
                        className="w-full py-16 sm:py-24 px-4 sm:px-8 text-white transition-all duration-300 border-b border-black/20 relative"
                    >
                        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

                            {/* Giant Numeral */}
                            <div className="lg:col-span-3">
                                <span
                                    style={{ color: s.accent }}
                                    className="font-display text-7xl sm:text-9xl tracking-tight leading-none block select-none drop-shadow-[0_4px_16px_rgba(0,0,0,0.3)]"
                                >
                                    {s.numeral}
                                </span>
                            </div>

                            {/* Title & Description */}
                            <div className="lg:col-span-6 space-y-4">
                                <h3 className="font-display text-4xl sm:text-6xl uppercase tracking-wide leading-[0.95] drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
                                    {s.title}
                                </h3>
                                <p className="font-body text-[1.2rem] font-medium sm:text-[1.35rem] leading-snug text-white max-w-xl">
                                    {s.desc}
                                </p>
                            </div>

                            {/* Outlined Tech Chips */}
                            <div className="lg:col-span-3 flex flex-wrap gap-2">
                                {s.chips.map((chip) => (
                                    <Badge key={chip} variant="filled" className="bg-black/30 border-white/20 text-white font-bold text-xs py-1 px-3 backdrop-blur-sm">
                                        {chip}
                                    </Badge>
                                ))}
                            </div>

                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};