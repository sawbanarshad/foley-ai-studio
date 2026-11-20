import json
import math
import time
from typing import List, Dict, Any, Tuple, Optional
import cv2
import numpy as np
from scipy.signal import find_peaks

from config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    ANALYSIS_SIZE,
    ABSORPTION
)
from schemas import Hit, Event, Environment


def parse_time_val(val: Any) -> float:
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    if ":" in s:
        parts = s.split(":")
        try:
            if len(parts) == 2:
                return float(parts[0]) * 60 + float(parts[1])
            elif len(parts) == 3:
                return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
        except Exception:
            pass
    try:
        return float(s)
    except Exception:
        return 0.0


def extract_5_keyframes_and_recognize(video_path: str) -> Dict[str, Any]:
    """
    Extracts 5 evenly-spaced JPEG keyframes from video and calls gemini-2.5-flash
    using the official google-genai SDK.
    Returns parsed JSON dict with:
      - detected_scene
      - ambient_sound_prompt
      - freesound_query
      - detected_elements
      - duration
    Prints exact HTTP status and error if it fails, never fails silently.
    """
    import cv2
    from PIL import Image
    import os

    api_key = os.getenv("GEMINI_API_KEY", GEMINI_API_KEY).strip()
    if not api_key:
        error_msg = "GEMINI_API_KEY is not configured in .env."
        print(f"[Gemini Vision Error] {error_msg}")
        raise ValueError(error_msg)

    os.environ["GEMINI_API_KEY"] = api_key
    os.environ["GOOGLE_API_KEY"] = api_key

    from google import genai
    from google.genai import types

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"OpenCV could not open video: {video_path}")

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    duration = round(float(total_frames / fps), 3)

    if total_frames <= 0:
        cap.release()
        raise RuntimeError(f"Video contains 0 frames: {video_path}")

    # 5 evenly-spaced frames: 10%, 30%, 50%, 70%, 90%
    indices = [int(total_frames * (i + 0.5) / 5) for i in range(5)]
    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(idx, total_frames - 1))
        ret, frame = cap.read()
        if ret and frame is not None:
            resized = cv2.resize(frame, (640, 360), interpolation=cv2.INTER_AREA)
            rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
            frames.append(Image.fromarray(rgb))
    cap.release()

    if len(frames) == 0:
        raise RuntimeError("Could not extract any valid keyframes from video.")

    prompt = f"""
You are an expert Hollywood Foley Sound Designer and Acoustic Vision Specialist.
Analyze these 5 sequential keyframes extracted across the duration of this mute video (exact duration: {duration} seconds).
Recognize what is visually happening in the video (environment, action, motion, surfaces).
Respond with a STRICT JSON object adhering to this schema with NO markdown, NO backticks:
{{
  "detected_scene": "Detailed 1-sentence description of what is visually happening in the video",
  "ambient_sound_prompt": "Rich, cinematic sound-effect prompt for the main background environment (e.g., rushing waterfall in a quiet forest with gentle wind and distant birds)",
  "freesound_query": "2-3 simple keywords for searching real audio (e.g., forest waterfall birds)",
  "detected_elements": ["element1", "element2", "element3"]
}}
"""

    client = genai.Client(api_key=api_key)
    gen_config = types.GenerateContentConfig(
        response_mime_type="application/json",
        temperature=0.1
    )

    models_to_try = [GEMINI_MODEL, "gemini-3.1-flash-lite", "gemini-3.8-flash"]
    models_to_try = list(dict.fromkeys(models_to_try))

    last_error = None
    for model_name in models_to_try:
        try:
            print(f"[Gemini Vision] Sending 5 extracted keyframes ({len(frames)} frames) to {model_name}...")
            response = client.models.generate_content(
                model=model_name,
                contents=[*frames, prompt],
                config=gen_config
            )
            print("[Gemini Vision Recognition Raw Output]:")
            print(response.text)
            data = json.loads(response.text)
            data["duration"] = duration
            return data
        except Exception as e:
            last_error = e
            status_code = getattr(e, "code", getattr(e, "status_code", "N/A"))
            print(f"[Gemini API Attempt] Model {model_name} failed: HTTP {status_code} - {str(e)}")

    status_code = getattr(last_error, "code", getattr(last_error, "status_code", "N/A"))
    print(f"[Gemini API Error] HTTP Status: {status_code}, Error: {str(last_error)}")
    raise RuntimeError(f"Gemini API Error (HTTP {status_code}): {str(last_error)}")


def call_gemini_analysis(trimmed_video_path: str, duration: float) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Analyze video with 5 keyframes and return environment and events."""
    data = extract_5_keyframes_and_recognize(trimmed_video_path)
    env_name = "open_field"
    elements = [el.lower() for el in data.get("detected_elements", [])]
    if any(w in elements for w in ["room", "indoor", "office", "kitchen"]):
        env_name = "small_room"
    elif any(w in elements for w in ["hall", "auditorium", "gym", "warehouse"]):
        env_name = "large_hall"
    elif any(w in elements for w in ["cave", "tunnel"]):
        env_name = "cave"

    env = {
        "name": env_name,
        "estimated_length_m": 15.0 if env_name == "open_field" else 5.0,
        "wall_material": "outdoor" if env_name == "open_field" else "wood"
    }

    events = [
        {
            "id": "e1",
            "event_type": "continuous",
            "start_time": 0.0,
            "end_time": duration,
            "collider_material": "fabric",
            "surface_material": "fabric" if env_name == "open_field" else "wood",
            "distance": "near",
            "prompt": data.get("ambient_sound_prompt", data.get("detected_scene", "natural ambient sound"))
        }
    ]
    return env, events


def classify_visual_patch(frame_bgr: np.ndarray, cx: float, cy: float, strength: float) -> Tuple[str, str, str]:
    """
    Inspects visual features, HSV color histogram, specular highlights, and edge gradients
    at the collision point (cx, cy) to classify real materials and sound prompts.
    """
    h, w, _ = frame_bgr.shape
    px = int(np.clip(cx * w, 0, w - 1))
    py = int(np.clip(cy * h, 0, h - 1))
    half_box = 24
    patch = frame_bgr[max(0, py - half_box):min(h, py + half_box), max(0, px - half_box):min(w, px + half_box)]

    if patch.size == 0:
        return "wood", "wood", "crisp wooden tap"

    hsv = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)
    h_mean = float(hsv[:, :, 0].mean())
    s_mean = float(hsv[:, :, 1].mean())
    v_mean = float(hsv[:, :, 2].mean())
    v_max = float(hsv[:, :, 2].max())
    lap_var = float(cv2.Laplacian(patch, cv2.CV_64F).var())

    # 1. Specular / Metallic glint or Blade (High brightness, low saturation, high contrast)
    if v_max > 190 and s_mean < 75 and (v_mean > 85 or lap_var > 50):
        # Water splashes have darker ground background with sharp specular droplets
        if v_mean < 145 and s_mean < 45:
            return "fabric", "fabric", "water splash and liquid droplet splatter"
        if strength > 0.6:
            return "metal", "metal", "heavy metallic blade clash and ring"
        return "metal", "metal", "crisp metallic impact and chime"

    # 2. Glass / Crystalline / Ceramic (Extreme local edge sharpness + bright highlights)
    if lap_var > 200 and v_max > 175:
        return "glass", "stone", "sharp resonant glass impact and chime"

    # 3. Water / Liquid (Blue/Cyan hues: H between 80 and 140 with moderate saturation)
    if 80 <= h_mean <= 140 and s_mean > 35:
        return "fabric", "fabric", "water splash and liquid droplet bubble"

    # 4. Nature / Foliage / Grass / Trees (Green hues: H between 32 and 88, saturation > 22)
    if 32 <= h_mean <= 88 and s_mean >= 22:
        return "fabric", "gravel", "wind rustling through meadow grass and foliage"

    # 5. Flesh / Punch / Skin contact (Warm pink/tan hues: H < 22 or H > 160 with medium saturation)
    if (h_mean < 22 or h_mean > 160) and 25 < s_mean < 180 and v_mean > 50:
        if strength > 0.5:
            return "leather", "fabric", "heavy combat punch smack to body"
        return "leather", "fabric", "crisp slap and skin impact"

    # 5. Stone / Concrete / Heavy Debris (Neutral desaturated gray with rough texture)
    if s_mean < 40 and (lap_var > 35 or v_mean < 75):
        if strength > 0.6:
            return "stone", "concrete", "heavy stone smash and rocky crack"
        return "stone", "concrete", "crisp rock impact and debris tap"

    # 6. Wood / Timber / Organic (Warm golden/brown hues: H between 10 and 40, medium saturation)
    if 10 <= h_mean <= 40 and s_mean >= 30:
        return "wood", "wood", "crisp wooden block knock and tap"

    # 7. Fallback based on impact strength and brightness
    if v_mean > 130:
        return "metal", "concrete", "metallic click on hard surface"
    elif lap_var > 35:
        return "stone", "stone", "sharp stone impact"
    else:
        return "wood", "concrete", "crisp wooden knock tap"


def offline_fallback_analysis(
    motion: np.ndarray,
    fps: float,
    duration: float,
    sample_bgr: Optional[np.ndarray] = None,
    droplet_spots: float = 0.0
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Robust offline heuristic fallback when Gemini API is unavailable or fails."""
    env = {
        "name": "small_room",
        "estimated_length_m": 4.0,
        "wall_material": "wood"
    }

    # 1. Rain / Precipitation check (ubiquitous micro droplet splash spots across frames)
    if droplet_spots >= 8.0:
        env["name"] = "open_field"
        env["wall_material"] = "outdoor"
        env["estimated_length_m"] = 25.0
        events = [
            {
                "id": "e1",
                "event_type": "continuous",
                "start_time": 0.0,
                "end_time": duration,
                "collider_material": "fabric",
                "surface_material": "fabric",
                "distance": "near",
                "prompt": "steady rainfall with water droplet splashes and puddles"
            }
        ]
        if duration > 3.5:
            half_dur = round(duration / 2.0, 2)
            events.append({
                "id": "e2",
                "event_type": "continuous",
                "start_time": half_dur,
                "end_time": duration,
                "collider_material": "fabric",
                "surface_material": "gravel",
                "distance": "mid",
                "prompt": "gentle ambient rain shower and wet puddle splatter"
            })
        return env, events

    mean_motion = float(motion.mean())
    max_motion = float(motion.max())
    motion_ratio = max_motion / (mean_motion + 1e-5)
    is_continuous_ambient = (motion_ratio < 2.5)

    is_outdoor_nature = False
    if sample_bgr is not None and sample_bgr.size > 0:
        hsv = cv2.cvtColor(sample_bgr, cv2.COLOR_BGR2HSV)
        green_mask = (hsv[:, :, 0] >= 32) & (hsv[:, :, 0] <= 88) & (hsv[:, :, 1] >= 22)
        sky_mask = (hsv[:, :, 0] >= 90) & (hsv[:, :, 0] <= 130) & (hsv[:, :, 2] >= 115)
        if float(green_mask.mean()) > 0.12 or float(sky_mask.mean()) > 0.15:
            is_outdoor_nature = True
            if is_continuous_ambient:
                env["name"] = "open_field"
                env["wall_material"] = "outdoor"
                env["estimated_length_m"] = 25.0

    if is_continuous_ambient:
        events = []
        half_dur = round(duration / 2.0, 2)
        p1 = "gentle wind breeze through forest grass and trees" if is_outdoor_nature else "smooth ambient air movement and subtle texture"
        p2 = "soft atmospheric nature breeze and foliage rustle" if is_outdoor_nature else "continuous background atmosphere and room tone"

        events.append({
            "id": "e1",
            "event_type": "continuous",
            "start_time": 0.0,
            "end_time": min(duration, max(1.5, half_dur)),
            "collider_material": "fabric",
            "surface_material": "fabric" if is_outdoor_nature else "wood",
            "distance": "mid",
            "prompt": p1
        })
        if duration > 3.0:
            events.append({
                "id": "e2",
                "event_type": "continuous",
                "start_time": half_dur,
                "end_time": duration,
                "collider_material": "fabric",
                "surface_material": "gravel" if is_outdoor_nature else "concrete",
                "distance": "mid",
                "prompt": p2
            })
        return env, events

    n_frames = len(motion)
    std_val = float(motion.std())
    prom = max(std_val, 0.05 * (motion.max() if motion.max() > 0 else 1.0))
    min_dist = max(1, int(0.3 * fps))

    peaks, _ = find_peaks(motion, prominence=prom, distance=min_dist)
    if len(peaks) == 0 and motion.max() > 0.05:
        peaks = np.array([int(np.argmax(motion))])

    # Select up to 5 strongest peaks
    if len(peaks) > 5:
        peak_strengths = motion[peaks]
        top_indices = np.argsort(peak_strengths)[-5:]
        peaks = np.sort(peaks[top_indices])

    events = []
    for idx, p_frame in enumerate(peaks):
        t_center = round(p_frame / fps, 3)
        start_t = max(0.0, round(t_center - 0.3, 3))
        end_t = min(duration, round(t_center + 0.3, 3))
        events.append({
            "id": f"e{idx+1}",
            "event_type": "impact",
            "start_time": start_t,
            "end_time": end_t,
            "collider_material": "wood",
            "surface_material": "concrete",
            "distance": "mid",
            "prompt": "sharp wooden impact on a hard surface"
        })

    if len(events) == 0:
        events.append({
            "id": "e1",
            "event_type": "impact",
            "start_time": 0.0,
            "end_time": min(duration, 1.0),
            "collider_material": "wood",
            "surface_material": "concrete",
            "distance": "mid",
            "prompt": "sharp wooden impact on a hard surface"
        })

    return env, events


def compute_environment_physics(env_raw: Dict[str, Any]) -> Environment:
    name = str(env_raw.get("name", "small_room")).strip().lower()
    if name not in {"small_room", "large_hall", "cave", "open_field"}:
        name = "small_room"

    l_val = float(env_raw.get("estimated_length_m", env_raw.get("L", 4.0)))
    l_val = max(2.0, min(25.0, l_val))

    wall_mat = str(env_raw.get("wall_material", "wood")).strip().lower()
    if wall_mat not in ABSORPTION:
        wall_mat = "wood"

    alpha = ABSORPTION[wall_mat]

    if name == "open_field":
        rt60 = 0.05
    else:
        rt60 = float(np.clip(0.161 * l_val / (6.0 * alpha), 0.05, 4.0))

    return Environment(
        name=name,
        estimated_length_m=round(l_val, 2),
        L=round(l_val, 2),
        wall_material=wall_mat,
        alpha=round(alpha, 4),
        rt60=round(rt60, 3)
    )


def track_motion_and_sync(
    trimmed_video_path: str,
    raw_events: List[Dict[str, Any]],
    fps: float,
    duration: float
) -> Tuple[np.ndarray, List[Event]]:
    """
    Single-pass OpenCV motion tracker and centroid extraction.
    Aligns hits to exact motion peak frames and spatial coordinates.
    """
    cap = cv2.VideoCapture(trimmed_video_path)
    gray_frames: List[np.ndarray] = []
    color_frames: List[np.ndarray] = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        resized = cv2.resize(frame, ANALYSIS_SIZE, interpolation=cv2.INTER_AREA)
        color_frames.append(resized)
        g = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(g, (5, 5), 0)
        gray_frames.append(blurred)
    cap.release()

    n_frames = len(gray_frames)
    if n_frames == 0:
        raise ValueError("Video contains no readable frames.")

    motion = np.zeros(n_frames, dtype=np.float32)
    for i in range(1, n_frames):
        diff = cv2.absdiff(gray_frames[i], gray_frames[i - 1])
        motion[i] = float(diff.mean())

    max_motion = float(motion.max()) if motion.max() > 0 else 1.0

    # 3-frame moving average for peak detection
    kernel = np.ones(3) / 3.0
    motion_smooth = np.convolve(motion, kernel, mode="same")

    events: List[Event] = []

    for raw in raw_events:
        e_id = str(raw.get("id", f"e{len(events)+1}"))
        e_type = str(raw.get("event_type", "impact")).strip().lower()
        if e_type not in {"impact", "continuous"}:
            e_type = "impact"

        t_start = parse_time_val(raw.get("start_time", 0.0))
        t_end = parse_time_val(raw.get("end_time", duration))

        t_start = max(0.0, min(duration, t_start))
        t_end = max(0.0, min(duration, t_end))
        if t_end < t_start:
            t_start, t_end = t_end, t_start

        prompt = str(raw.get("prompt", "foley sound effect")).strip()
        collider = str(raw.get("collider_material", "wood")).strip().lower()
        surface = str(raw.get("surface_material", "concrete")).strip().lower()
        dist = str(raw.get("distance", "mid")).strip().lower()

        # Compute search window frames
        a = max(0, int(math.floor((t_start - 0.5) * fps)))
        b = min(n_frames, int(math.ceil((t_end + 0.5) * fps)) + 1)
        if b - a < 3:
            b = min(n_frames, a + 3)
            if b - a < 3 and a > 0:
                a = max(0, b - 3)

        window_smooth = motion_smooth[a:b]
        window_raw = motion[a:b]

        hits: List[Hit] = []
        envelope: Optional[List[float]] = None

        if e_type == "impact":
            prom = max(float(motion.std()), 1e-3)
            min_p_dist = max(1, int(0.15 * fps))
            peaks, _ = find_peaks(window_smooth, prominence=prom, distance=min_p_dist)

            if len(peaks) == 0:
                peaks = np.array([int(np.argmax(window_smooth))])

            if len(peaks) > 12:
                # Cap at 12 peaks
                top_p = np.argsort(window_raw[peaks])[-12:]
                peaks = np.sort(peaks[top_p])

            for p in peaks:
                frame_idx = a + int(p)
                frame_idx = min(n_frames - 1, max(0, frame_idx))
                t_impact = round(frame_idx / fps, 4)
                strength = float(np.clip(motion[frame_idx] / max_motion, 0.2, 1.0))

                # Centroid
                if frame_idx > 0:
                    f_diff = cv2.absdiff(gray_frames[frame_idx], gray_frames[frame_idx - 1])
                    thresh_val = max(12, int(0.5 * f_diff.max()))
                    mask = (f_diff > thresh_val).astype(np.uint8)
                    m = cv2.moments(mask, binaryImage=True)
                    if m["m00"] > 0:
                        cx = float(m["m10"] / m["m00"] / ANALYSIS_SIZE[0])
                        cy = float(m["m01"] / m["m00"] / ANALYSIS_SIZE[1])
                    else:
                        cx, cy = 0.5, 0.5
                else:
                    cx, cy = 0.5, 0.5

                cx = float(np.clip(cx, 0.0, 1.0))
                cy = float(np.clip(cy, 0.0, 1.0))
                pan = float(np.clip(cx * 2.0 - 1.0, -1.0, 1.0))

                hits.append(Hit(
                    t_impact=t_impact,
                    frame_idx=frame_idx,
                    cx=round(cx, 4),
                    cy=round(cy, 4),
                    pan=round(pan, 4),
                    impact_strength=round(strength, 4)
                ))

            # Primary hit: strongest, ties -> earliest
            hits.sort(key=lambda h: (-h.impact_strength, h.t_impact))
            primary_hit = hits[0]
            # Keep hits sorted by time
            hits.sort(key=lambda h: h.t_impact)

            if 0 <= primary_hit.frame_idx < len(color_frames):
                det_c, det_s, det_p = classify_visual_patch(
                    color_frames[primary_hit.frame_idx],
                    primary_hit.cx,
                    primary_hit.cy,
                    primary_hit.impact_strength
                )
                if collider == "wood" and surface == "concrete" and "wooden impact" in prompt:
                    collider, surface, prompt = det_c, det_s, det_p

            events.append(Event(
                id=e_id,
                event_type=e_type,
                start_time=t_start,
                end_time=t_end,
                collider_material=collider,
                surface_material=surface,
                distance=dist,
                prompt=prompt,
                t_impact=primary_hit.t_impact,
                frame_idx=primary_hit.frame_idx,
                cx=primary_hit.cx,
                cy=primary_hit.cy,
                pan=primary_hit.pan,
                impact_strength=primary_hit.impact_strength,
                hits=hits,
                envelope=None
            ))

        else:
            # Continuous event
            max_idx = a + int(np.argmax(window_raw))
            max_idx = min(n_frames - 1, max(0, max_idx))

            if max_idx > 0:
                f_diff = cv2.absdiff(gray_frames[max_idx], gray_frames[max_idx - 1])
                thresh_val = max(12, int(0.5 * f_diff.max()))
                mask = (f_diff > thresh_val).astype(np.uint8)
                m = cv2.moments(mask, binaryImage=True)
                if m["m00"] > 0:
                    cx = float(m["m10"] / m["m00"] / ANALYSIS_SIZE[0])
                    cy = float(m["m01"] / m["m00"] / ANALYSIS_SIZE[1])
                else:
                    cx, cy = 0.5, 0.5
            else:
                cx, cy = 0.5, 0.5

            cx = float(np.clip(cx, 0.0, 1.0))
            cy = float(np.clip(cy, 0.0, 1.0))
            pan = float(np.clip(cx * 2.0 - 1.0, -1.0, 1.0))

            # 100-point normalized motion curve
            raw_curve = motion[a:b] / max_motion
            x_old = np.linspace(0, 1, len(raw_curve))
            x_new = np.linspace(0, 1, 100)
            env_100 = np.interp(x_new, x_old, raw_curve)
            envelope = [round(float(v), 4) for v in env_100]

            strength = float(np.clip(np.percentile(env_100, 90), 0.2, 1.0))

            single_hit = Hit(
                t_impact=round(max_idx / fps, 4),
                frame_idx=max_idx,
                cx=round(cx, 4),
                cy=round(cy, 4),
                pan=round(pan, 4),
                impact_strength=round(strength, 4)
            )

            if 0 <= single_hit.frame_idx < len(color_frames):
                det_c, det_s, det_p = classify_visual_patch(
                    color_frames[single_hit.frame_idx],
                    single_hit.cx,
                    single_hit.cy,
                    single_hit.impact_strength
                )
                if collider == "wood" and surface == "concrete" and "wooden impact" in prompt:
                    collider, surface, prompt = det_c, det_s, f"sliding {det_c} friction across {det_s}"

            events.append(Event(
                id=e_id,
                event_type=e_type,
                start_time=t_start,
                end_time=t_end,
                collider_material=collider,
                surface_material=surface,
                distance=dist,
                prompt=prompt,
                t_impact=single_hit.t_impact,
                frame_idx=single_hit.frame_idx,
                cx=single_hit.cx,
                cy=single_hit.cy,
                pan=single_hit.pan,
                impact_strength=round(strength, 4),
                hits=[single_hit],
                envelope=envelope
            ))

    return motion, events