import React from 'react';

export interface LiveStatusLogProps {
    phase: 'idle' | 'uploading' | 'analyzed' | 'generating' | 'ready';
    detectedScene?: string;
    engine?: string;
}

export const LiveStatusLog: React.FC<LiveStatusLogProps> = ({
    phase,
    detectedScene,
    engine = 'ElevenLabs/Freesound'
}) => {
    if (phase === 'idle') return null;

    const isStep1Done = phase !== 'uploading';
    const isStep2Done = phase === 'analyzed' || phase === 'generating' || phase === 'ready';
    const isStep3Done = phase === 'ready';
    const isStep4Done = phase === 'ready';

    return (
        <div className="mb-6 p-4 rounded-card bg-[#090B14]/80 border border-white/10 backdrop-blur-md text-white space-y-2">
            <div className="flex items-center justify-between text-xs font-action text-white/50 uppercase tracking-wider">
                <span>LIVE PIPELINE STATUS</span>
                <span className="text-emerald-400 font-mono">REAL AUDIO ACTIVE</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs font-mono">
                {/* Step 1 */}
                <div
                    className={`p-2 rounded border ${phase === 'uploading'
                            ? 'border-cyan-400 bg-cyan-950/30 text-cyan-200 animate-pulse'
                            : isStep1Done
                                ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300'
                                : 'border-white/10 text-white/40'
                        }`}
                >
                    <span className="font-semibold block">1. EXTRACTING FRAMES</span>
                    <span className="text-[10px] text-white/60">
                        {phase === 'uploading' ? 'Extracting 5 keyframes…' : isStep1Done ? '5 Frames Extracted' : 'Waiting'}
                    </span>
                </div>

                {/* Step 2 */}
                <div
                    className={`p-2 rounded border ${phase === 'uploading'
                            ? 'border-white/10 text-white/40'
                            : isStep2Done
                                ? 'border-purple-500/50 bg-purple-950/20 text-purple-200'
                                : 'border-white/10 text-white/40'
                        }`}
                >
                    <span className="font-semibold block truncate">2. GEMINI RECOGNIZED</span>
                    <span className="text-[10px] text-white/70 block truncate" title={detectedScene || 'Scene details'}>
                        {detectedScene ? detectedScene : isStep2Done ? 'Scene visual detected' : 'Waiting for frames'}
                    </span>
                </div>

                {/* Step 3 */}
                <div
                    className={`p-2 rounded border ${phase === 'generating'
                            ? 'border-yellow-400 bg-yellow-950/30 text-yellow-200 animate-pulse'
                            : isStep3Done
                                ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300'
                                : 'border-white/10 text-white/40'
                        }`}
                >
                    <span className="font-semibold block truncate">3. GENERATING AUDIO</span>
                    <span className="text-[10px] text-white/60 block truncate">
                        {phase === 'generating'
                            ? `Calling ${engine}…`
                            : isStep3Done
                                ? `Real Audio via ${engine}`
                                : `via ${engine}`}
                    </span>
                </div>

                {/* Step 4 */}
                <div
                    className={`p-2 rounded border ${isStep4Done
                            ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300'
                            : 'border-white/10 text-white/40'
                        }`}
                >
                    <span className="font-semibold block">4. MERGING VIDEO</span>
                    <span className="text-[10px] text-white/60">
                        {isStep4Done ? 'Sample-Accurate Mux Complete' : 'Waiting'}
                    </span>
                </div>
            </div>
        </div>
    );
};