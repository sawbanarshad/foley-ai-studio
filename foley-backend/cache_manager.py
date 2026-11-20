import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
import numpy as np

try:
    import soundfile as sf
except ImportError:
    sf = None

try:
    import cv2
except ImportError:
    cv2 = None

from config import (
    UPLOADS_DIR,
    CACHE_DIR,
    MAX_UPLOAD_MB,
    MAX_VIDEO_SECONDS,
    SR
)


def get_ffmpeg_binary() -> str:
    path = shutil.which("ffmpeg")
    if path:
        return path
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def compute_prompt_hash(prompt: str, event_type: str) -> str:
    content = f"{prompt.strip()}_{event_type.strip()}".encode("utf-8")
    return hashlib.sha256(content).hexdigest()[:10]


class CacheManager:
    @staticmethod
    def save_and_preprocess_upload(session_id: str, file_obj, filename: str) -> Tuple[str, str, Dict[str, Any]]:
        """
        Stream upload, compute sha256, validate size and readability, and create trimmed.mp4.
        Returns (video_hash, trimmed_path, metadata)
        """
        session_upload_dir = UPLOADS_DIR / session_id
        session_upload_dir.mkdir(parents=True, exist_ok=True)

        ext = Path(filename).suffix or ".mp4"
        orig_path = session_upload_dir / f"original{ext}"

        hasher = hashlib.sha256()
        total_bytes = 0
        max_bytes = MAX_UPLOAD_MB * 1024 * 1024

        with open(orig_path, "wb") as f_out:
            while True:
                chunk = file_obj.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    if orig_path.exists():
                        orig_path.unlink()
                    raise ValueError(f"File exceeds maximum upload size of {MAX_UPLOAD_MB}MB")
                hasher.update(chunk)
                f_out.write(chunk)

        video_hash = hasher.hexdigest()

        # Validate with OpenCV
        import cv2
        cap = cv2.VideoCapture(str(orig_path))
        if not cap.isOpened():
            if orig_path.exists():
                orig_path.unlink()
            raise ValueError("Uploaded file could not be opened as a valid video.")

        raw_fps = cap.get(cv2.CAP_PROP_FPS)
        cap.release()

        fps = 30.0
        if raw_fps and not np.isnan(raw_fps) and raw_fps > 0:
            fps = 30.0 if raw_fps > 60 else float(raw_fps)

        # Transcode & trim to max 10.0s constant frame rate
        trimmed_path = session_upload_dir / "trimmed.mp4"
        ffmpeg_bin = get_ffmpeg_binary()

        cmd = [
            ffmpeg_bin, "-y",
            "-i", str(orig_path),
            "-t", str(MAX_VIDEO_SECONDS),
            "-an",
            "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-r", str(fps),
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(trimmed_path)
        ]

        ret = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if ret.returncode != 0 or not trimmed_path.exists():
            # Fallback if x264 fails
            cmd_fallback = [
                ffmpeg_bin, "-y",
                "-i", str(orig_path),
                "-t", str(MAX_VIDEO_SECONDS),
                "-an",
                "-r", str(fps),
                str(trimmed_path)
            ]
            ret2 = subprocess.run(cmd_fallback, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if ret2.returncode != 0 or not trimmed_path.exists():
                raise RuntimeError(f"FFmpeg trimming failed: {ret.stderr.decode('utf-8', errors='ignore')}")

        # Read actual properties of trimmed file
        cap2 = cv2.VideoCapture(str(trimmed_path))
        width = int(cap2.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap2.get(cv2.CAP_PROP_FRAME_HEIGHT))
        n_frames = 0
        while True:
            ret_frame, _ = cap2.read()
            if not ret_frame:
                break
            n_frames += 1
        cap2.release()

        if n_frames == 0:
            raise ValueError("Trimmed video contains 0 frames.")

        duration = round(n_frames / fps, 3)

        meta = {
            "fps": fps,
            "duration": duration,
            "width": width,
            "height": height,
            "n_frames": n_frames,
            "trimmed_path": str(trimmed_path)
        }
        return video_hash, str(trimmed_path), meta

    @staticmethod
    def get_gemini(video_hash: str) -> Optional[Dict[str, Any]]:
        path = CACHE_DIR / video_hash / "gemini.json"
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return None
        return None

    @staticmethod
    def put_gemini(video_hash: str, data: Dict[str, Any]) -> None:
        cache_dir = CACHE_DIR / video_hash
        cache_dir.mkdir(parents=True, exist_ok=True)
        path = cache_dir / "gemini.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    @staticmethod
    def get_clip(video_hash: str, event_id: str, prompt: str, event_type: str, force_regen: bool = False) -> Optional[Tuple[np.ndarray, str]]:
        if force_regen:
            return None
        p_hash = compute_prompt_hash(prompt, event_type)
        clip_wav = CACHE_DIR / video_hash / "clips" / f"{event_id}_{p_hash}.wav"
        clip_meta = CACHE_DIR / video_hash / "clips" / f"{event_id}_{p_hash}.json"

        if clip_wav.exists() and clip_meta.exists():
            try:
                import soundfile as sf
                audio, sr = sf.read(str(clip_wav), dtype="float32")
                with open(clip_meta, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                return audio, meta.get("engine", "procedural")
            except Exception:
                return None
        return None

    @staticmethod
    def put_clip(video_hash: str, event_id: str, prompt: str, event_type: str, audio: np.ndarray, engine: str) -> None:
        p_hash = compute_prompt_hash(prompt, event_type)
        clips_dir = CACHE_DIR / video_hash / "clips"
        clips_dir.mkdir(parents=True, exist_ok=True)

        clip_wav = clips_dir / f"{event_id}_{p_hash}.wav"
        clip_meta = clips_dir / f"{event_id}_{p_hash}.json"

        from scipy.io import wavfile
        wavfile.write(str(clip_wav), SR, audio)
        with open(clip_meta, "w", encoding="utf-8") as f:
            json.dump({"engine": engine, "sr": SR}, f, indent=2)

    @staticmethod
    def get_variant(video_hash: str, event_id: str, hit_index: int) -> Optional[np.ndarray]:
        var_path = CACHE_DIR / video_hash / "variants" / f"{event_id}_{hit_index}.npy"
        if var_path.exists():
            try:
                return np.load(str(var_path))
            except Exception:
                return None
        return None

    @staticmethod
    def put_variant(video_hash: str, event_id: str, hit_index: int, audio: np.ndarray) -> None:
        var_dir = CACHE_DIR / video_hash / "variants"
        var_dir.mkdir(parents=True, exist_ok=True)
        var_path = var_dir / f"{event_id}_{hit_index}.npy"
        np.save(str(var_path), audio)