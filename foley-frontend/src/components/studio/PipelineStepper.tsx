import React from 'react';
import { StudioPhase } from '../../hooks/useStudio';

export interface PipelineStepperProps {
    phase: StudioPhase;
}

export const PipelineStepper: React.FC<PipelineStepperProps> = ({ phase }) => {
    const steps = [
        { id: 1, label: 'WATCH', activePhase: 'uploading', microcopy: 'Watching your clip…' },
        { id: 2, label: 'LOCK FRAME', activePhase: 'uploading', microcopy: 'Finding exact frame…' },
        { id: 3, label: 'GENERATE', activePhase: 'generating', microcopy: 'Cooking up new sound…' },
        { id: 4, label: 'SHAPE', activePhase: 'generating', microcopy: 'Locking it to the frame…' }
    ];

    const getStepStatus = (stepIndex: number) => {
        if (phase === 'ready') return 'done';
        if (phase === 'generating') {
            if (stepIndex <= 2) return 'done';
            if (stepIndex === 3) return 'active';
            return 'pending';
        }
        if (phase === 'analyzed') {
            if (stepIndex <= 2) return 'done';
            return 'pending';
        }
        if (phase === 'uploading') {
            if (stepIndex === 1) return 'active';
            if (stepIndex === 2) return 'active';
            return 'pending';
        }
        return 'pending';
    };

    return (
        <div className="w-full bg-[#0F0F0F] border border-rechabite-border rounded-[8px] p-3 sm:p-4 mb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {steps.map((st, i) => {
                    const status = getStepStatus(i + 1);
                    return (
                        <div key={st.id} className="flex flex-col space-y-1">
                            <div className="flex items-center space-x-2">
                                <span
                                    className={`w-6 h-6 rounded-[2px] flex items-center justify-center font-display text-xs ${status === 'done'
                                        ? 'bg-white text-black'
                                        : status === 'active'
                                            ? 'bg-[var(--room-accent,#9947B7)] text-white animate-pulse'
                                            : 'bg-[#1F2430] text-white/40'
                                        }`}
                                >
                                    {status === 'done' ? '✓' : `0${st.id}`}
                                </span>
                                <span className="font-display text-sm tracking-wide text-white uppercase">
                                    {st.label}
                                </span>
                            </div>
                            <span className="text-[11px] font-body text-white/50 truncate">
                                {status === 'active' ? st.microcopy : status === 'done' ? 'Completed' : 'Pending'}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};