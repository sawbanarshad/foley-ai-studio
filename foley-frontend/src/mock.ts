import {
    AnalyzeResponse,
    GenerateResponse,
    TweakResponse,
    Health,
    FoleyEvent,
    Peak,
    RoomName,
    WallMaterial
} from './types';
import { EventEditPayload, TweakPhysicsPayload } from './client';
import { computeLocalRT60 } from '../lib/rooms';

let _mockObjectUrl: string = '';
let _mockFps = 30;
let _mockDuration = 6.0;

export async function mockHealth(): Promise<Health> {
    return {
        status: 'ok',
        gpu: { available: false, name: null },
        gemini: { key_configured: true, model: 'gemini-2.5-flash (mock)' },
        ffmpeg: { available: true, path: '/usr/bin/ffmpeg', version: '6.1.1' },
        audio_engine: 'procedural',
        model_loaded: false
    };
}

export async function mockAnalyze(file: File, signal?: AbortSignal): Promise<AnalyzeResponse> {
    if (signal?.aborted) throw new Error('Aborted');
    await new Promise((res, rej) => {
        const t = setTimeout(res, 1200);
        signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('Aborted')); });
    });

    _mockObjectUrl = URL.createObjectURL(file);

    const events: FoleyEvent[] = [
        {
            id: 'e1',
            event_type: 'impact',
            start_time: 0.8,
            end_time: 1.4,
            collider_material: 'wood',
            surface_material: 'concrete',
            distance: 'mid',
            prompt: 'sharp wooden impact on a hard concrete floor',
            t_impact: 1.0,
            frame_idx: 30,
            cx: 0.35,
            cy: 0.82,
            pan: -0.3,
            impact_strength: 0.92,
            hits: [
                { t_impact: 1.0, frame_idx: 30, cx: 0.35, cy: 0.82, pan: -0.3, impact_strength: 0.92 }
            ],
            envelope: null
        },
        {
            id: 'e2',
            event_type: 'impact',
            start_time: 2.3,
            end_time: 2.9,
            collider_material: 'wood',
            surface_material: 'concrete',
            distance: 'mid',
            prompt: 'wooden bounce with slight acoustic dampening',
            t_impact: 2.6,
            frame_idx: 78,
            cx: 0.52,
            cy: 0.82,
            pan: 0.04,
            impact_strength: 0.74,
            hits: [
                { t_impact: 2.6, frame_idx: 78, cx: 0.52, cy: 0.82, pan: 0.04, impact_strength: 0.74 }
            ],
            envelope: null
        },
        {
            id: 'e3',
            event_type: 'impact',
            start_time: 3.9,
            end_time: 4.5,
            collider_material: 'wood',
            surface_material: 'concrete',
            distance: 'mid',
            prompt: 'final resting tap on floor',
            t_impact: 4.2,
            frame_idx: 126,
            cx: 0.68,
            cy: 0.82,
            pan: 0.36,
            impact_strength: 0.51,
            hits: [
                { t_impact: 4.2, frame_idx: 126, cx: 0.68, cy: 0.82, pan: 0.36, impact_strength: 0.51 }
            ],
            envelope: null
        },
        {
            id: 'e4',
            event_type: 'continuous',
            start_time: 4.5,
            end_time: 5.5,
            collider_material: 'fabric',
            surface_material: 'concrete',
            distance: 'near',
            prompt: 'soft settling rolling friction on surface',
            t_impact: 4.8,
            frame_idx: 144,
            cx: 0.70,
            cy: 0.85,
            pan: 0.40,
            impact_strength: 0.35,
            hits: [
                { t_impact: 4.8, frame_idx: 144, cx: 0.70, cy: 0.85, pan: 0.40, impact_strength: 0.35 }
            ],
            envelope: Array.from({ length: 100 }, (_, i) => Math.max(0.05, Math.sin(i / 15) * 0.4 + 0.1))
        }
    ];

    return {
        session_id: 'mock-session-001',
        video_hash: 'mock-video-hash-abc123',
        analysis_source: 'offline_fallback',
        video: {
            fps: _mockFps,
            duration: _mockDuration,
            width: 640,
            height: 360,
            n_frames: 180,
            url: _mockObjectUrl
        },
        environment: {
            name: 'small_room',
            L: 4.0,
            wall_material: 'wood',
            alpha: 0.10,
            rt60: 0.43
        },
        motion: Array.from({ length: 180 }, (_, i) => {
            if (Math.abs(i - 30) <= 2) return 0.95;
            if (Math.abs(i - 78) <= 2) return 0.75;
            if (Math.abs(i - 126) <= 2) return 0.50;
            return 0.05 + (i % 5) * 0.01;
        }),
        events
    };
}

export async function mockGenerate(
    sessionId: string,
    _events?: EventEditPayload[],
    _forceRegen = false,
    signal?: AbortSignal
): Promise<GenerateResponse> {
    if (signal?.aborted) throw new Error('Aborted');
    await new Promise((res, rej) => {
        const t = setTimeout(res, 1500);
        signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('Aborted')); });
    });

    const waveform = Array.from({ length: 1000 }, (_, i) => {
        const t = (i / 1000) * _mockDuration;
        // Spikes near 1.0, 2.6, 4.2
        if (Math.abs(t - 1.0) < 0.04) return 0.95;
        if (Math.abs(t - 2.6) < 0.04) return 0.72;
        if (Math.abs(t - 4.2) < 0.04) return 0.48;
        return Math.max(0.02, Math.random() * 0.08);
    });

    const naive_waveform = Array.from({ length: 1000 }, (_, i) => {
        const t = (i / 1000) * _mockDuration;
        if (Math.abs(t - 0.8) < 0.06) return 0.8;
        if (Math.abs(t - 2.3) < 0.06) return 0.6;
        if (Math.abs(t - 3.9) < 0.06) return 0.4;
        return 0.05;
    });

    const peaks: Peak[] = [
        { event_id: 'e1', hit_index: 0, time: 1.0, frame_idx: 30, amplitude: 0.95 },
        { event_id: 'e2', hit_index: 0, time: 2.6, frame_idx: 78, amplitude: 0.72 },
        { event_id: 'e3', hit_index: 0, time: 4.2, frame_idx: 126, amplitude: 0.48 }
    ];

    return {
        session_id: sessionId,
        engine: 'procedural',
        synced_video_url: _mockObjectUrl,
        naive_video_url: _mockObjectUrl,
        synced_audio_url: _mockObjectUrl,
        rt60: 0.43,
        waveform,
        naive_waveform,
        peaks,
        generation_seconds: 1.5
    };
}

export async function mockTweak(
    payload: TweakPhysicsPayload,
    signal?: AbortSignal
): Promise<TweakResponse> {
    if (signal?.aborted) throw new Error('Aborted');
    await new Promise((res, rej) => {
        const t = setTimeout(res, 280);
        signal?.addEventListener('abort', () => { clearTimeout(t); rej(new Error('Aborted')); });
    });

    const L = payload.room_length_L ?? 4.0;
    const wall = (payload.wall_material as WallMaterial) ?? 'wood';
    const envName = (payload.environment_name as RoomName) ?? 'small_room';
    const nudge = payload.sync_nudge_frames ?? 0;
    const intensity = payload.intensity_multiplier ?? 1.0;

    const rt60 = computeLocalRT60(L, wall, envName === 'open_field');
    const shiftSec = nudge / _mockFps;

    const waveform = Array.from({ length: 1000 }, (_, i) => {
        const t = (i / 1000) * _mockDuration;
        if (Math.abs(t - (1.0 + shiftSec)) < 0.04) return Math.min(1.0, 0.95 * intensity);
        if (Math.abs(t - (2.6 + shiftSec)) < 0.04) return Math.min(1.0, 0.72 * intensity);
        if (Math.abs(t - (4.2 + shiftSec)) < 0.04) return Math.min(1.0, 0.48 * intensity);
        return Math.max(0.02, Math.random() * 0.08);
    });

    const peaks: Peak[] = [
        { event_id: 'e1', hit_index: 0, time: 1.0 + shiftSec, frame_idx: 30 + nudge, amplitude: Math.min(1.0, 0.95 * intensity) },
        { event_id: 'e2', hit_index: 0, time: 2.6 + shiftSec, frame_idx: 78 + nudge, amplitude: Math.min(1.0, 0.72 * intensity) },
        { event_id: 'e3', hit_index: 0, time: 4.2 + shiftSec, frame_idx: 126 + nudge, amplitude: Math.min(1.0, 0.48 * intensity) }
    ];

    return {
        session_id: payload.session_id,
        rt60,
        environment: {
            name: envName,
            L,
            wall_material: wall,
            alpha: 0.10,
            rt60
        },
        synced_video_url: _mockObjectUrl,
        synced_audio_url: _mockObjectUrl,
        waveform,
        peaks,
        needs_regeneration: [],
        processing_ms: 280
    };
}