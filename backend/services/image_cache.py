"""
Image cache service: download and cache TMDB artwork locally.
"""
import os
import logging
from pathlib import Path
from typing import Optional

import requests

from backend.config import ARTWORK_DIR, TMDB_IMAGE_BASE

logger = logging.getLogger(__name__)

# Track failed URLs within the session
_failed_urls: set[str] = set()


def get_image_url(tmdb_path: str, size: str = "w500") -> str:
    """Build full TMDB image URL."""
    if not tmdb_path:
        return ""
    if tmdb_path.startswith("http"):
        return tmdb_path
    path = tmdb_path.lstrip("/")
    return f"{TMDB_IMAGE_BASE}{size}/{path}"


def build_local_filename(tmdb_path: str, size: str, media_type: str = "") -> str:
    """Generate local filename for cached image."""
    safe = tmdb_path.lstrip("/").replace("/", "_")
    if media_type:
        return f"{media_type}_{size}_{safe}"
    return f"{size}_{safe}"


def download_image(url: str, local_path: Path) -> bool:
    """Download image from URL and save to local_path."""
    if url in _failed_urls:
        return False
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 CineTrack/1.0"
        }
        resp = requests.get(url, headers=headers, timeout=15, stream=True)
        resp.raise_for_status()
        local_path.parent.mkdir(parents=True, exist_ok=True)
        with open(local_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        logger.warning(f"Failed to download image {url}: {e}")
        _failed_urls.add(url)
        return False


def get_cached_image(tmdb_path: Optional[str], size: str = "w500", media_type: str = "") -> Optional[str]:
    """
    Download (if not already cached) and return the local filename for the image.
    Returns None if unavailable.
    """
    if not tmdb_path:
        return None

    filename = build_local_filename(tmdb_path, size, media_type)
    local_path = ARTWORK_DIR / filename

    if local_path.exists():
        return filename

    url = get_image_url(tmdb_path, size)
    if not url:
        return None

    success = download_image(url, local_path)
    if success:
        return filename

    return None


def get_cached_image_path(tmdb_path: Optional[str], size: str = "w500", media_type: str = "") -> Optional[str]:
    """Return the local API path for a cached image (e.g. /api/images/filename)."""
    filename = get_cached_image(tmdb_path, size, media_type)
    if filename:
        return f"/api/images/{filename}"
    return None
