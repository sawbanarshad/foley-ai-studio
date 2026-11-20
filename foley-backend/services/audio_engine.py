import os
import sys
import subprocess
from pathlib import Path
from typing import Tuple, Optional, List
import requests

# Add parent directory to path to import config and cache_manager
parent_dir = Path(__file__).resolve().parent.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from config import ELEVENLABS_API_KEY, FREESOUND_API_KEY
from cache_manager import get_ffmpeg_binary


class AudioEngine:
    """
    2-Tier Foolproof Real Audio Engine:
    Tier 1 (Primary): ElevenLabs AI Sound Effects API
    Tier 2 (Backup): Freesound API Real-World Audio Search & Download
    Zero synthetic click / tap / beep fallbacks.
    """

    @staticmethod
    def get_ffmpeg() -> str:
        return get_ffmpeg_binary()

    @classmethod
    def generate_audio(
        cls,
        prompt: str,
        freesound_query: str,
        video_duration: float,
        output_path: str
    ) -> Tuple[str, str]:
        """
        Generates real acoustic audio for a video clip.
        Returns: (output_path, engine_name) where engine_name is 'elevenlabs' or 'freesound'.
        Raises RuntimeError with exact HTTP status and error details if both fail.
        """
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        ffmpeg_bin = cls.get_ffmpeg()

        elevenlabs_error: Optional[str] = None
        freesound_error: Optional[str] = None

        # -------------------------------------------------------------
        # TIER 1: ElevenLabs AI Sound Effects API (Primary)
        # -------------------------------------------------------------
        api_key_eleven = os.getenv("ELEVENLABS_API_KEY", ELEVENLABS_API_KEY).strip()
        if api_key_eleven:
            try:
                print(f"[AudioEngine Tier 1] Calling ElevenLabs Sound Effects API for prompt: '{prompt}'...")
                url = "https://api.elevenlabs.io/v1/sound-generation"
                headers = {
                    "xi-api-key": api_key_eleven,
                    "Content-Type": "application/json"
                }
                dur = max(0.5, min(float(video_duration), 22.0))
                payload = {
                    "text": prompt,
                    "duration_seconds": dur,
                    "prompt_influence": 0.5
                }
                resp = requests.post(url, json=payload, headers=headers, timeout=60)
                if resp.status_code == 200:
                    raw_mp3_path = output_file.parent / f"{output_file.stem}_raw_eleven.mp3"
                    raw_mp3_path.write_bytes(resp.content)

                    # If video is longer than 22s, seamlessly loop audio to exact video_duration
                    if video_duration > 22.0:
                        cmd = [
                            ffmpeg_bin, "-y",
                            "-stream_loop", "-1",
                            "-i", str(raw_mp3_path),
                            "-t", str(video_duration),
                            "-c:a", "libmp3lame",
                            "-b:a", "192k",
                            str(output_file)
                        ]
                        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                        raw_mp3_path.unlink(missing_ok=True)
                    else:
                        # Normalize to final output
                        cmd = [
                            ffmpeg_bin, "-y",
                            "-i", str(raw_mp3_path),
                            "-t", str(video_duration),
                            "-c:a", "libmp3lame",
                            "-b:a", "192k",
                            str(output_file)
                        ]
                        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                        raw_mp3_path.unlink(missing_ok=True)

                    print(f"[AudioEngine Tier 1 Success] ElevenLabs audio saved to {output_file}")
                    return str(output_file), "elevenlabs"
                else:
                    elevenlabs_error = f"HTTP {resp.status_code}: {resp.text}"
                    print(f"[ElevenLabs API Error] Status Code: {resp.status_code}, Response: {resp.text}")
            except Exception as e:
                elevenlabs_error = f"{type(e).__name__}: {str(e)}"
                print(f"[ElevenLabs Exception] {elevenlabs_error}")
        else:
            elevenlabs_error = "ELEVENLABS_API_KEY is not configured in .env"
            print(f"[AudioEngine] {elevenlabs_error}, trying Tier 2 (Freesound)...")

        # -------------------------------------------------------------
        # TIER 2: Freesound API (Automatic Real-Audio Backup)
        # -------------------------------------------------------------
        api_key_freesound = os.getenv("FREESOUND_API_KEY", FREESOUND_API_KEY).strip()
        if api_key_freesound:
            try:
                print(f"[AudioEngine Tier 2] Calling Freesound API for query: '{freesound_query}'...")
                query_encoded = requests.utils.quote(freesound_query)
                search_url = (
                    f"https://freesound.org/apiv2/search/text/"
                    f"?query={query_encoded}"
                    f"&fields=id,name,previews,duration"
                    f"&filter=duration:[5%20TO%2060]"
                    f"&token={api_key_freesound}"
                )
                resp = requests.get(search_url, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get("results", [])
                    if not results:
                        # Fallback search without duration filter
                        broad_url = (
                            f"https://freesound.org/apiv2/search/text/"
                            f"?query={query_encoded}"
                            f"&fields=id,name,previews,duration"
                            f"&token={api_key_freesound}"
                        )
                        r2 = requests.get(broad_url, timeout=30)
                        if r2.status_code == 200:
                            results = r2.json().get("results", [])

                    if results:
                        top = results[0]
                        preview_url = (
                            top.get("previews", {}).get("preview-hq-mp3")
                            or top.get("previews", {}).get("preview-lq-mp3")
                        )
                        if not preview_url:
                            raise RuntimeError(f"Freesound result #{top.get('id')} has no preview MP3.")

                        print(f"[AudioEngine Tier 2] Downloading Freesound sound '{top.get('name')}' ({preview_url})...")
                        audio_resp = requests.get(preview_url, timeout=60)
                        if audio_resp.status_code != 200:
                            raise RuntimeError(f"Failed to download Freesound preview: HTTP {audio_resp.status_code}")

                        raw_fs_path = output_file.parent / f"{output_file.stem}_raw_freesound.mp3"
                        raw_fs_path.write_bytes(audio_resp.content)

                        fs_dur = float(top.get("duration", 10.0))
                        if fs_dur < video_duration:
                            cmd = [
                                ffmpeg_bin, "-y",
                                "-stream_loop", "-1",
                                "-i", str(raw_fs_path),
                                "-t", str(video_duration),
                                "-c:a", "libmp3lame",
                                "-b:a", "192k",
                                str(output_file)
                            ]
                        else:
                            cmd = [
                                ffmpeg_bin, "-y",
                                "-i", str(raw_fs_path),
                                "-t", str(video_duration),
                                "-c:a", "libmp3lame",
                                "-b:a", "192k",
                                str(output_file)
                            ]
                        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                        raw_fs_path.unlink(missing_ok=True)

                        print(f"[AudioEngine Tier 2 Success] Freesound audio saved to {output_file}")
                        return str(output_file), "freesound"
                    else:
                        freesound_error = f"No sounds found on Freesound for query '{freesound_query}'"
                        print(f"[Freesound Error] {freesound_error}")
                else:
                    freesound_error = f"HTTP {resp.status_code}: {resp.text}"
                    print(f"[Freesound API Error] Status Code: {resp.status_code}, Response: {resp.text}")
            except Exception as e:
                freesound_error = f"{type(e).__name__}: {str(e)}"
                print(f"[Freesound Exception] {freesound_error}")
        else:
            freesound_error = "FREESOUND_API_KEY is not configured in .env"
            print(f"[AudioEngine] {freesound_error}")

        # -------------------------------------------------------------
        # BOTH ENGINES FAILED - ZERO FAKE / SYNTHETIC FALLBACKS
        # -------------------------------------------------------------
        error_msg = (
            f"Real Audio Engine Error: Both Tier 1 (ElevenLabs) and Tier 2 (Freesound) failed.\n"
            f"Tier 1 [ElevenLabs]: {elevenlabs_error}\n"
            f"Tier 2 [Freesound]: {freesound_error}\n"
            f"Please check your ELEVENLABS_API_KEY and FREESOUND_API_KEY in .env."
        )
        print(f"[CRITICAL AUDIO ENGINE FAILURE]\n{error_msg}")
        raise RuntimeError(error_msg)

    @classmethod
    def generate_layer_audio(
        cls,
        user_prompt: str,
        duration: float,
        output_path: str
    ) -> Tuple[str, str]:
        """Generates a new real audio clip for user prompt layering."""
        # Simple keywords for freesound query fallback
        words = [w for w in user_prompt.lower().split() if len(w) > 3 and w not in {"add", "sound", "with", "from", "very"}]
        fs_query = " ".join(words[:3]) or user_prompt
        return cls.generate_audio(
            prompt=user_prompt,
            freesound_query=fs_query,
            video_duration=duration,
            output_path=output_path
        )

    @classmethod
    def mix_audio_layers(
        cls,
        base_audio_path: str,
        layer_audio_path: str,
        volume: float,
        start_time: float,
        output_path: str,
        total_duration: float
    ) -> str:
        """
        Mixes (overlays) a new real audio layer on top of the existing audio track
        using FFmpeg amix filter so original audio stays intact and the new layer is clearly heard.
        """
        ffmpeg_bin = cls.get_ffmpeg()
        vol = max(0.05, min(1.0, float(volume)))
        delay_ms = int(max(0.0, float(start_time)) * 1000)

        if delay_ms > 0:
            filter_str = f"[1:a]adelay={delay_ms}|{delay_ms},volume={vol}[layer];[0:a][layer]amix=inputs=2:duration=first:dropout_transition=2[aout]"
        else:
            filter_str = f"[1:a]volume={vol}[layer];[0:a][layer]amix=inputs=2:duration=first:dropout_transition=2[aout]"

        cmd = [
            ffmpeg_bin, "-y",
            "-i", str(base_audio_path),
            "-i", str(layer_audio_path),
            "-filter_complex", filter_str,
            "-map", "[aout]",
            "-t", str(total_duration),
            "-c:a", "libmp3lame",
            "-b:a", "192k",
            str(output_path)
        ]
        ret = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if ret.returncode != 0:
            raise RuntimeError(f"FFmpeg audio mixing failed: {ret.stderr.decode('utf-8', errors='ignore')}")

        return str(output_path)

    @classmethod
    def merge_video_audio(
        cls,
        video_path: str,
        audio_path: str,
        output_mp4_path: str
    ) -> str:
        """Merges audio track with mute video using FFmpeg."""
        ffmpeg_bin = cls.get_ffmpeg()
        cmd_copy = [
            ffmpeg_bin, "-y",
            "-i", str(video_path),
            "-i", str(audio_path),
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(output_mp4_path)
        ]
        ret = subprocess.run(cmd_copy, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if ret.returncode != 0 or not Path(output_mp4_path).exists():
            # Fallback to fast re-encode if stream copy fails
            cmd_reencode = [
                ffmpeg_bin, "-y",
                "-i", str(video_path),
                "-i", str(audio_path),
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-pix_fmt", "yuv420p",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(output_mp4_path)
            ]
            ret2 = subprocess.run(cmd_reencode, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if ret2.returncode != 0 or not Path(output_mp4_path).exists():
                raise RuntimeError(f"FFmpeg muxing failed: {ret2.stderr.decode('utf-8', errors='ignore')}")

        return str(output_mp4_path)