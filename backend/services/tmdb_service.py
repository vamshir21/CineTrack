"""
TMDB API integration service.
"""
import os
import logging
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional

import requests

from backend.config import TMDB_BASE_URL, TMDB_FALLBACK_URL, ARTWORK_DIR
from backend.services.image_cache import download_image, get_image_url, get_cached_image_path

logger = logging.getLogger(__name__)

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 CineTrack/1.0",
    "Accept": "application/json",
}


def _get_api_key() -> Optional[str]:
    """Fetch the TMDB API key from Settings table, env var, or .env file."""
    # 1. Environment variable
    env_key = os.environ.get("TMDB_API_KEY")
    if env_key and env_key.strip() and env_key.strip() != "your_key_here":
        return env_key.strip()

    # 2. Database settings
    try:
        from backend.database import SessionLocal
        from backend.models import Settings
        db = SessionLocal()
        try:
            row = db.query(Settings).filter(Settings.key == "tmdb_api_key").first()
            if row and row.value and row.value.strip() and row.value.strip() != "your_key_here":
                return row.value.strip()
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"Could not fetch TMDB API key from DB: {e}")

    # 3. .env file
    env_file = Path(__file__).parent.parent.parent / ".env"
    if env_file.exists():
        try:
            for line in env_file.read_text().splitlines():
                if line.startswith("TMDB_API_KEY="):
                    val = line.split("=", 1)[1].strip().strip('"').strip("'")
                    if val and val != "your_key_here":
                        return val
        except Exception:
            pass

    return None


def _get(endpoint: str, params: dict = None) -> Optional[dict]:
    api_key = _get_api_key()
    if not api_key:
        logger.warning("No TMDB API key configured")
        return None

    headers = dict(DEFAULT_HEADERS)
    p = {}
    if api_key.startswith("ey"):
        headers["Authorization"] = f"Bearer {api_key}"
    else:
        p["api_key"] = api_key

    if params:
        p.update(params)

    # Try primary endpoint (api.tmdb.org), then fallback
    for base_url in [TMDB_BASE_URL, TMDB_FALLBACK_URL]:
        try:
            resp = requests.get(f"{base_url}{endpoint}", params=p, headers=headers, timeout=8)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 401:
                logger.warning(f"TMDB authentication failed (401) on {base_url}{endpoint}")
                return None
        except Exception as e:
            logger.warning(f"TMDB request failed on {base_url}{endpoint}: {e}")
            continue

    return None


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def build_image_path(media_type: str, tmdb_id: int, purpose: str, size: str) -> Path:
    """Build the local path where an artwork image should be saved."""
    return ARTWORK_DIR / f"{media_type}_{tmdb_id}_{purpose}_{size}.jpg"


def search_movies(query: str, year: Optional[int] = None) -> list[dict]:
    """Search TMDB for movies. Returns list of candidates with similarity scores."""
    params = {"query": query, "include_adult": "false"}
    if year:
        params["year"] = year
    data = _get("/search/movie", params)
    if not data:
        return []

    results = []
    for r in data.get("results", [])[:20]:
        title = r.get("title", "")
        score = _similarity(query, title)
        release_date = r.get("release_date", "")
        results.append({
            "tmdb_id": r["id"],
            "title": title,
            "year": release_date[:4] if release_date else None,
            "overview": r.get("overview"),
            "poster_path": r.get("poster_path"),
            "score": round(score, 3),
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results


def search_tv(query: str) -> list[dict]:
    """Search TMDB for TV shows. Returns list of candidates with similarity scores."""
    data = _get("/search/tv", {"query": query, "include_adult": "false"})
    if not data:
        return []

    results = []
    for r in data.get("results", [])[:20]:
        name = r.get("name", "")
        score = _similarity(query, name)
        first_air = r.get("first_air_date", "")
        results.append({
            "tmdb_id": r["id"],
            "title": name,
            "year": first_air[:4] if first_air else None,
            "overview": r.get("overview"),
            "poster_path": r.get("poster_path"),
            "score": round(score, 3),
        })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results


def get_movie_details(tmdb_id: int) -> Optional[dict]:
    """Fetch full movie details from TMDB."""
    return _get(f"/movie/{tmdb_id}")


def get_tv_details(tmdb_id: int) -> Optional[dict]:
    """Fetch full TV series details from TMDB."""
    return _get(f"/tv/{tmdb_id}")


def get_season_details(tmdb_id: int, season_num: int) -> Optional[dict]:
    """Fetch season details (with episode list) from TMDB."""
    return _get(f"/tv/{tmdb_id}/season/{season_num}")


def _cache_image(tmdb_path: Optional[str], local_path: Path, size: str = "w500") -> Optional[str]:
    """Download an image and return the local /api/images/ path."""
    if not tmdb_path:
        return None
    if local_path.exists():
        return f"/api/images/{local_path.name}"
    url = get_image_url(tmdb_path, size)
    if url and download_image(url, local_path):
        return f"/api/images/{local_path.name}"
    return None


def apply_movie_metadata(db_movie, tmdb_data: dict) -> None:
    """Apply TMDB movie data to a Movie ORM object (does NOT commit)."""
    from backend.models import Movie
    import json

    genres = [g["name"] for g in tmdb_data.get("genres", [])]

    poster_local = _cache_image(
        tmdb_data.get("poster_path"),
        build_image_path("movie", tmdb_data["id"], "poster", "w500"),
        "w500",
    )
    backdrop_local = _cache_image(
        tmdb_data.get("backdrop_path"),
        build_image_path("movie", tmdb_data["id"], "backdrop", "w1280"),
        "w1280",
    )

    db_movie.tmdb_id = tmdb_data["id"]
    db_movie.overview = tmdb_data.get("overview")
    db_movie.release_date = tmdb_data.get("release_date")
    db_movie.runtime = tmdb_data.get("runtime")
    db_movie.poster_path = poster_local
    db_movie.backdrop_path = backdrop_local
    db_movie.genres = json.dumps(genres)
    db_movie.vote_average = tmdb_data.get("vote_average")


def apply_series_metadata(db_series, tmdb_data: dict) -> None:
    """Apply TMDB TV data to a TVSeries ORM object (does NOT commit)."""
    import json

    genres = [g["name"] for g in tmdb_data.get("genres", [])]

    poster_local = _cache_image(
        tmdb_data.get("poster_path"),
        build_image_path("series", tmdb_data["id"], "poster", "w500"),
        "w500",
    )
    backdrop_local = _cache_image(
        tmdb_data.get("backdrop_path"),
        build_image_path("series", tmdb_data["id"], "backdrop", "w1280"),
        "w1280",
    )

    db_series.tmdb_id = tmdb_data["id"]
    db_series.overview = tmdb_data.get("overview")
    db_series.first_air_date = tmdb_data.get("first_air_date")
    db_series.poster_path = poster_local
    db_series.backdrop_path = backdrop_local
    db_series.genres = json.dumps(genres)
    db_series.vote_average = tmdb_data.get("vote_average")
    db_series.number_of_seasons = tmdb_data.get("number_of_seasons")


def apply_season_metadata(db_season, tmdb_season: dict, series_tmdb_id: int) -> None:
    """Apply TMDB season data to a Season ORM object (does NOT commit)."""
    poster_local = _cache_image(
        tmdb_season.get("poster_path"),
        build_image_path("season", series_tmdb_id, f"s{tmdb_season.get('season_number', 0)}_poster", "w342"),
        "w342",
    )
    db_season.name = tmdb_season.get("name")
    db_season.overview = tmdb_season.get("overview")
    db_season.poster_path = poster_local
    db_season.air_date = tmdb_season.get("air_date")
    db_season.episode_count = len(tmdb_season.get("episodes", []))


def apply_episode_metadata(db_episode, tmdb_ep: dict, series_tmdb_id: int) -> None:
    """Apply TMDB episode data to an Episode ORM object (does NOT commit)."""
    still_local = _cache_image(
        tmdb_ep.get("still_path"),
        build_image_path("episode", series_tmdb_id, f"s{tmdb_ep.get('season_number', 0)}e{tmdb_ep.get('episode_number', 0)}_still", "w300"),
        "w300",
    )
    db_episode.title = tmdb_ep.get("name")
    db_episode.overview = tmdb_ep.get("overview")
    db_episode.still_path = still_local
    db_episode.air_date = tmdb_ep.get("air_date")
    db_episode.runtime = tmdb_ep.get("runtime")
