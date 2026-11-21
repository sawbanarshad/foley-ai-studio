export type EventType = "impact" | "continuous";
export type Collider = "metal" | "wood" | "glass" | "fabric" | "leather" | "stone";
export type Surface = "metal" | "wood" | "glass" | "fabric" | "gravel" | "concrete";
export type Distance = "near" | "mid" | "far";
export type RoomName = "small_room" | "large_hall" | "cave" | "open_field";
export type WallMaterial = "concrete" | "stone" | "wood" | "curtains" | "outdoor";

export interface Hit {
    t_impact: number;
    frame_idx: number;
    cx: number;
    cy: number;
    pan: number;
    impact_strength: number;
}

export interface FoleyEvent {
    id: string;
    event_type: EventType;
    start_time: number;
    end_time: number;
    collider_material: Collider;
    surface_material: Surface;
    distance: Distance;
    prompt: string;
    t_impact: number;
    frame_idx: number;
    cx: number;
    cy: number;
    pan: number;
    impact_strength: number;
    hits: Hit[];
    envelope: number[] | null;
}

export interface Environment {
    name: RoomName;
    L: number;
    wall_material: WallMaterial;
    alpha: number;
    rt60: number;
}

export interface AnalyzeResponse {
    session_id: string;
    video_hash: string;
    analysis_source: "gemini" | "cache" | "offline_fallback";
    video: {
        fps: number;
        duration: number;
        width: number;
        height: number;
        n_frames: number;
        url: string;
    };
    environment: Environment;
    motion: number[];
    events: FoleyEvent[];
}

export interface Peak {
    event_id: string;
    hit_index: number;
    time: number;
    frame_idx: number;
    amplitude: number;
}

export interface GenerateResponse {
    session_id: string;
    engine: "audioldm" | "procedural";
    synced_video_url: string;
    naive_video_url: string;
    synced_audio_url: string;
    rt60: number;
    waveform: number[];
    naive_waveform: number[];
    peaks: Peak[];
    generation_seconds: number;
}

export interface TweakResponse {
    session_id: string;
    rt60: number;
    environment: Environment;
    synced_video_url: string;
    synced_audio_url: string;
    waveform: number[];
    peaks: Peak[];
    needs_regeneration: string[];
    processing_ms: number;
}

export interface Health {
    status: string;
    gpu: { available: boolean; name: string | null };
    gemini: { key_configured: boolean; model: string };
    ffmpeg: { available: boolean; path: string | null; version: string | null };
    audio_engine: "audioldm" | "procedural";
    model_loaded: boolean;
}