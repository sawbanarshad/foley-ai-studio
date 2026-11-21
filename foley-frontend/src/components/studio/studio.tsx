import React, { useState } from 'react';
import { useStudio } from '../../hooks/useStudio';
import { PipelineStepper } from './PipelineStepper';
import { UploadCard } from './UploadCard';
import { PhysicsCard } from './PhysicsCard';
import { EventsCard } from './EventsCard';
import { StageCard } from './StageCard';
import { CustomSoundLayerCard } from './CustomSoundLayerCard';
import { LiveStatusLog } from './LiveStatusLog';
import { RoomName } from '../../api/types';
import { SoundLayer } from '../../api/client';

export const Studio: React.FC = () => {
    const {
        state,
        selectFile,
        runAnalyze,
        runGenerate,
        changeSettings,
        updateEvent,
        regenerateSingleEvent,
        setMode,
        selectEventId,
        setMockMode,
        clearError
    } = useStudio();

    const [customLayers, setCustomLayers] = useState<SoundLayer[]>([]);
    const [overrideSyncedVideo, setOverrideSyncedVideo] = useState<string | null>(null);

    // Determine room theme for the studio section background
    let roomTheme: RoomName | 'default' = 'default';
    if (state.analysis) {
        if (state.settings.environmentName !== 'auto') {
            roomTheme = state.settings.environmentName;
        } else {
            roomTheme = state.analysis.environment.name;
        }
    }

    const isAnalyzing = state.phase === 'uploading';
    const hasAnalysis = !!state.analysis;
    const fps = state.analysis?.video.fps || 30;

    // Active scene description
    const detectedScene =
        (state.analysis as any)?.gemini_info?.detected_scene ||
        state.events[0]?.prompt ||
        '';

    const handleLayerAdded = (
        updatedVideoUrl: string,
        _updatedAudioUrl: string,
        newLayers: SoundLayer[]
    ) => {
        setCustomLayers(newLayers);
        setOverrideSyncedVideo(updatedVideoUrl);
    };

    // Compute active generateResult with override if a layer was added
    const activeGenerateResult = state.generateResult
        ? {
            ...state.generateResult,
            synced_video_url: overrideSyncedVideo || state.generateResult.synced_video_url
        }
        : null;

    return (
        <section
            id="studio"
            data-room-theme={roomTheme !== 'default' ? roomTheme : undefined}
            style={{
                background: roomTheme !== 'default' ? 'var(--room-bg)' : 'transparent'
            }}
            className="w-full py-16 sm:py-24 px-4 sm:px-6 transition-all duration-500 relative"
        >
            <div className="max-w-[1440px] mx-auto">

                {/* Studio Section Header */}
                <div className="mb-8 space-y-2">
                    <span className="text-[12px] font-action font-semibold text-white uppercase tracking-[0.15em] bg-black/30 px-2 py-0.5 rounded-[3px] inline-block">
                        REAL FOLEY WORKSTATION
                    </span>
                    <h2 className="font-display text-page-title uppercase text-white tracking-[0.01em] leading-none">
                        MINI FOLEY STUDIO
                    </h2>
                </div>

                {/* Dismissible Error Banner */}
                {state.error && (
                    <div
                        role="alert"
                        className="mb-6 bg-[#0F0F0F] border border-red-500/80 p-4 rounded-[4px] flex items-center justify-between text-white"
                    >
                        <div className="flex items-center space-x-3">
                            <span className="text-red-400 font-bold">ERROR:</span>
                            <p className="font-body text-sm text-white/90">{state.error}</p>
                        </div>
                        <button
                            onClick={clearError}
                            className="text-xs font-action uppercase tracking-wider underline hover:text-white/70"
                        >
                            DISMISS
                        </button>
                    </div>
                )}

                {/* Live Status Log */}
                <LiveStatusLog
                    phase={state.phase}
                    detectedScene={detectedScene}
                    engine={state.health?.audio_engine?.toUpperCase() || 'ELEVENLABS/FREESOUND'}
                />

                {/* 4-Step Pipeline Stepper */}
                <PipelineStepper phase={state.phase} />

                {/* Responsive Grid: Desktop 3 columns / Mobile 1 column */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-[18px] items-start">

                    {/* Left Column: UploadCard + PhysicsCard */}
                    <div className="lg:col-span-4 flex flex-col space-y-[18px] order-1 lg:order-1">
                        <UploadCard
                            file={state.file}
                            onSelectFile={(f) => {
                                setOverrideSyncedVideo(null);
                                setCustomLayers([]);
                                selectFile(f);
                            }}
                            onAnalyze={runAnalyze}
                            isAnalyzing={isAnalyzing}
                            health={state.health}
                            isMock={state.isMock}
                            onToggleMock={setMockMode}
                        />

                        <PhysicsCard
                            settings={state.settings}
                            onChangeSettings={changeSettings}
                            disabled={!hasAnalysis}
                            tweakResult={state.tweakResult}
                            fps={fps}
                        />
                    </div>

                    {/* Center Column: EventsCard + CustomSoundLayerCard */}
                    <div className="lg:col-span-4 flex flex-col space-y-[18px] order-3 lg:order-2">
                        <EventsCard
                            events={state.events}
                            analysis={state.analysis}
                            phase={state.phase}
                            selectedEventId={state.selectedEventId}
                            onSelectEvent={selectEventId}
                            onUpdateEvent={updateEvent}
                            onRegenerateSingle={regenerateSingleEvent}
                            onGenerateFoley={() => runGenerate(true)}
                            tweakResult={state.tweakResult}
                        />

                        <CustomSoundLayerCard
                            sessionId={state.analysis?.session_id || null}
                            layers={customLayers}
                            onLayerAdded={handleLayerAdded}
                            disabled={state.phase !== 'ready'}
                        />
                    </div>

                    {/* Right Column: StageCard */}
                    <div className="lg:col-span-4 order-2 lg:order-3">
                        <StageCard
                            analysis={state.analysis}
                            generateResult={activeGenerateResult}
                            tweakResult={state.tweakResult}
                            mode={state.mode}
                            onChangeMode={setMode}
                            selectedEventId={state.selectedEventId}
                        />
                    </div>

                </div>

            </div>
        </section>
    );
};