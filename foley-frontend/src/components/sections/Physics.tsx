import React from 'react';

export const Physics: React.FC = () => {
    const cards = [
        {
            formula: 'RT60 = 0.161·L / 6α',
            title: 'SABINE ROOM ACOUSTICS',
            desc: 'Sabine room reverberation is mathematically calculated from physical room dimensions (L) and wall absorption coefficients (α), never picked from a stock preset.',
            accent: '#007AD8',
            textAccent: '#7EC3F7',
            borderClass: 'border-t-2 border-t-[#007AD8]'
        },
        {
            formula: 'v = Δpixels / Δt',
            title: 'HIT STRENGTH FROM PIXELS',
            desc: 'Harder motion on screen immediately scales audio gain and dynamic lowpass cutoff. Fast impacts automatically sound punchier, louder, and sharper.',
            accent: '#FF5598',
            textAccent: '#FDA1C5',
            borderClass: 'border-t-2 border-t-[#FF5598]'
        },
        {
            formula: '0.6·H_c(s) + 0.4·H_s(s)',
            title: 'TWO-BODY MATERIAL EQ',
            desc: 'Collider and surface each shape harmonic tone via Robert Bristow-Johnson biquad filters. Metal rings crystalline; wood resonates with warm dampening.',
            accent: '#FE2902',
            textAccent: '#FF8F5F',
            borderClass: 'border-t-2 border-t-[#FE2902]'
        },
        {
            formula: 'Δpitch ~ U(-1, 1)',
            title: 'HUMANIZED MULTI-HIT',
            desc: 'Every footstep or repeated collision is subtly randomized in pitch and micro-timing. Completely eliminates the robotic machine-gun effect.',
            accent: '#9947B7',
            textAccent: '#E997F4',
            borderClass: 'border-t-2 border-t-[#9947B7]'
        }
    ];

    return (
        <section id="physics" className="bg-transparent py-20 sm:py-28 text-white border-t border-white/10">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6">

                {/* Section Header */}
                <div className="mb-14 space-y-3">
                    <span className="text-[12px] font-action font-semibold text-[#E997F4] uppercase tracking-[0.15em]">
                        DETERMINISTIC DSP & ACOUSTIC MODELLING
                    </span>
                    <h2 className="font-display text-section-title uppercase tracking-[0.01em]">
                        SOUND, BUT MAKE IT PHYSICS.
                    </h2>
                    <p className="font-body text-white/70 max-w-2xl text-[1.1rem]">
                        Generative AI invents the acoustic transient; deterministic digital signal processing shapes the physical resonance in under 300 milliseconds.
                    </p>
                </div>

                {/* 4-Tile Card Grid with Mixed Accents */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                    {cards.map((c, i) => (
                        <div
                            key={i}
                            className={`glass-panel rounded-[8px] p-6 flex flex-col justify-between space-y-6 ${c.borderClass} hover:border-white/40 transition-all duration-300 hover:-translate-y-1`}
                        >
                            <div>
                                <span
                                    style={{ color: c.textAccent }}
                                    className="font-mono text-sm font-bold block mb-4 border-b border-white/10 pb-2"
                                >
                                    {c.formula}
                                </span>
                                <h3 className="font-display text-2xl uppercase tracking-wide text-white mb-2">
                                    {c.title}
                                </h3>
                                <p className="font-body text-sm text-white/70 leading-relaxed">
                                    {c.desc}
                                </p>
                            </div>
                            <div
                                style={{ color: c.textAccent }}
                                className="text-[10px] font-action uppercase tracking-widest font-semibold"
                            >
                                RULE 0{i + 1} // DETERMINISTIC DSP
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    );
};