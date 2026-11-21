import React from 'react';
import { Slider } from '../ui/Slider';
import { Select } from '../ui/Select';
import { StudioSettings } from '../config/hooks/useStudio';
import { RoomName, WallMaterial, TweakResponse } from '../../types';
import { computeLocalRT60 } from '../../lib/rooms';

export interface PhysicsCardProps {
    settings: StudioSettings;
    onChangeSettings: (partial: Partial<StudioSettings>) => void;
    disabled?: boolean;
    tweakResult: TweakResponse | null;
    fps: number;
}

export const PhysicsCard: React.FC<PhysicsCardProps> = ({
    settings,
    onChangeSettings,
    disabled = false,
    tweakResult,
    fps = 30
}) => {
    // Local instant RT60 calculation
    const isField = settings.environmentName === 'open_field' || settings.wall === 'outdoor';
    const localRt60 = computeLocalRT60(settings.L, settings.wall, isField);
    const displayRt60 = tweakResult ? tweakResult.rt60 : localRt60;

    const msPerFrame = Math.round(1000 / (fps || 30));
    const nudgeHint =
        settings.nudge === 0
            ? 'Exact Contact Lock'
            : `${settings.nudge > 0 ? '+' : ''}${settings.nudge} frames (${settings.nudge * msPerFrame}ms)`;

    const envOptions = [
        { value: 'auto', label: 'AUTO (FROM VIDEO)' },
        { value: 'small_room', label: 'SMALL ROOM (WOOD)' },
        { value: 'large_hall', label: 'LARGE HALL (CONCRETE)' },
        { value: 'cave', label: 'SUBTERRANEAN CAVE (STONE)' },
        { value: 'open_field', label: 'OPEN FIELD (ANECHOIC)' }
    ];

    const wallOptions = [
        { value: 'wood', label: 'WOOD PANELING (α = 0.10)' },
        { value: 'concrete', label: 'CONCRETE / TILE (α = 0.03)' },
        { value: 'stone', label: 'STONE MASONRY (α = 0.02)' },
        { value: 'curtains', label: 'HEAVY CURTAINS (α = 0.30)' },
        { value: 'outdoor', label: 'OPEN OUTDOOR (α = 0.95)' }
    ];

    return (
        <div
            className={`glass-panel rounded-card p-5 space-y-5 text-white transition-all duration-300 hover:border-purple-500/30 ${disabled ? 'opacity-40 pointer-events-none' : ''
                }`}
        >
            {/* Header & Large Anton RT60 Readout */}
            <div className="flex items-start justify-between border-b border-rechabite-border pb-3">
                <div>
                    <h3 className="font-display text-xl uppercase tracking-wider">
                        02 // PHYSICAL ACOUSTICS
                    </h3>
                    <span className="text-[10px] font-action text-white/50 uppercase">
                        SABINE FORMULA &middot; RBJ DSP
                    </span>
                </div>
                <div className="text-right">
                    <div className="font-display text-2xl text-white tracking-wide">
                        RT60 {displayRt60.toFixed(2)} S
                    </div>
                    <span className="text-[9px] font-action text-white/50 uppercase">
                        REVERBERATION TIME
                    </span>
                </div>
            </div>

            {/* Environment Preset Selector */}
            <Select
                label="Acoustic Environment World"
                options={envOptions}
                value={settings.environmentName}
                onChange={(e) => onChangeSettings({ environmentName: e.target.value as RoomName | 'auto' })}
            />

            {/* Room Scale L Slider */}
            <Slider
                label="Room Scale (L)"
                value={settings.L}
                min={2}
                max={25}
                step={0.5}
                unit="m"
                displayValue={`${settings.L.toFixed(1)}m`}
                ariaValueText={`${settings.L} meters`}
                onChange={(L) => onChangeSettings({ L })}
            />

            {/* Wall Material Selector */}
            <Select
                label="Boundary Material (Absorption α)"
                options={wallOptions}
                value={settings.wall}
                onChange={(e) => onChangeSettings({ wall: e.target.value as WallMaterial })}
            />

            {/* Impact Intensity Slider */}
            <Slider
                label="Impact Kinetic Energy"
                value={Math.round(settings.intensity * 100)}
                min={10}
                max={200}
                step={5}
                unit="%"
                displayValue={`${Math.round(settings.intensity * 100)}%`}
                ariaValueText={`${Math.round(settings.intensity * 100)} percent`}
                onChange={(pct) => onChangeSettings({ intensity: pct / 100 })}
            />

            {/* Sync Nudge Slider */}
            <div>
                <Slider
                    label="Sync Nudge (Frames)"
                    value={settings.nudge}
                    min={-3}
                    max={3}
                    step={1}
                    displayValue={`${settings.nudge > 0 ? '+' : ''}${settings.nudge}`}
                    ariaValueText={`${settings.nudge} frames`}
                    onChange={(nudge) => onChangeSettings({ nudge })}
                />
                <div className="text-[10px] font-body text-[var(--room-accent,#9947B7)] font-medium mt-0.5">
                    {nudgeHint}
                </div>
            </div>

            {/* Re-mixed latency telemetry badge */}
            {tweakResult && (
                <div className="pt-2 border-t border-rechabite-border flex justify-between items-center text-[11px] font-body text-white/60">
                    <span>REAL-TIME DSP ENGINE:</span>
                    <span className="font-mono text-white font-semibold">
                        Re-mixed in {tweakResult.processing_ms} ms
                    </span>
                </div>
            )}
        </div>
    );
};