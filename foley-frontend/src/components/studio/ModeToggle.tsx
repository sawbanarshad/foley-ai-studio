import React from 'react';
import { PlaybackMode } from '../../hooks/useStudio';

export interface ModeToggleProps {
    mode: PlaybackMode;
    onChange: (m: PlaybackMode) => void;
    disabledNaiveAndSynced?: boolean;
}

export const ModeToggle: React.FC<ModeToggleProps> = ({
    mode,
    onChange,
    disabledNaiveAndSynced = false
}) => {
    const options: Array<{ value: PlaybackMode; label: string; disabled?: boolean }> = [
        { value: 'silent', label: 'SILENT' },
        { value: 'naive', label: 'NAIVE (STOCK)', disabled: disabledNaiveAndSynced },
        { value: 'synced', label: 'PHYSICS-SYNCED', disabled: disabledNaiveAndSynced }
    ];

    return (
        <div className="space-y-1.5">
            <div
                role="radiogroup"
                aria-label="Audio Playback Synchronization Mode"
                className="inline-flex w-full bg-[#0F0F0F] border border-rechabite-border rounded-[4px] p-0.5 gap-1"
            >
                {options.map((opt) => {
                    const isSelected = mode === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            disabled={opt.disabled}
                            onClick={() => onChange(opt.value)}
                            className={`flex-1 py-1.5 px-3 rounded-[3px] text-[11px] font-action font-semibold uppercase tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isSelected
                                ? 'bg-white text-black'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
            <p className="text-[10px] font-body text-white/50">
                Naive = stock clip dropped near rough timestamp. Synced = locked to exact impact frame.
            </p>
        </div>
    );
};