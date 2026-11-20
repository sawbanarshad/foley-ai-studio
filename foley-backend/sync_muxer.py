import os
import subprocess
from pathlib import Path
from typing import List, Tuple, Dict, Any
import numpy as np
import soundfile as sf
from scipy import signal

from config import SR, OUTPUTS_DIR
from schemas import Event, Hit, PeakInfo
from cache_manager import get_ffmpeg_binary


def compute_binned_waveform(track_stereo: np.ndarray, n_bins: int = 1000) -> List[float]:
    if len(track_stereo) == 0:
        return [0.0] * n_bins
    mono = np.mean(track_stereo, axis=1)
    abs_mono = np.abs(mono)
    total_len = len(abs_mono)
    bin_size = max(1, total_len // n_bins)
    
    waveform = []
    for i in range(n_bins):
        start = i * bin_size
        end = min(total_len, (i + 1) * bin_size)
        if start < total_len:
            val = float(np.max(abs_mono[start:end]))
        else:
            val = 0.0
        waveform.append(round(val, 4))
    
    max_val = max(waveform) if len(waveform) > 0 and max(waveform) > 0 else 1.0
    if max_val > 0:
        waveform = [round(min(1.0, v / max_val), 4) for v in waveform]
    return waveform


def mux_video_audio(
    video_path: str,
    audio_wav_path: str,
    output_mp4_path: str
) -> None:
    ffmpeg_bin = get_ffmpeg_binary()

    cmd_copy = [
        ffmpeg_bin, "-y",
        "-i", str(video_path),
        "-i", str(audio_wav_path),
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        "-shortest",
        str(output_mp4_path)
    ]
    ret = subprocess.run(cmd_copy, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if ret.returncode != 0 or not Path(output_mp4_path).exists():
        # Fallback to ultrafast re-encode
        cmd_reencode = [
            ffmpeg_bin, "-y",
            "-i", str(video_path),
            "-i", str(audio_wav_path),
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            "-shortest",
            str(output_mp4_path)
        ]
        ret2 = subprocess.run(cmd_reencode, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if ret2.returncode != 0 or not Path(output_mp4_path).exists():
            raise RuntimeError(f"FFmpeg muxing failed: {ret2.stderr.decode('utf-8', errors='ignore')}")


def manage_version_cleanup(session_out_dir: Path, current_version: int, max_keep: int = 3):
    """Deletes versioned output mp4s older than current_version - max_keep."""
    for p in session_out_dir.glob("synced_v*.mp4"):
        name = p.stem  # synced_v1
        try:
            v_num = int(name.replace("synced_v", ""))
            if v_num < current_version - (max_keep - 1):
                p.unlink(missing_ok=True)
        except Exception:
            pass


def assemble_synced_track(
    rendered_clips: List[Tuple[Event, Hit, int, np.ndarray, int]],
    duration: float,
    fps: float,
    sync_nudge_frames: int = 0
) -> Tuple[np.ndarray, List[PeakInfo]]:
    """
    Sample-accurately mixes rendered stereo clips onto the master timeline.
    Returns (master_track_stereo, list_of_peaks).
    """
    total_samples = int(round(duration * SR))
    track = np.zeros((total_samples, 2), dtype=np.float32)

    if total_samples > 0:
        rng_bed = np.random.default_rng(int(round(duration * 1000)))
        bed_noise = rng_bed.standard_normal((total_samples, 2)).astype(np.float32)
        sos_bed = signal.butter(2, [120, 1600], btype="bandpass", fs=SR, output="sos")
        b_l = signal.sosfilt(sos_bed, bed_noise[:, 0])
        b_r = signal.sosfilt(sos_bed, bed_noise[:, 1])
        t_bed = np.arange(total_samples) / SR
        lfo_bed = 0.65 + 0.35 * np.sin(2 * np.pi * 0.25 * t_bed)
        ambient_bed = np.column_stack([b_l * lfo_bed, b_r * lfo_bed])
        m_b = np.abs(ambient_bed).max()
        if m_b > 0:
            track += (ambient_bed / m_b) * 0.015

    peaks: List[PeakInfo] = []

    for event, hit, hit_idx, clip, peak_idx in rendered_clips:
        if event.event_type == "impact":
            target_time = hit.t_impact + (sync_nudge_frames / fps)
            target_time = max(0.0, min(duration, target_time))
            start_sample = int(round(target_time * SR)) - peak_idx
        else:
            target_time = event.start_time + (sync_nudge_frames / fps)
            target_time = max(0.0, min(duration, target_time))
            start_sample = int(round(target_time * SR))

        clip_len = len(clip)
        src_start = 0
        src_end = clip_len
        dst_start = start_sample
        dst_end = start_sample + clip_len

        # Bounds handling
        if dst_start < 0:
            src_start = -dst_start
            dst_start = 0
        if dst_end > total_samples:
            src_end = src_start + (total_samples - dst_start)
            dst_end = total_samples

        if src_start < src_end and dst_start < dst_end:
            track[dst_start:dst_end] += clip[src_start:src_end]

        if event.event_type == "impact":
            peak_amp = float(np.max(np.abs(clip))) if len(clip) > 0 else 0.5
            peaks.append(PeakInfo(
                event_id=event.id,
                hit_index=hit_idx,
                time=round(target_time, 4),
                frame_idx=int(round(target_time * fps)),
                amplitude=round(peak_amp, 4)
            ))

    # Master soft limiter
    track = 0.95 * np.tanh(track / 0.95)
    return track.astype(np.float32), peaks


def assemble_naive_track(
    dry_clips: List[Tuple[Event, np.ndarray]],
    duration: float
) -> np.ndarray:
    """Creates baseline naive track (stock audio dropped at start_time, no sync, no DSP)."""
    total_samples = int(round(duration * SR))
    track = np.zeros((total_samples, 2), dtype=np.float32)

    for event, raw_clip in dry_clips:
        start_sample = int(round(event.start_time * SR))
        clip_mono = raw_clip
        clip_stereo = np.column_stack([clip_mono, clip_mono])

        clip_len = len(clip_stereo)
        src_start = 0
        src_end = clip_len
        dst_start = start_sample
        dst_end = start_sample + clip_len

        if dst_start < 0:
            src_start = -dst_start
            dst_start = 0
        if dst_end > total_samples:
            src_end = src_start + (total_samples - dst_start)
            dst_end = total_samples

        if src_start < src_end and dst_start < dst_end:
            track[dst_start:dst_end] += clip_stereo[src_start:src_end]

    track = 0.95 * np.tanh(track / 0.95)
    return track.astype(np.float32)