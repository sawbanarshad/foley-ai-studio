import math
from typing import Tuple, Dict, Any, Optional
import numpy as np
from scipy import signal
import librosa

from config import (
    SR,
    MATERIAL_EQ,
    DISTANCE,
    ABSORPTION
)
from schemas import Event, Hit, Environment
from audio_generator import derive_seed

_IR_CACHE: Dict[float, np.ndarray] = {}


def clamp_freq(freq: float) -> float:
    return float(np.clip(freq, 20.0, 0.45 * SR))


def rbj_biquad_sos(filter_type: str, f0: float, gain_db: float = 0.0, q: float = 0.707) -> np.ndarray:
    """Build single Second-Order Section (SOS) using Robert Bristow-Johnson's Audio EQ Cookbook."""
    f0 = clamp_freq(f0)
    w0 = 2.0 * math.pi * f0 / SR
    cos_w0 = math.cos(w0)
    sin_w0 = math.sin(w0)
    q = max(0.1, q)
    alpha = sin_w0 / (2.0 * q)
    A = 10.0 ** (gain_db / 40.0)

    if filter_type == "lowpass":
        b0 = (1.0 - cos_w0) / 2.0
        b1 = 1.0 - cos_w0
        b2 = (1.0 - cos_w0) / 2.0
        a0 = 1.0 + alpha
        a1 = -2.0 * cos_w0
        a2 = 1.0 - alpha

    elif filter_type == "highpass":
        b0 = (1.0 + cos_w0) / 2.0
        b1 = -(1.0 + cos_w0)
        b2 = (1.0 + cos_w0) / 2.0
        a0 = 1.0 + alpha
        a1 = -2.0 * cos_w0
        a2 = 1.0 - alpha

    elif filter_type == "bandpass":
        b0 = alpha
        b1 = 0.0
        b2 = -alpha
        a0 = 1.0 + alpha
        a1 = -2.0 * cos_w0
        a2 = 1.0 - alpha

    elif filter_type == "peak":
        b0 = 1.0 + alpha * A
        b1 = -2.0 * cos_w0
        b2 = 1.0 - alpha * A
        a0 = 1.0 + alpha / A
        a1 = -2.0 * cos_w0
        a2 = 1.0 - alpha / A

    elif filter_type == "highshelf":
        sqrtA_alpha = math.sqrt(A) * alpha
        b0 = A * ((A + 1.0) + (A - 1.0) * cos_w0 + 2.0 * sqrtA_alpha)
        b1 = -2.0 * A * ((A - 1.0) + (A + 1.0) * cos_w0)
        b2 = A * ((A + 1.0) + (A - 1.0) * cos_w0 - 2.0 * sqrtA_alpha)
        a0 = (A + 1.0) - (A - 1.0) * cos_w0 + 2.0 * sqrtA_alpha
        a1 = 2.0 * ((A - 1.0) - (A + 1.0) * cos_w0)
        a2 = (A + 1.0) - (A - 1.0) * cos_w0 - 2.0 * sqrtA_alpha

    elif filter_type == "lowshelf":
        sqrtA_alpha = math.sqrt(A) * alpha
        b0 = A * ((A + 1.0) - (A - 1.0) * cos_w0 + 2.0 * sqrtA_alpha)
        b1 = 2.0 * A * ((A - 1.0) - (A + 1.0) * cos_w0)
        b2 = A * ((A + 1.0) - (A - 1.0) * cos_w0 - 2.0 * sqrtA_alpha)
        a0 = (A + 1.0) + (A - 1.0) * cos_w0 + 2.0 * sqrtA_alpha
        a1 = -2.0 * ((A - 1.0) + (A + 1.0) * cos_w0)
        a2 = (A + 1.0) + (A - 1.0) * cos_w0 - 2.0 * sqrtA_alpha

    else:
        # Passthrough
        b0, b1, b2, a0, a1, a2 = 1.0, 0.0, 0.0, 1.0, 0.0, 0.0

    return np.array([[b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0]], dtype=np.float64)


def apply_material_chain(audio: np.ndarray, material: str) -> np.ndarray:
    presets = MATERIAL_EQ.get(material, [])
    out = audio.copy().astype(np.float64)

    for stage in presets:
        stype = stage.get("type")
        if stype == "tanh_compress":
            k = stage.get("k", 2.0)
            orig_p = np.abs(out).max()
            out = np.tanh(k * out) / k
            new_p = np.abs(out).max()
            if new_p > 0:
                out = out * (orig_p / new_p)
        else:
            freq = stage.get("freq", 1000.0)
            gain_db = stage.get("gain_db", 0.0)
            q = stage.get("q", 0.707)
            sos = rbj_biquad_sos(stype, freq, gain_db, q)
            out = signal.sosfilt(sos, out)
    return out.astype(np.float32)


def compute_peak_attack(mono_audio: np.ndarray) -> int:
    """Finds exact transient attack index before reverb application."""
    search_len = min(len(mono_audio), SR)
    if search_len <= 32:
        return 0
    smooth = np.convolve(np.abs(mono_audio[:search_len]), np.ones(32) / 32.0, mode="same")
    return int(np.argmax(smooth))


def get_sabine_ir(rt60: float) -> np.ndarray:
    rt_key = round(float(rt60), 3)
    if rt_key in _IR_CACHE:
        return _IR_CACHE[rt_key]

    n_samples = max(int(SR * rt_key), 32)
    t = np.arange(n_samples) / SR
    # Fixed deterministic RNG for IR
    rng = np.random.default_rng(12345)
    noise = rng.standard_normal(n_samples)
    envelope = 10.0 ** (-3.0 * t / rt_key)
    ir = noise * envelope
    # Normalize IR energy
    ir = ir / (np.sqrt(np.mean(ir**2)) + 1e-9) * 0.1
    _IR_CACHE[rt_key] = ir.astype(np.float32)
    return _IR_CACHE[rt_key]


def render_hit_dsp(
    raw_dry_clip: np.ndarray,
    event: Event,
    hit: Hit,
    hit_index: int,
    video_hash: str,
    environment: Environment,
    intensity_multiplier: float = 1.0,
    cached_variant: Optional[np.ndarray] = None
) -> Tuple[np.ndarray, int]:
    """
    Executes the 9-stage deterministic DSP pipeline on a single hit.
    Returns (stereo_clip, peak_idx).
    """
    # 1. Prepare
    raw_peak = compute_peak_attack(raw_dry_clip)
    clip_len = len(raw_dry_clip)
    trim_start = max(0, int(raw_peak - 0.1 * SR))
    trim_end = min(clip_len, int(raw_peak + 1.2 * SR))
    clip = raw_dry_clip[trim_start:trim_end].copy()

    # 60 ms fade out
    fade_len = int(0.06 * SR)
    if len(clip) > fade_len:
        clip[-fade_len:] *= np.linspace(1.0, 0.0, fade_len)

    # 2. Humanizer
    if event.event_type == "impact":
        if hit_index == 0:
            humanized = clip
        else:
            if cached_variant is not None:
                humanized = cached_variant
            else:
                seed = derive_seed(video_hash, event.id, hit_index, event.prompt)
                rng = np.random.default_rng(seed)
                n_steps = float(rng.uniform(-1.0, 1.0))
                shifted = librosa.effects.pitch_shift(clip, sr=SR, n_steps=n_steps)
                gain = float(rng.uniform(0.8, 1.0))
                humanized = shifted * gain
    else:
        humanized = clip

    # 3. Two-body material fingerprint
    in_peak = np.abs(humanized).max()
    if event.collider_material == event.surface_material:
        mat_out = apply_material_chain(humanized, event.collider_material)
    else:
        c_out = apply_material_chain(humanized, event.collider_material)
        s_out = apply_material_chain(humanized, event.surface_material)
        mat_out = 0.6 * c_out + 0.4 * s_out

    m_peak = np.abs(mat_out).max()
    if m_peak > 0 and in_peak > 0:
        mat_out = mat_out * (in_peak / m_peak)

    # 4. Impact Strength
    eff_str = float(np.clip(hit.impact_strength * intensity_multiplier, 0.1, 2.0))
    lp_cutoff = clamp_freq(7000.0 + 11000.0 * eff_str)
    sos_lp = rbj_biquad_sos("lowpass", lp_cutoff)
    str_out = signal.sosfilt(sos_lp, mat_out)
    gain_db = -6.0 + 6.0 * eff_str
    str_out = str_out * (10.0 ** (gain_db / 20.0))

    # 5. Continuous events envelope
    if event.event_type == "continuous":
        dur = max(0.2, event.end_time - event.start_time)
        target_samples = int(dur * SR)
        # Tile with 80 ms crossfades
        xfade_len = int(0.08 * SR)
        if len(str_out) > xfade_len:
            tiled = []
            curr_len = 0
            while curr_len < target_samples:
                tiled.append(str_out)
                curr_len += len(str_out)
            tiled_audio = np.concatenate(tiled)[:target_samples]
        else:
            tiled_audio = np.tile(str_out, int(math.ceil(target_samples / len(str_out))))[:target_samples]

        # Apply smoothed 100-pt motion envelope
        if event.envelope and len(event.envelope) == 100:
            env_arr = np.array(event.envelope)
            x_old = np.linspace(0, 1, 100)
            x_new = np.linspace(0, 1, target_samples)
            interp_env = np.interp(x_new, x_old, env_arr)
            # Smooth 50 ms
            smooth_win = int(0.05 * SR)
            if smooth_win > 1:
                interp_env = np.convolve(interp_env, np.ones(smooth_win) / smooth_win, mode="same")
            interp_env = np.maximum(interp_env, 0.05)
            tiled_audio = tiled_audio * interp_env

        mono_pre_reverb = tiled_audio.astype(np.float32)
        peak_idx = 0
    else:
        mono_pre_reverb = str_out.astype(np.float32)
        # 7. Record peak_idx PRE-reverb
        peak_idx = compute_peak_attack(mono_pre_reverb)

    # 6. Distance filtering
    dist_cfg = DISTANCE.get(event.distance, DISTANCE["mid"])
    d_gain = 10.0 ** (dist_cfg["gain_db"] / 20.0)
    mono_dist = mono_pre_reverb * d_gain
    if dist_cfg["lowpass"] is not None:
        sos_dist = rbj_biquad_sos("lowpass", dist_cfg["lowpass"])
        mono_dist = signal.sosfilt(sos_dist, mono_dist).astype(np.float32)

    # 8. Sabine Reverb
    if environment.name == "open_field":
        rt60 = 0.05
        mix = min(dist_cfg["mix"], 0.05)
    else:
        alpha = ABSORPTION.get(environment.wall_material, 0.10)
        rt60 = float(np.clip(0.161 * environment.L / (6.0 * alpha), 0.05, 4.0))
        mix = dist_cfg["mix"]

    ir = get_sabine_ir(rt60)
    wet = signal.fftconvolve(mono_dist, ir)
    d_peak = np.abs(mono_dist).max()
    w_peak = np.abs(wet).max()
    if w_peak > 0 and d_peak > 0:
        wet = wet * (d_peak / w_peak)

    # Pad dry to match wet length
    dry_padded = np.zeros(len(wet), dtype=np.float32)
    dry_padded[:len(mono_dist)] = mono_dist
    reverb_mono = (1.0 - mix) * dry_padded + mix * wet

    # 9. Stereo Equal-Power Pan
    pan = float(np.clip(hit.pan, -1.0, 1.0))
    pan_rad = (pan + 1.0) * (math.pi / 4.0)  # 0 to pi/2
    left_gain = math.cos(pan_rad)
    right_gain = math.sin(pan_rad)

    stereo = np.column_stack([
        reverb_mono * left_gain,
        reverb_mono * right_gain
    ]).astype(np.float32)

    return stereo, peak_idx