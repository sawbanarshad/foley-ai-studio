import React, { useRef, useEffect } from 'react';
import { Peak } from '../../api/types';
import { PlaybackMode } from '../../hooks/useStudio';
import { formatFrameTime } from '../../lib/format';

export interface WaveformProps {
    waveform: number[];
    naiveWaveform?: number[];
    peaks: Peak[];
    duration: number;
    fps: number;
    mode: PlaybackMode;
    currentTime: number;
    onSeek: (time: number) => void;
    pulsingPeakTime?: number | null;
}

export const Waveform: React.FC<WaveformProps> = ({
    waveform,
    naiveWaveform,
    peaks,
    duration,
    fps,
    mode,
    currentTime,
    onSeek,
    pulsingPeakTime
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playheadRef = useRef<HTMLDivElement>(null);

    // Smooth playhead update
    useEffect(() => {
        if (playheadRef.current && duration > 0) {
            const pct = (currentTime / duration) * 100;
            playheadRef.current.style.left = `${Math.min(100, Math.max(0, pct))}%`;
        }
    }, [currentTime, duration]);

    // Build SVG mirrored path for waveform
    const buildPath = (data: number[]) => {
        if (!data || data.length === 0) return '';
        const pointsTop: string[] = [];
        const pointsBottom: string[] = [];

        data.forEach((val, i) => {
            const x = i;
            const h = Math.max(1, val * 45);
            pointsTop.push(`${x},${50 - h}`);
            pointsBottom.unshift(`${x},${50 + h}`);
        });

        return `M 0,50 L ${pointsTop.join(' L ')} L 1000,50 L ${pointsBottom.join(' L ')} Z`;
    };

    const mainPathD = buildPath(waveform);
    const naivePathD = mode === 'naive' && naiveWaveform ? buildPath(naiveWaveform) : '';

    const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current || duration <= 0) return;
        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        onSeek(pct * duration);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (duration <= 0) return;
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSeek(Math.min(duration, currentTime + 0.1));
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSeek(Math.max(0, currentTime - 0.1));
        }
    };

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            role="slider"
            aria-label="Audio waveform scrubber"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            aria-valuetext={formatFrameTime(currentTime, fps)}
            onClick={handleContainerClick}
            onKeyDown={handleKeyDown}
            className="relative w-full h-24 bg-[#090B14]/80 border border-white/10 rounded-[4px] cursor-pointer select-none overflow-hidden focus:outline-none focus:border-[var(--room-accent,#9947B7)] shadow-inner"
        >
            {/* SVG Waveform Rendering */}
            <svg
                viewBox="0 0 1000 100"
                preserveAspectRatio="none"
                className="w-full h-full block"
            >
                <defs>
                    <linearGradient id="waveMultiGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#007AD8" />
                        <stop offset="35%" stopColor="#9947B7" />
                        <stop offset="70%" stopColor="#FF5598" />
                        <stop offset="100%" stopColor="#FFBE0B" />
                    </linearGradient>
                </defs>
                {/* Naive comparison outline */}
                {naivePathD && (
                    <path
                        d={naivePathD}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.45)"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                    />
                )}
                {/* Main Synced / Active Waveform */}
                {mainPathD && (
                    <path
                        d={mainPathD}
                        fill="url(#waveMultiGrad)"
                        opacity="0.92"
                    />
                )}
            </svg>

            {/* White Peak Markers (HTML overlays to prevent SVG distortion) */}
            {duration > 0 &&
                peaks.map((pk) => {
                    const leftPct = (pk.time / duration) * 100;
                    const isPulsing = pulsingPeakTime !== null && Math.abs(pk.time - (pulsingPeakTime || 0)) < 0.1;
                    const tooltip = formatFrameTime(pk.time, fps);

                    return (
                        <div
                            key={`${pk.event_id}_${pk.hit_index}`}
                            style={{ left: `${leftPct}%` }}
                            className="absolute top-0 bottom-0 -ml-[1px] group pointer-events-auto"
                            title={tooltip}
                        >
                            {/* 2px White vertical line */}
                            <div className="w-[2px] h-full bg-white opacity-80" />

                            {/* 12px White Circle with 2px Black Ring */}
                            <div
                                style={{ top: 'calc(50% - 6px)', left: '-5px' }}
                                className={`absolute w-3 h-3 bg-white border-2 border-black rounded-full transition-transform duration-150 ${isPulsing ? 'scale-[1.6]' : 'group-hover:scale-125'
                                    }`}
                            />

                            {/* Tooltip on Hover */}
                            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black border border-white text-white text-[10px] font-mono whitespace-nowrap z-30 pointer-events-none rounded-[2px]">
                                {tooltip}
                            </div>
                        </div>
                    );
                })}

            {/* Moving Playhead: 2px White Line */}
            <div
                ref={playheadRef}
                style={{ left: '0%' }}
                className="absolute top-0 bottom-0 w-[2px] bg-white z-20 pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.8)]"
            />
        </div>
    );
};