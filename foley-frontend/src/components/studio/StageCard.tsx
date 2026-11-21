import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { ModeToggle } from './ModeToggle';
import { ShockwaveOverlay, ActiveRing } from './ShockwaveOverlay';
import { Waveform } from './Waveform';
import { Button } from '../ui/Button';
import {
    AnalyzeResponse,
    GenerateResponse,
    TweakResponse
} from '../../api/types';
import { PlaybackMode } from '../../hooks/useStudio';
import { resolveUrl } from '../../api/client';
import { useVideoClock } from '../../hooks/useVideoClock';
import { downloadFile } from '../../lib/download';

export interface StageCardProps {
    analysis: AnalyzeResponse | null;
    generateResult: GenerateResponse | null;
    tweakResult: TweakResponse | null;
    mode: PlaybackMode;
    onChangeMode: (m: PlaybackMode) => void;
    selectedEventId: string | null;
}

export const StageCard: React.FC<StageCardProps> = ({
    analysis,
    generateResult,
    tweakResult,
    mode,
    onChangeMode
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [activeRings, setActiveRings] = useState<ActiveRing[]>([]);
    const [pulsingPeakTime, setPulsingPeakTime] = useState<number | null>(null);

    // Flatten hits for video clock trigger
    const allHits = useMemo(() => {
        if (!analysis) return [];
        const list: Array<{ t_impact: number; cx: number; cy: number; event_id: string }> = [];
        analysis.events.forEach((ev) => {
            if (ev.event_type === 'impact') {
                ev.hits.forEach((h) => {
                    list.push({
                        t_impact: h.t_impact,
                        cx: h.cx,
                        cy: h.cy,
                        event_id: ev.id
                    });
                });
            }
        });
        return list;
    }, [analysis]);

    // Shockwave trigger handler
    const handleHitTrigger = useCallback((hitTime: number, cx: number, cy: number, eventId: string) => {
        const ringId = `${eventId}_${hitTime}_${Date.now()}`;
        setActiveRings((prev) => [...prev, { id: ringId, cx, cy }]);
        setPulsingPeakTime(hitTime);

        setTimeout(() => {
            setActiveRings((prev) => prev.filter((r) => r.id !== ringId));
            setPulsingPeakTime(null);
        }, 600);
    }, []);

    const { currentTime } = useVideoClock({
        videoRef,
        hits: allHits,
        onHitTrigger: handleHitTrigger
    });

    const savedPlaybackRef = useRef<{ time: number; playing: boolean }>({ time: 0, playing: false });

    useEffect(() => {
        if (currentTime > 0) {
            savedPlaybackRef.current.time = currentTime;
        }
    }, [currentTime]);

    const handleLoadedMetadata = () => {
        if (videoRef.current && savedPlaybackRef.current.time > 0) {
            videoRef.current.currentTime = Math.min(savedPlaybackRef.current.time, videoRef.current.duration || 999);
            if (savedPlaybackRef.current.playing) {
                videoRef.current.play().catch(() => { });
            }
        }
    };

    const handleSeek = (time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
        }
    };

    // Determine current active video URL
    let activeVideoUrl = '';
    if (analysis) {
        if (mode === 'synced' && (tweakResult?.synced_video_url || generateResult?.synced_video_url)) {
            activeVideoUrl = resolveUrl(tweakResult?.synced_video_url || generateResult!.synced_video_url);
        } else if (mode === 'naive' && generateResult?.naive_video_url) {
            activeVideoUrl = resolveUrl(generateResult.naive_video_url);
        } else {
            activeVideoUrl = resolveUrl(analysis.video.url);
        }
    }

    // Active waveform and peaks
    const activeWaveform = tweakResult?.waveform || generateResult?.waveform || [];
    const activeNaiveWaveform = generateResult?.naive_waveform || [];
    const activePeaks = tweakResult?.peaks || generateResult?.peaks || [];
    const activeRt60 = tweakResult?.rt60 || generateResult?.rt60 || analysis?.environment.rt60 || 0.35;
    const activeEngine = generateResult?.engine?.toUpperCase() || 'PROCEDURAL';
    const genTime = generateResult?.generation_seconds || 0;

    const handleDownload = (format: 'mp4' | 'wav') => {
        if (!generateResult && !tweakResult) return;
        const url = format === 'mp4'
            ? resolveUrl(tweakResult?.synced_video_url || generateResult!.synced_video_url)
            : resolveUrl(tweakResult?.synced_audio_url || generateResult!.synced_audio_url);
        const filename = `foley-synced.${format}`;
        downloadFile(url, filename);
    };

    const duration = analysis?.video.duration || 6.0;
    const fps = analysis?.video.fps || 30;
    const hasAudio = !!(generateResult || tweakResult);

    return (
        <div className="glass-panel rounded-card p-5 flex flex-col justify-between space-y-4 text-white hover:border-purple-500/30 transition-all duration-300">

            {/* Top Header & Mode Toggle */}
            <div className="space-y-3 border-b border-rechabite-border pb-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl uppercase tracking-wider">
                        04 // MASTER STAGE & SYNC
                    </h3>
                    <span className="text-[10px] font-action text-white/50 uppercase">
                        SAMPLE-ACCURATE LOCK
                    </span>
                </div>

                <ModeToggle
                    mode={mode}
                    onChange={onChangeMode}
                    disabledNaiveAndSynced={!hasAudio}
                />
            </div>

            {/* Main Video Viewport with Shockwave Overlay */}
            <div className="relative w-full bg-black rounded-[4px] border border-rechabite-border overflow-hidden flex items-center justify-center max-h-[60vh]">
                {activeVideoUrl ? (
                    <>
                        <video
                            ref={videoRef}
                            src={activeVideoUrl}
                            playsInline
                            controls
                            onPlay={() => { savedPlaybackRef.current.playing = true; }}
                            onPause={() => { savedPlaybackRef.current.playing = false; }}
                            onLoadedMetadata={handleLoadedMetadata}
                            className="w-full h-full object-contain block max-h-[60vh]"
                        />
                        <ShockwaveOverlay
                            activeRings={activeRings}
                            currentTime={currentTime}
                            fps={fps}
                        />
                    </>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2">
                        <span className="font-display text-4xl uppercase tracking-wide text-white/30">
                            NO CLIP YET
                        </span>
                        <p className="text-sm font-body text-white/50">
                            Upload a silent clip on the left to begin synchronization.
                        </p>
                    </div>
                )}
            </div>

            {/* SVG Waveform Visualizer */}
            <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-action text-white/60 uppercase">
                    <span>Waveform Telemetry</span>
                    <span>{hasAudio ? `${activePeaks.length} Peaks Locked` : 'Awaiting Synthesis'}</span>
                </div>
                <Waveform
                    waveform={activeWaveform}
                    naiveWaveform={activeNaiveWaveform}
                    peaks={activePeaks}
                    duration={duration}
                    fps={fps}
                    mode={mode}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    pulsingPeakTime={pulsingPeakTime}
                />
            </div>

            {/* Info Strip */}
            {hasAudio && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-rechabite-border text-[11px] font-action text-white/60">
                    <div>
                        <span>RT60: </span>
                        <span className="text-white font-semibold font-mono">{activeRt60.toFixed(2)}s</span>
                    </div>
                    <div>
                        <span>ENGINE: </span>
                        <span className="text-white font-semibold">{activeEngine}</span>
                    </div>
                    <div>
                        <span>RENDER TIME: </span>
                        <span className="text-white font-semibold font-mono">{genTime.toFixed(1)}s</span>
                    </div>
                    <div>
                        <span>SYNC LOCKS: </span>
                        <span className="text-white font-semibold font-mono">{activePeaks.length}</span>
                    </div>
                </div>
            )}

            {/* Export Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                    variant="primary"
                    size="sm"
                    disabled={!hasAudio}
                    onClick={() => handleDownload('mp4')}
                    className="flex-1"
                >
                    DOWNLOAD MP4
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    disabled={!hasAudio}
                    onClick={() => handleDownload('wav')}
                    className="flex-1"
                >
                    DOWNLOAD WAV
                </Button>
            </div>

        </div>
    );
};