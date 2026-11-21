import json
import logging
import time
import uuid
import os
from pathlib import Path
from typing import Dict, Any, Optional, List

import numpy as np
from scipy.io import wavfile
try:
    import torch
except ImportError:
    torch = None
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from config import (
    SR,
    BASE_DIR,
    UPLOADS_DIR,
    OUTPUTS_DIR,
    SESSIONS_DIR,
    GEMINI_API_KEY,
    GEMINI_MODEL,
    ELEVENLABS_API_KEY,
    FREESOUND_API_KEY
)
from schemas import (
    to_py,
    Event,
    Environment,
    VideoMeta,
    AnalyzeResponse,
    GenerateAudioRequest,
    GenerateAudioResponse,
    TweakPhysicsRequest,
    TweakPhysicsResponse,
    HealthResponse,
    ProcessVideoResponse,
    AddCustomSoundRequest,
    AddCustomSoundResponse
)
from cache_manager import CacheManager, get_ffmpeg_binary
from services.audio_engine import AudioEngine
from vision_tracker import (
    extract_5_keyframes_and_recognize,
    call_gemini_analysis,
    compute_environment_physics,
    track_motion_and_sync,
    offline_fallback_analysis
)
from audio_generator import (
    generate_audio_clip,
    get_engine_choice
)
from physics_dsp import render_hit_dsp
from sync_muxer import (
    assemble_synced_track,
    assemble_naive_track,
    compute_binned_waveform,
    mux_video_audio,
    manage_version_cleanup
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("foley_backend")

app = FastAPI(title="Foley AI Studio Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False
)

# Mount static file outputs
app.mount("/outputs", StaticFiles(directory=str(OUTPUTS_DIR)), name="outputs")
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

STATIC_DIR = BASE_DIR.parent / "foley-frontend" / "dist"
if not (STATIC_DIR / "index.html").exists():
    STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
TESTS_DIR = BASE_DIR / "tests"
TESTS_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/tests", StaticFiles(directory=str(TESTS_DIR)), name="tests")

ASSETS_DIR = STATIC_DIR / "assets"
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

SAMPLES_DIR = BASE_DIR.parent / "foley-frontend" / "public" / "samples"
if not SAMPLES_DIR.exists():
    SAMPLES_DIR = STATIC_DIR / "samples"
if SAMPLES_DIR.exists():
    app.mount("/samples", StaticFiles(directory=str(SAMPLES_DIR)), name="samples")


@app.get("/")
def serve_index():
    from fastapi.responses import FileResponse
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "Foley AI Studio Backend Running (Real Audio Mode)"}


_sessions: Dict[str, Dict[str, Any]] = {}


def save_session(session_id: str, data: Dict[str, Any]):
    _sessions[session_id] = data
    path = SESSIONS_DIR / f"{session_id}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(to_py(data), f, indent=2)


def get_session(session_id: str) -> Dict[str, Any]:
    if session_id in _sessions:
        return _sessions[session_id]
    path = SESSIONS_DIR / f"{session_id}.json"
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                _sessions[session_id] = data
                return data
        except Exception:
            pass
    raise HTTPException(status_code=404, detail="Session not found.")


@app.get("/api/health", response_model=HealthResponse)
def health():
    gpu_avail = bool(torch is not None and torch.cuda.is_available())
    gpu_name = torch.cuda.get_device_name(0) if gpu_avail else None
    
    ffmpeg_path = get_ffmpeg_binary()
    ffmpeg_avail = bool(ffmpeg_path and Path(ffmpeg_path).exists())

    eleven_key = os.getenv("ELEVENLABS_API_KEY", ELEVENLABS_API_KEY).strip()
    freesound_key = os.getenv("FREESOUND_API_KEY", FREESOUND_API_KEY).strip()
    gemini_key = os.getenv("GEMINI_API_KEY", GEMINI_API_KEY).strip()

    engine_str = "elevenlabs" if eleven_key else ("freesound" if freesound_key else "none")

    return HealthResponse(
        status="ok",
        gpu={"available": gpu_avail, "name": gpu_name},
        gemini={"key_configured": bool(gemini_key), "model": GEMINI_MODEL},
        elevenlabs={"configured": bool(eleven_key)},
        freesound={"configured": bool(freesound_key)},
        huggingface={"configured": False, "username": None},
        ffmpeg={"available": ffmpeg_avail, "path": str(ffmpeg_path), "version": "system/imageio"},
        audio_engine=engine_str,
        model_loaded=False
    )


# =========================================================================
# REQUIREMENT 4: AUTO-SOUND ENDPOINT (POST /api/process-video)
# =========================================================================
@app.post("/api/process-video", response_model=ProcessVideoResponse)
def process_video(file: UploadFile = File(...)):
    """
    1. Extract 5 frames -> Call Gemini gemini-2.5-flash -> Print detected JSON to console.
    2. Call audio_engine.generate_audio(ambient_sound_prompt, freesound_query, video_duration).
    3. Merge real audio track with mute video using FFmpeg and save output MP4.
       Keep base audio file saved for layering.
    """
    t0 = time.time()
    session_id = str(uuid.uuid4())
    logger.info(f"Processing video for session {session_id}: {file.filename}")

    try:
        video_hash, trimmed_path, meta = CacheManager.save_and_preprocess_upload(
            session_id=session_id,
            file_obj=file.file,
            filename=file.filename or "video.mp4"
        )
    except Exception as e:
        logger.exception("Video preprocessing failed")
        raise HTTPException(status_code=400, detail=f"Preprocessing error: {str(e)}")

    duration = meta["duration"]

    # 1. Extract 5 frames -> Call Gemini gemini-2.5-flash
    try:
        gemini_result = extract_5_keyframes_and_recognize(trimmed_path)
    except Exception as ge:
        logger.error(f"[Gemini Vision Failure in /api/process-video]: {str(ge)}")
        raise HTTPException(
            status_code=502,
            detail=f"Gemini Recognition Error: {str(ge)}. Check GEMINI_API_KEY in .env."
        )

    detected_scene = gemini_result.get("detected_scene", "")
    ambient_prompt = gemini_result.get("ambient_sound_prompt", detected_scene)
    freesound_query = gemini_result.get("freesound_query", "ambient nature")
    detected_elements = gemini_result.get("detected_elements", [])

    print("\n" + "=" * 60)
    print(">>> [1. EXTRACTING FRAMES: 5 keyframes extracted successfully]")
    print(f">>> [2. GEMINI RECOGNIZED]: {detected_scene}")
    print(f"    Ambient Sound Prompt: {ambient_prompt}")
    print(f"    Freesound Query:      {freesound_query}")
    print(f"    Detected Elements:    {detected_elements}")
    print("=" * 60 + "\n")

    # 2. Call audio_engine.generate_audio
    session_out_dir = OUTPUTS_DIR / session_id
    session_out_dir.mkdir(parents=True, exist_ok=True)
    base_audio_path = session_out_dir / "base_audio.mp3"

    try:
        print(">>> [3. GENERATING REAL AUDIO via ElevenLabs/Freesound...]")
        final_audio_path, engine_used = AudioEngine.generate_audio(
            prompt=ambient_prompt,
            freesound_query=freesound_query,
            video_duration=duration,
            output_path=str(base_audio_path)
        )
    except Exception as ae:
        logger.error(f"[Real Audio Generation Failure]: {str(ae)}")
        raise HTTPException(
            status_code=502,
            detail=f"Real Audio Engine Error: {str(ae)}"
        )

    # 3. Merge audio track with mute video using FFmpeg
    print(">>> [4. MERGING VIDEO AND REAL AUDIO TRACK...]")
    synced_mp4_path = session_out_dir / "synced_v1.mp4"
    AudioEngine.merge_video_audio(trimmed_path, str(base_audio_path), str(synced_mp4_path))

    session_data = {
        "session_id": session_id,
        "video_hash": video_hash,
        "video_path": trimmed_path,
        "duration": duration,
        "detected_scene": detected_scene,
        "ambient_sound_prompt": ambient_prompt,
        "freesound_query": freesound_query,
        "detected_elements": detected_elements,
        "audio_engine": engine_used,
        "base_audio_path": str(base_audio_path),
        "current_audio_path": str(base_audio_path),
        "version_counter": 1,
        "layers": [
            {
                "layer_id": "base",
                "name": "Base Audio",
                "prompt": ambient_prompt,
                "volume": 1.0,
                "start_time": 0.0,
                "engine": engine_used
            }
        ]
    }
    save_session(session_id, session_data)

    return ProcessVideoResponse(
        session_id=session_id,
        detected_scene=detected_scene,
        ambient_sound_prompt=ambient_prompt,
        freesound_query=freesound_query,
        detected_elements=detected_elements,
        audio_engine=engine_used,
        synced_video_url=f"/outputs/{session_id}/synced_v1.mp4",
        synced_audio_url=f"/outputs/{session_id}/base_audio.mp3",
        video_duration=duration,
        layers=session_data["layers"],
        processing_seconds=round(time.time() - t0, 3)
    )


# =========================================================================
# REQUIREMENT 4: CUSTOM SOUND LAYERING ENDPOINT (POST /api/add-custom-sound)
# =========================================================================
@app.post("/api/add-custom-sound", response_model=AddCustomSoundResponse)
def add_custom_sound(req: AddCustomSoundRequest):
    """
    Takes video_id, user_prompt, volume (0.1 to 1.0, default 0.6), start_time.
    Generates/fetches NEW real audio clip using exact same audio_engine.
    MIXES (overlays) this new audio layer ON TOP OF existing video audio track.
    Returns updated MP4 URL and active layers list.
    """
    session = get_session(req.video_id)
    session_id = req.video_id
    duration = session["duration"]
    session_out_dir = OUTPUTS_DIR / session_id

    layer_num = len(session.get("layers", [])) + 1
    layer_id = f"layer_{layer_num}"
    layer_audio_path = session_out_dir / f"{layer_id}.mp3"

    try:
        print(f"\n>>> [Generating Custom Sound Layer: '{req.user_prompt}']...")
        _, engine_used = AudioEngine.generate_layer_audio(
            user_prompt=req.user_prompt,
            duration=duration,
            output_path=str(layer_audio_path)
        )
    except Exception as ae:
        logger.error(f"[Custom Sound Layer Error] {str(ae)}")
        raise HTTPException(
            status_code=502,
            detail=f"Layer Sound Generation Error: {str(ae)}"
        )

    v_num = session.get("version_counter", 1) + 1
    session["version_counter"] = v_num
    new_composite_audio = session_out_dir / f"composite_v{v_num}.mp3"
    current_audio = session.get("current_audio_path", session.get("base_audio_path"))

    print(f">>> [Mixing layer on top of base audio: Vol={req.volume}, Start={req.start_time}s]...")
    AudioEngine.mix_audio_layers(
        base_audio_path=current_audio,
        layer_audio_path=str(layer_audio_path),
        volume=req.volume,
        start_time=req.start_time,
        output_path=str(new_composite_audio),
        total_duration=duration
    )
    session["current_audio_path"] = str(new_composite_audio)

    # Mux new composite audio with video
    trimmed_video_path = session["video_path"]
    synced_mp4_path = session_out_dir / f"synced_v{v_num}.mp4"
    AudioEngine.merge_video_audio(trimmed_video_path, str(new_composite_audio), str(synced_mp4_path))

    new_layer_meta = {
        "layer_id": layer_id,
        "name": f"Layer {layer_num}: {req.user_prompt[:25]}",
        "prompt": req.user_prompt,
        "volume": req.volume,
        "start_time": req.start_time,
        "engine": engine_used
    }
    session["layers"].append(new_layer_meta)
    save_session(session_id, session)

    return AddCustomSoundResponse(
        session_id=session_id,
        updated_video_url=f"/outputs/{session_id}/synced_v{v_num}.mp4",
        updated_audio_url=f"/outputs/{session_id}/composite_v{v_num}.mp3",
        active_layers=session["layers"]
    )


# =========================================================================
# STUDIO VIDEO ANALYSIS (POST /api/analyze-video) - ZERO FAKE FALLBACKS
# =========================================================================
@app.post("/api/analyze-video", response_model=AnalyzeResponse)
def analyze_video(file: UploadFile = File(...)):
    session_id = str(uuid.uuid4())
    logger.info(f"New video upload received for session {session_id}: {file.filename}")

    try:
        video_hash, trimmed_path, meta = CacheManager.save_and_preprocess_upload(
            session_id=session_id,
            file_obj=file.file,
            filename=file.filename or "video.mp4"
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.exception("Failed during video preprocessing")
        raise HTTPException(status_code=500, detail=f"Preprocessing error: {str(e)}")

    fps = meta["fps"]
    duration = meta["duration"]

    cached_gemini = CacheManager.get_gemini(video_hash)
    analysis_source = "cache"

    if cached_gemini is not None:
        raw_env = cached_gemini.get("environment", {})
        raw_events = cached_gemini.get("events", [])
        gemini_info = cached_gemini.get("gemini_info", {})
    else:
        # Extract 5 keyframes & call Gemini 2.5 Flash
        try:
            gemini_info = extract_5_keyframes_and_recognize(trimmed_path)
            raw_env, raw_events = call_gemini_analysis(trimmed_path, duration)
            analysis_source = "gemini"
            CacheManager.put_gemini(video_hash, {
                "environment": raw_env,
                "events": raw_events,
                "gemini_info": gemini_info
            })
        except Exception as ge:
            logger.error(f"[Gemini API Error in /api/analyze-video]: {str(ge)}")
            motion_probe, _ = track_motion_and_sync(trimmed_path, [], fps, duration)
            raw_env, raw_events = offline_fallback_analysis(motion_probe, fps, duration)
            gemini_info = {
                "detected_scene": "Offline vision fallback",
                "gemini_error": str(ge),
                "fallback": True
            }
            analysis_source = "offline_fallback"

    env_model = compute_environment_physics(raw_env)
    motion_curve, events_models = track_motion_and_sync(trimmed_path, raw_events, fps, duration)

    max_m = float(motion_curve.max()) if motion_curve.max() > 0 else 1.0
    norm_motion = [round(float(v / max_m), 4) for v in motion_curve]

    video_meta = VideoMeta(
        fps=fps,
        duration=duration,
        width=meta["width"],
        height=meta["height"],
        n_frames=meta["n_frames"],
        url=f"/uploads/{session_id}/trimmed.mp4"
    )

    session_data = {
        "session_id": session_id,
        "video_hash": video_hash,
        "video_path": trimmed_path,
        "duration": duration,
        "analysis_source": analysis_source,
        "gemini_info": gemini_info,
        "video": video_meta.model_dump(),
        "environment": env_model.model_dump(),
        "motion": norm_motion,
        "events": [e.model_dump() for e in events_models],
        "settings": {
            "intensity_multiplier": 1.0,
            "sync_nudge_frames": 0
        },
        "version_counter": 0,
        "engine": get_engine_choice(),
        "layers": []
    }
    save_session(session_id, session_data)

    return AnalyzeResponse(
        session_id=session_id,
        video_hash=video_hash,
        analysis_source=analysis_source,
        video=video_meta,
        environment=env_model,
        motion=norm_motion,
        events=events_models
    )


# =========================================================================
# STUDIO REAL AUDIO GENERATION (POST /api/generate-audio) - ZERO SINE TAPS
# =========================================================================
@app.post("/api/generate-audio", response_model=GenerateAudioResponse)
def generate_audio(req: GenerateAudioRequest):
    t0 = time.time()
    session = get_session(req.session_id)
    session_id = req.session_id
    video_hash = session["video_hash"]
    fps = session["video"]["fps"]
    duration = session["video"]["duration"]
    env_data = Environment(**session["environment"])

    session_events = [Event(**e) for e in session["events"]]
    events_map = {e.id: e for e in session_events}

    if req.events:
        for edit in req.events:
            if edit.id not in events_map:
                raise HTTPException(status_code=422, detail=f"Unknown event id: {edit.id}")
            ev = events_map[edit.id]
            if edit.collider_material is not None:
                ev.collider_material = edit.collider_material
            if edit.surface_material is not None:
                ev.surface_material = edit.surface_material
            if edit.distance is not None:
                ev.distance = edit.distance
            if edit.prompt is not None:
                ev.prompt = edit.prompt
            if edit.event_type is not None:
                ev.event_type = edit.event_type

    chosen_engine = get_engine_choice()
    dry_clips_list = []
    rendered_hits = []

    session_out_dir = OUTPUTS_DIR / session_id
    session_out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Fetch real acoustic audio clips via ElevenLabs or Freesound
    for event in session_events:
        try:
            raw_clip, engine_used = generate_audio_clip(event, video_hash, hit_index=0, duration=duration)
        except Exception as ae:
            logger.error(f"[AudioEngine Failure in /api/generate-audio]: {str(ae)}")
            raise HTTPException(
                status_code=502,
                detail=f"Real Audio Engine Error: {str(ae)}"
            )

        chosen_engine = engine_used
        dry_clips_list.append((event, raw_clip))

        for h_idx, hit in enumerate(event.hits):
            stereo_hit, p_idx = render_hit_dsp(
                raw_dry_clip=raw_clip,
                event=event,
                hit=hit,
                hit_index=h_idx,
                video_hash=video_hash,
                environment=env_data,
                intensity_multiplier=session["settings"]["intensity_multiplier"],
                cached_variant=None
            )
            rendered_hits.append((event, hit, h_idx, stereo_hit, p_idx))

    # Assemble master synced track
    nudge = session["settings"]["sync_nudge_frames"]
    synced_track, peaks = assemble_synced_track(
        rendered_clips=rendered_hits,
        duration=duration,
        fps=fps,
        sync_nudge_frames=nudge
    )

    naive_track = assemble_naive_track(dry_clips_list, duration)

    # Version increment
    session["version_counter"] = session.get("version_counter", 0) + 1
    v_num = session["version_counter"]
    session["engine"] = chosen_engine
    session["events"] = [e.model_dump() for e in session_events]

    # Write audio
    synced_wav_path = session_out_dir / f"synced_v{v_num}.wav"
    synced_mp3_path = session_out_dir / f"base_audio.mp3"
    naive_wav_path = session_out_dir / "naive.wav"
    wavfile.write(str(synced_wav_path), SR, synced_track)
    wavfile.write(str(naive_wav_path), SR, naive_track)

    session["base_audio_path"] = str(synced_wav_path)
    session["current_audio_path"] = str(synced_wav_path)
    session["layers"] = [
        {
            "layer_id": "base",
            "name": "Base Audio",
            "prompt": session_events[0].prompt if session_events else "Real Audio",
            "volume": 1.0,
            "start_time": 0.0,
            "engine": chosen_engine
        }
    ]
    save_session(session_id, session)

    # Mux video
    trimmed_video_path = str(BASE_DIR / session["video"]["url"].lstrip("/"))
    synced_mp4_path = session_out_dir / f"synced_v{v_num}.mp4"
    naive_mp4_path = session_out_dir / "naive_video.mp4"

    AudioEngine.merge_video_audio(trimmed_video_path, str(synced_wav_path), str(synced_mp4_path))
    if not naive_mp4_path.exists() or req.force_regen:
        AudioEngine.merge_video_audio(trimmed_video_path, str(naive_wav_path), str(naive_mp4_path))

    manage_version_cleanup(session_out_dir, v_num, max_keep=3)

    waveform = compute_binned_waveform(synced_track, 1000)
    naive_waveform = compute_binned_waveform(naive_track, 1000)
    gen_time = round(time.time() - t0, 3)

    return GenerateAudioResponse(
        session_id=session_id,
        engine=chosen_engine,
        synced_video_url=f"/outputs/{session_id}/synced_v{v_num}.mp4",
        naive_video_url=f"/outputs/{session_id}/naive_video.mp4",
        synced_audio_url=f"/outputs/{session_id}/synced_v{v_num}.wav",
        rt60=env_data.rt60,
        waveform=waveform,
        naive_waveform=naive_waveform,
        peaks=peaks,
        generation_seconds=gen_time
    )


@app.post("/api/tweak-physics", response_model=TweakPhysicsResponse)
def tweak_physics(req: TweakPhysicsRequest):
    t0 = time.time()
    session = get_session(req.session_id)
    session_id = req.session_id
    video_hash = session["video_hash"]
    fps = session["video"]["fps"]
    duration = session["video"]["duration"]

    env_dict = session["environment"]
    if req.room_length_L is not None:
        env_dict["L"] = req.room_length_L
        env_dict["estimated_length_m"] = req.room_length_L
    if req.wall_material is not None:
        env_dict["wall_material"] = req.wall_material
    if req.environment_name is not None:
        env_dict["name"] = req.environment_name

    env_model = compute_environment_physics(env_dict)
    session["environment"] = env_model.model_dump()

    if req.intensity_multiplier is not None:
        session["settings"]["intensity_multiplier"] = req.intensity_multiplier
    if req.sync_nudge_frames is not None:
        session["settings"]["sync_nudge_frames"] = req.sync_nudge_frames

    session_events = [Event(**e) for e in session["events"]]
    session_out_dir = OUTPUTS_DIR / session_id

    # Re-render hits with new physics DSP
    rendered_hits = []
    for event in session_events:
        cached_clip = CacheManager.get_clip(
            video_hash=video_hash,
            event_id=event.id,
            prompt=event.prompt,
            event_type=event.event_type
        )
        if cached_clip is not None:
            raw_clip, _ = cached_clip
        else:
            raw_clip, _ = generate_audio_clip(event, video_hash, hit_index=0, duration=duration)

        for h_idx, hit in enumerate(event.hits):
            stereo_hit, p_idx = render_hit_dsp(
                raw_dry_clip=raw_clip,
                event=event,
                hit=hit,
                hit_index=h_idx,
                video_hash=video_hash,
                environment=env_model,
                intensity_multiplier=session["settings"]["intensity_multiplier"]
            )
            rendered_hits.append((event, hit, h_idx, stereo_hit, p_idx))

    nudge = session["settings"]["sync_nudge_frames"]
    synced_track, peaks = assemble_synced_track(
        rendered_clips=rendered_hits,
        duration=duration,
        fps=fps,
        sync_nudge_frames=nudge
    )

    session["version_counter"] = session.get("version_counter", 0) + 1
    v_num = session["version_counter"]
    save_session(session_id, session)

    synced_wav_path = session_out_dir / f"synced_v{v_num}.wav"
    wavfile.write(str(synced_wav_path), SR, synced_track)

    trimmed_video_path = str(BASE_DIR / session["video"]["url"].lstrip("/"))
    synced_mp4_path = session_out_dir / f"synced_v{v_num}.mp4"
    AudioEngine.merge_video_audio(trimmed_video_path, str(synced_wav_path), str(synced_mp4_path))

    manage_version_cleanup(session_out_dir, v_num, max_keep=3)
    waveform = compute_binned_waveform(synced_track, 1000)

    return TweakPhysicsResponse(
        session_id=session_id,
        rt60=env_model.rt60,
        environment=env_model,
        synced_video_url=f"/outputs/{session_id}/synced_v{v_num}.mp4",
        synced_audio_url=f"/outputs/{session_id}/synced_v{v_num}.wav",
        waveform=waveform,
        peaks=peaks,
        needs_regeneration=[],
        processing_ms=round((time.time() - t0) * 1000, 2)
    )