import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env", override=True)
UPLOADS_DIR = BASE_DIR / "uploads"
OUTPUTS_DIR = BASE_DIR / "outputs"
CACHE_DIR = BASE_DIR / "cache"
SESSIONS_DIR = BASE_DIR / "sessions"

for d in [UPLOADS_DIR, OUTPUTS_DIR, CACHE_DIR, SESSIONS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Environment variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite").strip()
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "").strip()
FREESOUND_API_KEY = os.getenv("FREESOUND_API_KEY", "").strip()

if GEMINI_API_KEY:
    os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY
    os.environ["GOOGLE_API_KEY"] = GEMINI_API_KEY

# Audio and video constants
SR = 48000
AUDIOLDM_SR = 16000
MAX_VIDEO_SECONDS = 10.0
MAX_UPLOAD_MB = 200
ANALYSIS_SIZE = (320, 180)
CLIP_SECONDS = 2.0
DRY_PEAK = 0.3

# Wall absorption table
ABSORPTION = {
    "concrete": 0.03,
    "stone": 0.02,
    "wood": 0.10,
    "curtains": 0.30,
    "outdoor": 0.95
}

# Distance acoustic properties
DISTANCE = {
    "near": {"mix": 0.15, "lowpass": None, "gain_db": 0.0},
    "mid": {"mix": 0.35, "lowpass": 8000.0, "gain_db": -4.0},
    "far": {"mix": 0.60, "lowpass": 4500.0, "gain_db": -9.0}
}

# Material EQ definitions
MATERIAL_EQ = {
    "metal": [
        {"type": "highshelf", "freq": 4000.0, "gain_db": 4.0, "q": 0.707},
        {"type": "peak", "freq": 3000.0, "gain_db": 6.0, "q": 8.0}
    ],
    "wood": [
        {"type": "lowpass", "freq": 5000.0, "q": 0.707},
        {"type": "peak", "freq": 400.0, "gain_db": 4.0, "q": 2.0}
    ],
    "glass": [
        {"type": "highpass", "freq": 1500.0, "q": 0.707},
        {"type": "highshelf", "freq": 6000.0, "gain_db": 3.0, "q": 0.707}
    ],
    "fabric": [
        {"type": "lowpass", "freq": 2500.0, "q": 0.707},
        {"type": "tanh_compress", "k": 2.0}
    ],
    "gravel": [
        {"type": "highpass", "freq": 1200.0, "q": 0.707},
        {"type": "lowpass", "freq": 6000.0, "q": 0.707}
    ],
    "leather": [
        {"type": "lowpass", "freq": 6000.0, "q": 0.707},
        {"type": "peak", "freq": 200.0, "gain_db": 3.0, "q": 1.5}
    ],
    "stone": [
        {"type": "peak", "freq": 2000.0, "gain_db": 3.0, "q": 1.5},
        {"type": "lowpass", "freq": 9000.0, "q": 0.707}
    ],
    "concrete": [
        {"type": "highshelf", "freq": 3000.0, "gain_db": 2.0, "q": 0.707}
    ]
}