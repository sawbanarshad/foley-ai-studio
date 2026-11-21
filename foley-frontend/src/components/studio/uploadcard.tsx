import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { TextLink } from '../ui/TextLink';
import { Health } from '../../api/types';
import { formatFileSize } from '../../lib/format';

export interface UploadCardProps {
    file: File | null;
    onSelectFile: (file: File) => void;
    onAnalyze: (fileOverride?: File) => void;
    isAnalyzing: boolean;
    health: Health | null;
    isMock: boolean;
    onToggleMock: (useMock: boolean) => void;
}

export const UploadCard: React.FC<UploadCardProps> = ({
    file,
    onSelectFile,
    onAnalyze,
    isAnalyzing,
    health,
    isMock,
    onToggleMock
}) => {
    const [sampleAvailable, setSampleAvailable] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Check if sample-1.mp4 exists
    useEffect(() => {
        fetch('/samples/sample-1.mp4', { method: 'HEAD' })
            .then((res) => {
                if (res.ok) setSampleAvailable(true);
            })
            .catch(() => setSampleAvailable(false));
    }, []);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
            onSelectFile(e.dataTransfer.files[0]);
        }
    };

    const handleLoadSample = async () => {
        try {
            const res = await fetch('/samples/sample-1.mp4');
            const blob = await res.blob();
            const sampleFile = new File([blob], 'sample-1.mp4', { type: 'video/mp4' });
            onSelectFile(sampleFile);
            onAnalyze(sampleFile);
        } catch (err) {
            console.error('Failed to load sample clip:', err);
        }
    };

    const isBackendOffline = !isMock && (!health || health.status !== 'ok');

    return (
        <div className="glass-panel rounded-card p-5 space-y-4 text-white hover:border-purple-500/30 transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-display text-xl uppercase tracking-wider">
                    01 // UPLOAD SILENT CLIP
                </h3>
                <span className="text-[10px] font-action text-white/50 uppercase">
                    STEP 1 OF 4
                </span>
            </div>

            {/* Backend Status / Offline Banner */}
            {isBackendOffline ? (
                <div className="bg-[#0F0F0F] border border-white p-3 rounded-[4px] space-y-1">
                    <p className="text-[12px] font-body text-white font-semibold">Backend offline.</p>
                    <p className="text-[11px] font-body text-white/70">
                        Cannot reach FastAPI backend.{' '}
                        <TextLink onClick={() => onToggleMock(true)} className="cursor-pointer">
                            Use demo mode
                        </TextLink>{' '}
                        to test full UI flow with mock data.
                    </p>
                </div>
            ) : (
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <Badge variant="outline" className={isMock ? 'border-yellow-400 text-yellow-300' : 'text-emerald-400'}>
                        {isMock ? 'MOCK MODE' : 'BACKEND ONLINE'}
                    </Badge>
                    <Badge variant="outline">
                        ENGINE: {health?.audio_engine.toUpperCase() || 'PROCEDURAL'}
                    </Badge>
                    <Badge variant="outline">
                        GEMINI KEY: {health?.gemini?.key_configured ? 'YES' : 'NO'}
                    </Badge>
                </div>
            )}

            {/* Real Label + Hidden File Input Dropzone */}
            <label
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`block border border-dashed rounded-card p-6 text-center cursor-pointer transition-all ${isDragging
                        ? 'border-[#00F0FF] bg-[#00F0FF]/10 shadow-[0_0_20px_rgba(0,240,255,0.2)]'
                        : 'border-white/20 hover:border-purple-400/50 bg-[#090B14]/60'
                    }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onSelectFile(e.target.files[0])}
                />
                <div className="space-y-1 select-none">
                    <span className="font-display text-2xl uppercase tracking-wide block">
                        DROP A SILENT CLIP
                    </span>
                    <p className="text-[11px] font-body text-white/60">
                        mp4 / mov / webm, trimmed to 10 s automatically
                    </p>
                    {file && (
                        <div className="mt-3 pt-2 border-t border-rechabite-border text-xs font-mono text-[var(--room-accent,#9947B7)]">
                            {file.name} ({formatFileSize(file.size)})
                        </div>
                    )}
                </div>
            </label>

            {/* Action Buttons */}
            <div className="space-y-2">
                <Button
                    variant="primary"
                    size="sm"
                    disabled={!file || isAnalyzing}
                    onClick={() => onAnalyze()}
                    className="w-full"
                >
                    {isAnalyzing ? 'ANALYZING VIDEO…' : 'ANALYZE CLIP'}
                </Button>

                {/* Try a Sample Row */}
                {sampleAvailable && (
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] font-action text-white/60 uppercase">
                            NO VIDEO READY?
                        </span>
                        <Button
                            variant="secondary"
                            size="sm"
                            disabled={isAnalyzing}
                            onClick={handleLoadSample}
                        >
                            TRY SAMPLE CLIP
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};