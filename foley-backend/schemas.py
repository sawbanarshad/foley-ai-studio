from typing import List, Optional, Any, Dict
import numpy as np
from pydantic import BaseModel, Field, field_validator


def to_py(val: Any) -> Any:
    """Convert numpy types/arrays and nested collections into native Python JSON-serializable types."""
    if isinstance(val, (np.integer,)):
        return int(val)
    elif isinstance(val, (np.floating,)):
        return float(val)
    elif isinstance(val, (np.ndarray,)):
        return val.tolist()
    elif isinstance(val, dict):
        return {k: to_py(v) for k, v in val.items()}
    elif isinstance(val, (list, tuple)):
        return [to_py(v) for v in val]
    return val


VALID_COLLIDER = {"metal", "wood", "glass", "fabric", "leather", "stone"}
VALID_SURFACE = {"metal", "wood", "glass", "fabric", "gravel", "concrete"}
VALID_DISTANCE = {"near", "mid", "far"}
VALID_EVENT_TYPE = {"impact", "continuous"}
VALID_WALL = {"concrete", "stone", "wood", "curtains", "outdoor"}


def normalize_enum(val: str, valid_set: set, default: str) -> str:
    cleaned = str(val or "").strip().lower()
    return cleaned if cleaned in valid_set else default


class Hit(BaseModel):
    t_impact: float
    frame_idx: int
    cx: float = 0.5
    cy: float = 0.5
    pan: float = 0.0
    impact_strength: float = 0.5


class Event(BaseModel):
    id: str
    event_type: str = "impact"
    start_time: float
    end_time: float
    collider_material: str = "wood"
    surface_material: str = "concrete"
    distance: str = "mid"
    prompt: str = ""
    t_impact: float = 0.0
    frame_idx: int = 0
    cx: float = 0.5
    cy: float = 0.5
    pan: float = 0.0
    impact_strength: float = 0.5
    hits: List[Hit] = Field(default_factory=list)
    envelope: Optional[List[float]] = None

    @field_validator("event_type", mode="before")
    def norm_event_type(cls, v):
        return normalize_enum(v, VALID_EVENT_TYPE, "impact")

    @field_validator("collider_material", mode="before")
    def norm_collider(cls, v):
        return normalize_enum(v, VALID_COLLIDER, "wood")

    @field_validator("surface_material", mode="before")
    def norm_surface(cls, v):
        return normalize_enum(v, VALID_SURFACE, "concrete")

    @field_validator("distance", mode="before")
    def norm_distance(cls, v):
        return normalize_enum(v, VALID_DISTANCE, "mid")


class Environment(BaseModel):
    name: str = "small_room"
    estimated_length_m: float = 4.0
    L: float = 4.0
    wall_material: str = "wood"
    alpha: float = 0.10
    rt60: float = 0.35

    @field_validator("wall_material", mode="before")
    def norm_wall(cls, v):
        return normalize_enum(v, VALID_WALL, "wood")


class VideoMeta(BaseModel):
    fps: float
    duration: float
    width: int
    height: int
    n_frames: int
    url: str


class PeakInfo(BaseModel):
    event_id: str
    hit_index: int
    time: float
    frame_idx: int
    amplitude: float


class AnalyzeResponse(BaseModel):
    session_id: str
    video_hash: str
    analysis_source: str
    video: VideoMeta
    environment: Environment
    motion: List[float]
    events: List[Event]


class EventEdit(BaseModel):
    id: str
    event_type: Optional[str] = None
    collider_material: Optional[str] = None
    surface_material: Optional[str] = None
    distance: Optional[str] = None
    prompt: Optional[str] = None


class GenerateAudioRequest(BaseModel):
    session_id: str
    events: Optional[List[EventEdit]] = None
    force_regen: bool = False


class GenerateAudioResponse(BaseModel):
    session_id: str
    engine: str
    synced_video_url: str
    naive_video_url: str
    synced_audio_url: str
    rt60: float
    waveform: List[float]
    naive_waveform: List[float]
    peaks: List[PeakInfo]
    generation_seconds: float


class TweakPhysicsRequest(BaseModel):
    session_id: str
    room_length_L: Optional[float] = None
    wall_material: Optional[str] = None
    alpha: Optional[float] = None
    environment_name: Optional[str] = None
    intensity_multiplier: Optional[float] = None
    sync_nudge_frames: Optional[int] = None
    events: Optional[List[EventEdit]] = None


class TweakPhysicsResponse(BaseModel):
    session_id: str
    rt60: float
    environment: Environment
    synced_video_url: str
    synced_audio_url: str
    waveform: List[float]
    peaks: List[PeakInfo]
    needs_regeneration: List[str]
    processing_ms: float


class HealthResponse(BaseModel):
    status: str
    gpu: Dict[str, Any]
    gemini: Dict[str, Any]
    elevenlabs: Optional[Dict[str, Any]] = None
    freesound: Optional[Dict[str, Any]] = None
    huggingface: Optional[Dict[str, Any]] = None
    ffmpeg: Dict[str, Any]
    audio_engine: str
    model_loaded: bool


class ProcessVideoResponse(BaseModel):
    session_id: str
    detected_scene: str
    ambient_sound_prompt: str
    freesound_query: str
    detected_elements: List[str]
    audio_engine: str
    synced_video_url: str
    synced_audio_url: str
    video_duration: float
    layers: List[Dict[str, Any]]
    processing_seconds: float


class AddCustomSoundRequest(BaseModel):
    video_id: str
    user_prompt: str
    volume: float = 0.6
    start_time: float = 0.0


class AddCustomSoundResponse(BaseModel):
    session_id: str
    updated_video_url: str
    updated_audio_url: str
    active_layers: List[Dict[str, Any]]