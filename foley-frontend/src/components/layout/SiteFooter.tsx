import React from 'react';
import { TEAM_NAME, GITHUB_URL, EVENT_NAME } from '../config/site';

export const SiteFooter: React.FC = () => {
    return (
        <footer className="bg-[#05060A]/90 border-t border-white/10 py-16 text-white relative">
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">

                    {/* Column 1: Brand */}
                    <div className="space-y-4 md:col-span-2">
                        <h3 className="font-display text-4xl tracking-wider text-white">
                            FOLEY AI STUDIO
                        </h3>
                        <p className="font-body text-white/70 max-w-md text-[1.1rem]">
                            Multimodal generative audio physics pipeline. Silent video in. Novel, physically accurate, frame-synchronized sound effects out.
                        </p>
                        <div className="text-[12px] font-action font-semibold text-[var(--room-accent,#9947B7)] uppercase tracking-wider">
                            {EVENT_NAME}
                        </div>
                    </div>

                    {/* Column 2: Navigation */}
                    <div className="space-y-3">
                        <h4 className="font-action font-semibold text-[13px] uppercase tracking-wider text-white/50">
                            EXPLORE
                        </h4>
                        <ul className="space-y-2 font-action text-[14px]">
                            <li><a href="#studio" className="hover:text-white/80 transition-colors">STUDIO</a></li>
                            <li><a href="#how" className="hover:text-white/80 transition-colors">HOW IT WORKS</a></li>
                            <li><a href="#physics" className="hover:text-white/80 transition-colors">PHYSICS ENGINE</a></li>
                        </ul>
                    </div>

                    {/* Column 3: Tech & Team */}
                    <div className="space-y-3">
                        <h4 className="font-action font-semibold text-[13px] uppercase tracking-wider text-white/50">
                            PROJECT
                        </h4>
                        <p className="font-body text-sm text-white/70">
                            Built by <span className="text-white font-semibold">{TEAM_NAME}</span>
                        </p>
                        <p className="font-body text-xs text-white/50">
                            Gemini 2.5 Flash &bull; OpenCV Sub-frame Diff &bull; AudioLDM &bull; Sabine Acoustic DSP
                        </p>
                        <div className="pt-2">
                            <a
                                href={GITHUB_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[14.4px] font-action underline text-white hover:text-[var(--room-accent,#9947B7)]"
                            >
                                GITHUB REPOSITORY
                            </a>
                        </div>
                    </div>

                </div>

                <div className="border-t border-rechabite-border pt-8 flex flex-col sm:flex-row justify-between items-center text-xs font-action text-white/50 gap-4">
                    <span>&copy; 2026 {TEAM_NAME}. ZERO STOCK SOUNDS.</span>
                    <span>BUILT FOR E-SUMMIT '26 MACHINE LEARNING TRACK</span>
                </div>
            </div>
        </footer>
    );
};