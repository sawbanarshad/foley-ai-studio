import os
import sys
import time
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# Force offline procedural fallback
os.environ["USE_LIGHTWEIGHT_SYNTH_FALLBACK"] = "1"
os.environ["GEMINI_API_KEY"] = ""

import cv2
import numpy as np
from fastapi.testclient import TestClient
from main import app
from tests.make_demo_video import create_demo_video


def run_smoke_test():
    print("=" * 60)
    print("RUNNING FOLEY AI STUDIO BACKEND SMOKE TEST")
    print("=" * 60)

    client = TestClient(app)
    demo_video_path = Path(__file__).parent / "demo_test.mp4"
    known_impacts = create_demo_video(str(demo_video_path))
    print(f"[OK] Generated synthetic video: {demo_video_path} with impacts {known_impacts}")

    passed = 0
    total = 0

    def check(name: str, cond: bool, msg: str = ""):
        nonlocal passed, total
        total += 1
        if cond:
            passed += 1
            print(f"  [PASS] {name}")
        else:
            print(f"  [FAIL] {name} - {msg}")
            assert cond, f"Check failed: {name} ({msg})"

    # 1. Health Endpoint
    print("\n1. Testing GET /api/health...")
    h_res = client.get("/api/health")
    check("Health status 200", h_res.status_code == 200)
    h_json = h_res.json()
    check("Health status ok", h_json.get("status") == "ok")
    check("Engine is procedural", h_json.get("audio_engine") == "procedural")

    # 2. Analyze Video Endpoint
    print("\n2. Testing POST /api/analyze-video...")
    with open(demo_video_path, "rb") as f:
        a_res = client.post("/api/analyze-video", files={"file": ("demo_test.mp4", f, "video/mp4")})
    check("Analyze status 200", a_res.status_code == 200, a_res.text)
    a_json = a_res.json()
    session_id = a_json["session_id"]
    check("Analysis source offline_fallback", a_json["analysis_source"] == "offline_fallback")
    
    detected_frames = [e["frame_idx"] for e in a_json["events"]]
    print(f"    Known impact frames: {known_impacts}")
    print(f"    Detected primary frames: {detected_frames}")
    
    for k_frame in known_impacts:
        found_close = any(abs(df - k_frame) <= 2 for df in detected_frames)
        check(f"Impact frame {k_frame} detected (+/-2 frames)", found_close)

    # 3. GET /api/session/{id} Round Trip
    print("\n3. Testing GET /api/session/{session_id}...")
    s_res = client.get(f"/api/session/{session_id}")
    check("Session round trip 200", s_res.status_code == 200)
    check("Session data matches", s_res.json()["session_id"] == session_id)

    # 4. Generate Audio Endpoint
    print("\n4. Testing POST /api/generate-audio...")
    g_res = client.post("/api/generate-audio", json={"session_id": session_id})
    check("Generate audio status 200", g_res.status_code == 200, g_res.text)
    g_json = g_res.json()

    check("Waveform has 1000 bins", len(g_json["waveform"]) == 1000)
    check("Naive waveform has 1000 bins", len(g_json["naive_waveform"]) == 1000)
    check("Peaks returned", len(g_json["peaks"]) > 0)

    # Verify MP4 files exist and can be opened by OpenCV
    synced_mp4 = backend_dir / g_json["synced_video_url"].lstrip("/")
    naive_mp4 = backend_dir / g_json["naive_video_url"].lstrip("/")
    check("Synced MP4 exists", synced_mp4.exists())
    check("Naive MP4 exists", naive_mp4.exists())

    cap_s = cv2.VideoCapture(str(synced_mp4))
    check("OpenCV can read synced MP4", cap_s.isOpened())
    cap_s.release()

    cap_n = cv2.VideoCapture(str(naive_mp4))
    check("OpenCV can read naive MP4", cap_n.isOpened())
    cap_n.release()

    # Peak alignment check
    fps = a_json["video"]["fps"]
    for pk in g_json["peaks"]:
        # Find matching event
        matching_ev = next((e for e in a_json["events"] if e["id"] == pk["event_id"]), None)
        if matching_ev:
            diff_sec = abs(pk["time"] - matching_ev["t_impact"])
            diff_frames = diff_sec * fps
            check(f"Peak {pk['event_id']} within +/-1 frame ({round(diff_frames, 2)} frames)", diff_frames <= 1.05)

    # 5. Tweak Physics Endpoint (3 runs)
    print("\n5. Testing POST /api/tweak-physics...")
    # Tweak 1: Room Length L
    t1_res = client.post("/api/tweak-physics", json={"session_id": session_id, "room_length_L": 12.0})
    check("Tweak 1 status 200", t1_res.status_code == 200)
    t1_json = t1_res.json()
    check("RT60 changes with L (rt60 > initial)", t1_json["rt60"] > a_json["environment"]["rt60"])
    check("Processing under 1500ms", t1_json["processing_ms"] < 1500)

    # Tweak 2: Sync Nudge Frames
    t2_res = client.post("/api/tweak-physics", json={"session_id": session_id, "sync_nudge_frames": 2})
    check("Tweak 2 status 200", t2_res.status_code == 200)
    t2_json = t2_res.json()
    if len(t2_json["peaks"]) > 0 and len(g_json["peaks"]) > 0:
        p_orig = g_json["peaks"][0]["time"]
        p_nudged = t2_json["peaks"][0]["time"]
        expected_shift = 2.0 / fps
        check("Peak shifts by nudge/fps", abs((p_nudged - p_orig) - expected_shift) < 0.01)

    # Tweak 3: Intensity Multiplier & Version increment
    t3_res = client.post("/api/tweak-physics", json={"session_id": session_id, "intensity_multiplier": 1.4})
    check("Tweak 3 status 200", t3_res.status_code == 200)
    t3_json = t3_res.json()
    check("Versioned URL increments", "synced_v" in t3_json["synced_video_url"])

    # 6. Determinism Check: Two identical calls must yield identical WAV bytes
    print("\n6. Testing DSP Determinism...")
    d1_res = client.post("/api/tweak-physics", json={"session_id": session_id, "room_length_L": 6.0, "intensity_multiplier": 1.0, "sync_nudge_frames": 0})
    wav1_path = backend_dir / d1_res.json()["synced_audio_url"].lstrip("/")
    with open(wav1_path, "rb") as f1:
        bytes1 = f1.read()

    d2_res = client.post("/api/tweak-physics", json={"session_id": session_id, "room_length_L": 6.0, "intensity_multiplier": 1.0, "sync_nudge_frames": 0})
    wav2_path = backend_dir / d2_res.json()["synced_audio_url"].lstrip("/")
    with open(wav2_path, "rb") as f2:
        bytes2 = f2.read()

    check("Bit-identical WAV outputs for identical tweak settings", bytes1 == bytes2)

    print("\n" + "=" * 60)
    print(f"SMOKE TEST SUMMARY: {passed}/{total} CHECKS PASSED")
    print("=" * 60)

    if passed == total:
        print("[SUCCESS] ALL SMOKE TEST CHECKS PASSED PERFECTLY!\n")
    else:
        print("[FAILURE] SOME CHECKS FAILED!\n")
        sys.exit(1)


if __name__ == "__main__":
    run_smoke_test()