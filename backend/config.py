import os
from pathlib import Path

# App data directory
APP_DATA_DIR = Path.home() / ".cinetrack"
ARTWORK_DIR = APP_DATA_DIR / "artwork"
DB_PATH = APP_DATA_DIR / "cinetrack.db"
LOG_PATH = APP_DATA_DIR / "cinetrack.log"

# Create directories on import
APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
ARTWORK_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_PATH}"

# TMDB (use api.tmdb.org as primary endpoint; api.themoviedb.org is blocked on some ISPs)
TMDB_BASE_URL = os.environ.get("TMDB_BASE_URL", "https://api.tmdb.org/3")
TMDB_FALLBACK_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = os.environ.get("TMDB_IMAGE_BASE", "https://image.tmdb.org/t/p/")

# Video extensions
VIDEO_EXTENSIONS = {".mp4", ".mkv", ".avi", ".mov", ".webm", ".m4v", ".ts", ".wmv", ".flv"}

# Default settings
DEFAULT_SETTINGS = {
    "tmdb_api_key": "",
    "default_volume": "100",
    "resume_playback": "true",
    "completion_threshold_minutes": "5",
    "auto_next_episode": "true",
    "next_episode_countdown": "15",
    "progress_save_interval": "10",
    "hover_preview_enabled": "true",
    "hover_delay_ms": "500",
    "theme": "dark",
    "card_size": "medium",
    "animation_intensity": "normal",
}
