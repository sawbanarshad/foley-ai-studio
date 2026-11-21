import {
    AnalyzeResponse,
    GenerateResponse,
    TweakResponse,
    Health,
    Collider,
    Surface,
    Distance,
    EventType
} from './types';
import { mockAnalyze, mockGenerate, mockTweak, mockHealth } from './mock';

export class ApiError extends Error {
    detail: string;
    status: number;
    constructor(status: number, detail: string) {
        super(detail);
        this.name = 'ApiError';
        this.status = status;
        this.detail = detail;
    }
}

export const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1';

export function resolveUrl(relPath: string): string {
    if (!relPath) return '';
    if (relPath.startsWith('http://') || relPath.startsWith('https://') || relPath.startsWith('blob:') || relPath.startsWith('data:')) {
        return relPath;
    }
    const cleanPath = relPath.startsWith('/') ? relPath : `/${relPath}`;
    return API_BASE ? `${API_BASE}${cleanPath}` : cleanPath;
}

async function request<T>(endpoint: string, options: RequestInit = {}, timeoutMs: number = 30000): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch(url, {
            ...options,
            signal: options.signal || controller.signal
        });
        clearTimeout(id);

        if (!res.ok) {
            let detail = `Request failed: ${res.statusText}`;
            try {
                const errJson = await res.json();
                if (errJson.detail) detail = errJson.detail;
            } catch {
                // use default
            }
            throw new ApiError(res.status, detail);
        }
        return (await res.json()) as T;
    } catch (err: any) {
        clearTimeout(id);
        if (err instanceof ApiError) throw err;
        if (err.name === 'AbortError') {
            throw new ApiError(408, 'Request timed out or was cancelled');
        }
        throw new ApiError(500, err.message || 'Network error connecting to backend');
    }
}

export async function checkHealth(useMock = USE_MOCK): Promise<Health> {
    if (useMock) return mockHealth();
    return request<Health>('/api/health', { method: 'GET' }, 5000);
}

export async function analyzeVideo(file: File, useMock = USE_MOCK, signal?: AbortSignal): Promise<AnalyzeResponse> {
    if (useMock) return mockAnalyze(file, signal);
    const formData = new FormData();
    formData.append('file', file);
    return request<AnalyzeResponse>('/api/analyze-video', {
        method: 'POST',
        body: formData,
        signal
    }, 120000);
}

export interface EventEditPayload {
    id: string;
    collider_material?: Collider;
    surface_material?: Surface;
    distance?: Distance;
    prompt?: string;
    event_type?: EventType;
}

export async function generateAudio(
    sessionId: string,
    events?: EventEditPayload[],
    forceRegen = false,
    useMock = USE_MOCK,
    signal?: AbortSignal
): Promise<GenerateResponse> {
    if (useMock) return mockGenerate(sessionId, events, forceRegen, signal);
    return request<GenerateResponse>('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, events, force_regen: forceRegen }),
        signal
    }, 180000);
}

export interface TweakPhysicsPayload {
    session_id: string;
    room_length_L?: number;
    wall_material?: string;
    environment_name?: string;
    intensity_multiplier?: number;
    sync_nudge_frames?: number;
    events?: EventEditPayload[];
}

export async function tweakPhysics(
    payload: TweakPhysicsPayload,
    useMock = USE_MOCK,
    signal?: AbortSignal
): Promise<TweakResponse> {
    if (useMock) return mockTweak(payload, signal);
    return request<TweakResponse>('/api/tweak-physics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal
    }, 15000);
}

export async function getSession(sessionId: string, useMock = USE_MOCK): Promise<any> {
    if (useMock) return null;
    return request<any>(`/api/session/${sessionId}`, { method: 'GET' }, 10000);
}

export interface SoundLayer {
    layer_id: string;
    name: string;
    prompt: string;
    volume: number;
    start_time: number;
    engine: string;
}

export interface ProcessVideoResponse {
    session_id: string;
    detected_scene: string;
    ambient_sound_prompt: string;
    freesound_query: string;
    detected_elements: string[];
    audio_engine: string;
    synced_video_url: string;
    synced_audio_url: string;
    video_duration: number;
    layers: SoundLayer[];
    processing_seconds: number;
}

export interface AddCustomSoundPayload {
    video_id: string;
    user_prompt: string;
    volume?: number;
    start_time?: number;
}

export interface AddCustomSoundResponse {
    session_id: string;
    updated_video_url: string;
    updated_audio_url: string;
    active_layers: SoundLayer[];
}

export async function processVideo(file: File, signal?: AbortSignal): Promise<ProcessVideoResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return request<ProcessVideoResponse>('/api/process-video', {
        method: 'POST',
        body: formData,
        signal
    }, 180000);
}

export async function addCustomSound(
    payload: AddCustomSoundPayload,
    signal?: AbortSignal
): Promise<AddCustomSoundResponse> {
    return request<AddCustomSoundResponse>('/api/add-custom-sound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal
    }, 120000);
}