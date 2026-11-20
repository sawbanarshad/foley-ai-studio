import os
import hashlib
import logging
from pathlib import Path
from typing import Tuple
import soundfile as sf
import numpy as np

from config import SR, DRY_PEAK
from schemas import Event
from services.audio_engine import AudioEngine

logger = logging.getLogger("audio_generator")


def derive_seed(video_hash: str, event_id: str, hit_index: int = 0, prompt: str = "") -> int:
    seed_str = f"{video_hash}_{event_id}_{hit_index}_{prompt.strip().lower()}" if prompt else f"{video_hash}_{event_id}_{hit_index}"
    h = hashlib.sha256(seed_str.encode("utf-8")).hexdigest()
    return int(h[:8], 16)


def get_engine_choice() -> str:
    from config import ELEVENLABS_API_KEY, FREESOUND_API_KEY
    if os.getenv("ELEVENLABS_API_KEY", ELEVENLABS_API_KEY).strip():
        return "elevenlabs"
    elif os.getenv("FREESOUND_API_KEY", FREESOUND_API_KEY).strip():
        return "freesound"
    return "none"


def generate_audio_clip(event: Event, video_hash: str, hit_index: int = 0, duration: float = 2.0) -> Tuple[np.ndarray, str]:
    """
    Generates or fetches real studio foley sound clip using 2-tier real audio engine
    (ElevenLabs or Freesound).
    Zero synthetic click / tap / beep fallbacks.
    """
    temp_dir = Path(__file__).resolve().parent / "cache" / video_hash / "clips"
    temp_dir.mkdir(parents=True, exist_ok=True)
    temp_audio_file = temp_dir / f"{event.id}_{hit_index}_real.mp3"

    # Words for query
    prompt = event.prompt or "acoustic impact sound"
    words = [w for w in prompt.lower().split() if len(w) > 2 and w not in {"with", "from", "that", "this", "sound"}]
    fs_query = " ".join(words[:3]) or prompt

    output_path, engine_used = AudioEngine.generate_audio(
        prompt=prompt,
        freesound_query=fs_query,
        video_duration=max(1.0, float(duration)),
        output_path=str(temp_audio_file)
    )

    # Read back audio using soundfile
    audio_data, file_sr = sf.read(output_path, dtype="float32")
    if audio_data.ndim > 1:
        audio_data = np.mean(audio_data, axis=1)

    # Resample if needed
    if file_sr != SR and len(audio_data) > 0:
        from scipy import signal
        num_samples = int(len(audio_data) * SR / file_sr)
        audio_data = signal.resample(audio_data, num_samples).astype(np.float32)

    max_val = np.abs(audio_data).max()
    if max_val > 0:
        audio_data = (audio_data / max_val) * DRY_PEAK

    return audio_data.astype(np.float32), engine_used