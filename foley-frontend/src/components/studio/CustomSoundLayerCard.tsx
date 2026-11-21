import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Slider } from '../ui/Slider';
import { Badge } from '../ui/Badge';
import { SoundLayer, addCustomSound } from '../../client';

export interface CustomSoundLayerCardProps {
    sessionId: string | null;
    layers: SoundLayer[];
    onLayerAdded: (updatedVideoUrl: string, updatedAudioUrl: string, newLayers: SoundLayer[]) => void;
    disabled?: boolean;
}

export const CustomSoundLayerCard: React.FC<CustomSoundLayerCardProps> = ({
    sessionId,
    layers,
    onLayerAdded,
    disabled = false
}) => {
    const [prompt, setPrompt] = useState('');
    const [volume, setVolume] = useState(0.6);
    const [startTime, setStartTime] = useState(0.0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAddSound = async () => {
        if (!sessionId || !prompt.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const res = await addCustomSound({
                video_id: sessionId,
                user_prompt: prompt.trim(),
                volume,
                start_time: startTime
            });
            onLayerAdded(res.updated_video_url, res.updated_audio_url, res.active_layers);
            setPrompt('');
        } catch (err: any) {
            setError(err.message || 'Failed to generate custom sound layer');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-panel rounded-card p-5 space-y-4 text-white hover:border-purple-500/30 transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-display text-xl uppercase tracking-wider">
                    04 // PROMPT REFINEMENT
                </h3>
                <span className="text-[10px] font-action text-white/50 uppercase">
                    ADD TO THE BEST TAKE
                </span>
            </div>

            <p className="text-[12px] font-body text-white/70">
                After generating your first render, prompt for a better mix: add distant rain, heavier impacts, footsteps on dry leaves, or softer room ambience without replacing the existing Foley track.
            </p>

            {/* Error alert */}
            {error && (
                <div className="bg-red-950/60 border border-red-500/50 p-2.5 rounded text-xs text-red-200">
                    {error}
                </div>
            )}

            {/* Input box */}
            <div className="space-y-1.5">
                <label className="text-[11px] font-action uppercase tracking-wider text-white/70">
                    User Sound Prompt
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={prompt}
                        disabled={disabled || isLoading || !sessionId}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder='e.g. "make the impact heavier and add distant rolling thunder"'
                        className="w-full bg-[#090B14] border border-white/20 rounded px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-400"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && prompt.trim()) {
                                handleAddSound();
                            }
                        }}
                    />
                </div>
            </div>

            {/* Controls: Volume + Start Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Slider
                    label="LAYER VOLUME"
                    value={volume}
                    min={0.1}
                    max={1.0}
                    step={0.05}
                    unit="x"
                    onChange={setVolume}
                />
                <div className="space-y-1.5">
                    <label className="text-[12px] font-action font-semibold uppercase tracking-wider text-white/80">
                        START TIME (S)
                    </label>
                    <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={startTime}
                        disabled={disabled || isLoading || !sessionId}
                        onChange={(e) => setStartTime(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full bg-[#090B14] border border-rechabite-border rounded px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-purple-400"
                    />
                </div>
            </div>

            {/* Action Button */}
            <Button
                variant="primary"
                size="sm"
                disabled={disabled || isLoading || !sessionId || !prompt.trim()}
                onClick={handleAddSound}
                className="w-full"
            >
                {isLoading ? 'RENDERING REFINEMENT…' : 'ADD PROMPT REFINEMENT'}
            </Button>

            {/* Active Audio Layers List */}
            {layers && layers.length > 0 && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                    <span className="text-[10px] font-action text-white/50 uppercase tracking-wider block">
                        ACTIVE AUDIO LAYERS ({layers.length})
                    </span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {layers.map((l, i) => (
                            <div
                                key={l.layer_id || i}
                                className="flex items-center justify-between bg-black/40 border border-white/10 rounded px-2.5 py-1.5 text-xs"
                            >
                                <div className="truncate mr-2">
                                    <span className="font-semibold text-white/90">{l.name || `Layer ${i + 1}`}</span>
                                    <p className="text-[10px] text-white/50 truncate font-mono">
                                        "{l.prompt}" · Vol: {Math.round(l.volume * 100)}%
                                    </p>
                                </div>
                                <Badge variant="outline" className="text-[9px] uppercase border-purple-500/50 text-purple-300">
                                    {l.engine || 'real'}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};