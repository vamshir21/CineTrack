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

    collection = tmdb_data.get("belongs_to_collection")
    if collection and isinstance(collection, dict):
        db_movie.collection_id = collection.get("id")
        db_movie.collection_name = collection.get("name")


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


def get_credits(media_type: str, tmdb_id: int) -> dict:
    """Fetch cast and crew for a movie or TV show."""
    endpoint = f"/movie/{tmdb_id}/credits" if media_type == "movie" else f"/tv/{tmdb_id}/credits"
    data = _get(endpoint)
    if not data:
        return {"cast": [], "crew": []}

    cast_members = []
    for c in data.get("cast", [])[:18]:
        profile_path = c.get("profile_path")
        profile_url = get_image_url(profile_path, "w185") if profile_path else None
        cast_members.append({
            "id": c.get("id"),
            "name": c.get("name"),
            "character": c.get("character"),
            "profile_path": profile_path,
            "profile_url": profile_url,
            "order": c.get("order", 99),
        })

    crew_members = []
    seen_crew = set()
    for c in data.get("crew", []):
        job = c.get("job") or c.get("department")
        name = c.get("name")
        if (name, job) in seen_crew:
            continue
        if job in [
            "Director", "Writer", "Screenplay", "Creator", "Executive Producer",
            "Producer", "Original Music Composer", "Director of Photography",
            "Story", "Novel", "Editor"
        ]:
            seen_crew.add((name, job))
            profile_path = c.get("profile_path")
            profile_url = get_image_url(profile_path, "w185") if profile_path else None
            crew_members.append({
                "id": c.get("id"),
                "name": name,
                "job": job,
                "profile_path": profile_path,
                "profile_url": profile_url,
            })
            if len(crew_members) >= 18:
                break

    return {"cast": cast_members, "crew": crew_members}


def get_videos(media_type: str, tmdb_id: int) -> dict:
    """Fetch official trailers or teaser videos for a movie or TV show."""
    endpoint = f"/movie/{tmdb_id}/videos" if media_type == "movie" else f"/tv/{tmdb_id}/videos"
    data = _get(endpoint)
    if not data or not data.get("results"):
        return {"trailer": None, "videos": []}

    yt_videos = [v for v in data["results"] if v.get("site") == "YouTube"]
    if not yt_videos:
        return {"trailer": None, "videos": []}

    # Rank videos to pick the best trailer
    def _rank(v):
        score = 0
        v_type = v.get("type", "").lower()
        if v_type == "trailer":
            score += 10
        elif v_type == "teaser":
            score += 5
        if v.get("official") is True:
            score += 10
        if "official" in v.get("name", "").lower():
            score += 2
        return score

    yt_videos.sort(key=_rank, reverse=True)
    best = yt_videos[0]

    trailer = {
        "key": best.get("key"),
        "name": best.get("name"),
        "type": best.get("type"),
        "site": "YouTube",
        "official": best.get("official", False),
    }

    all_vids = [
        {
            "key": v.get("key"),
            "name": v.get("name"),
            "type": v.get("type"),
            "site": "YouTube",
            "official": v.get("official", False),
        }
        for v in yt_videos[:8]
    ]

    return {"trailer": trailer, "videos": all_vids}


def get_upcoming_movies(page: int = 1) -> dict:
    """Fetch upcoming theatrical releases with countdown dates."""
    from datetime import date
    today = date.today()
    data = _get(f"/movie/upcoming?page={page}")
    if not data or not data.get("results"):
        return {"results": [], "total_pages": 1}

    results = []
    for m in data.get("results", []):
        r_date_str = m.get("release_date")
        days_until = None
        if r_date_str:
            try:
                r_date = date.fromisoformat(r_date_str)
                days_until = (r_date - today).days
            except Exception:
                pass

        lang_code = m.get("original_language", "en")
        from backend.services.language_service import get_language_name
        lang_name = get_language_name(lang_code)

        results.append({
            "id": m["id"],
            "title": m.get("title"),
            "overview": m.get("overview"),
            "release_date": r_date_str,
            "days_until": days_until,
            "vote_average": round(m.get("vote_average", 0.0), 1) if m.get("vote_average") else None,
            "original_language": lang_code,
            "language_name": lang_name,
            "poster_url": get_image_url(m.get("poster_path"), "w500"),
            "backdrop_url": get_image_url(m.get("backdrop_path"), "w1280"),
            "genre_ids": m.get("genre_ids", []),
            "popularity": m.get("popularity", 0),
        })

    return {"results": results, "total_pages": data.get("total_pages", 1)}


def get_now_playing_movies(page: int = 1) -> dict:
    """Fetch currently running theatrical movies."""
    data = _get(f"/movie/now_playing?page={page}")
    if not data or not data.get("results"):
        return {"results": [], "total_pages": 1}

    results = []
    from backend.services.language_service import get_language_name
    for m in data.get("results", []):
        lang_code = m.get("original_language", "en")
        lang_name = get_language_name(lang_code)
        results.append({
            "id": m["id"],
            "title": m.get("title"),
            "overview": m.get("overview"),
            "release_date": m.get("release_date"),
            "vote_average": round(m.get("vote_average", 0.0), 1) if m.get("vote_average") else None,
            "original_language": lang_code,
            "language_name": lang_name,
            "poster_url": get_image_url(m.get("poster_path"), "w500"),
            "backdrop_url": get_image_url(m.get("backdrop_path"), "w1280"),
            "genre_ids": m.get("genre_ids", []),
            "popularity": m.get("popularity", 0),
        })

    return {"results": results, "total_pages": data.get("total_pages", 1)}


def get_watch_providers(media_type: str, tmdb_id: int) -> dict:
    """Fetch streaming (OTT) and rental platforms where a title is available."""
    endpoint = f"/movie/{tmdb_id}/watch/providers" if media_type == "movie" else f"/tv/{tmdb_id}/watch/providers"
    data = _get(endpoint)
    if not data or not data.get("results"):
        return {"flatrate": [], "rent": [], "buy": [], "link": None}

    results = data.get("results", {})

    def _merge_providers(key: str):
        seen_names = set()
        merged = []
        # Priority regions: IN, US, GB, CA, AU
        for reg_code in ["IN", "US", "GB", "CA", "AU"]:
            reg_data = results.get(reg_code)
            if not reg_data:
                continue
            for p in reg_data.get(key, []):
                pname = p.get("provider_name")
                if pname and pname not in seen_names:
                    seen_names.add(pname)
                    merged.append({
                        "provider_id": p.get("provider_id"),
                        "provider_name": pname,
                        "logo_url": get_image_url(p.get("logo_path"), "w92"),
                    })
        # If none found in priority regions, check all regions
        if not merged:
            for reg_data in results.values():
                for p in reg_data.get(key, []):
                    pname = p.get("provider_name")
                    if pname and pname not in seen_names:
                        seen_names.add(pname)
                        merged.append({
                            "provider_id": p.get("provider_id"),
                            "provider_name": pname,
                            "logo_url": get_image_url(p.get("logo_path"), "w92"),
                        })
        return merged

    link = None
    if "IN" in results and results["IN"].get("link"):
        link = results["IN"]["link"]
    elif "US" in results and results["US"].get("link"):
        link = results["US"]["link"]
    elif results:
        link = next(iter(results.values())).get("link")

    return {
        "flatrate": _merge_providers("flatrate"),
        "rent": _merge_providers("rent"),
        "buy": _merge_providers("buy"),
        "link": link,
    }


def search_movies_with_providers(query: str, page: int = 1) -> dict:
    """Search any movie on TMDB with OTT platforms, ratings, and language metadata."""
    from backend.services.language_service import get_language_name

    data = _get("/search/movie", {"query": query, "page": page, "include_adult": "false"})
    if not data or not data.get("results"):
        return {"results": [], "total_pages": 1, "total_results": 0}

    results = []
    for m in data.get("results", [])[:20]:
        tmdb_id = m["id"]
        providers = get_watch_providers("movie", tmdb_id)
        lang_code = m.get("original_language", "en")
        lang_name = get_language_name(lang_code)

        results.append({
            "id": tmdb_id,
            "title": m.get("title"),
            "overview": m.get("overview"),
            "release_date": m.get("release_date"),
            "vote_average": round(m.get("vote_average", 0.0), 1) if m.get("vote_average") else None,
            "original_language": lang_code,
            "language_name": lang_name,
            "poster_url": get_image_url(m.get("poster_path"), "w500"),
            "backdrop_url": get_image_url(m.get("backdrop_path"), "w1280"),
            "genre_ids": m.get("genre_ids", []),
            "popularity": m.get("popularity", 0),
            "providers": providers,
        })

    return {
        "results": results,
        "total_pages": data.get("total_pages", 1),
        "total_results": data.get("total_results", len(results)),
    }


def get_ott_releases(page: int = 1) -> dict:
    """Fetch popular recent and upcoming streaming releases with OTT platform tags."""
    from datetime import date
    today = date.today().isoformat()
    # Discover high-popularity flatrate streaming movies
    endpoint = f"/discover/movie?watch_region=US&with_watch_monetization_types=flatrate&sort_by=popularity.desc&page={page}"
    data = _get(endpoint)
    if not data or not data.get("results"):
        return {"results": [], "total_pages": 1}

    results = []
    from backend.services.language_service import get_language_name
    for m in data.get("results", [])[:15]:
        tmdb_id = m["id"]
        # Attach streaming providers if available
        providers = get_watch_providers("movie", tmdb_id)
        lang_code = m.get("original_language", "en")
        lang_name = get_language_name(lang_code)
        results.append({
            "id": tmdb_id,
            "title": m.get("title"),
            "overview": m.get("overview"),
            "release_date": m.get("release_date"),
            "vote_average": round(m.get("vote_average", 0.0), 1) if m.get("vote_average") else None,
            "original_language": lang_code,
            "language_name": lang_name,
            "poster_url": get_image_url(m.get("poster_path"), "w500"),
            "backdrop_url": get_image_url(m.get("backdrop_path"), "w1280"),
            "genre_ids": m.get("genre_ids", []),
            "providers": providers.get("flatrate", [])[:4],
        })

    return {"results": results, "total_pages": data.get("total_pages", 1)}


def get_collection(collection_id: int) -> dict | None:
    """Fetch full franchise collection details and parts."""
    data = _get(f"/collection/{collection_id}")
    if not data:
        return None

    parts = []
    for p in data.get("parts", []):
        parts.append({
            "id": p["id"],
            "title": p.get("title"),
            "overview": p.get("overview"),
            "release_date": p.get("release_date") or "",
            "vote_average": p.get("vote_average"),
            "poster_url": get_image_url(p.get("poster_path"), "w500"),
            "backdrop_url": get_image_url(p.get("backdrop_path"), "w1280"),
        })

    # Sort parts by release date chronologically
    parts.sort(key=lambda x: x["release_date"] if x["release_date"] else "9999")

    return {
        "id": data["id"],
        "name": data.get("name"),
        "overview": data.get("overview"),
        "poster_url": get_image_url(data.get("poster_path"), "w500"),
        "backdrop_url": get_image_url(data.get("backdrop_path"), "w1280"),
        "parts": parts,
    }


def sync_local_movie_collections(db) -> int:
    """Backfill collection_id and collection_name for local movies with tmdb_id."""
    from backend.models import Movie
    movies_to_check = db.query(Movie).filter(Movie.tmdb_id.isnot(None), Movie.collection_id.is_(None)).all()
    updated = 0
    for m in movies_to_check:
        tmdb_data = _get(f"/movie/{m.tmdb_id}")
        if tmdb_data and tmdb_data.get("belongs_to_collection"):
            coll = tmdb_data["belongs_to_collection"]
            m.collection_id = coll.get("id")
            m.collection_name = coll.get("name")
            updated += 1
    if updated > 0:
        db.commit()
    return updated


def get_person_details(person_id: int) -> dict | None:
    """Fetch person biographical information."""
    data = _get(f"/person/{person_id}")
    if not data:
        return None
    return {
        "id": data["id"],
        "name": data.get("name"),
        "biography": data.get("biography"),
        "birthday": data.get("birthday"),
        "deathday": data.get("deathday"),
        "place_of_birth": data.get("place_of_birth"),
        "known_for_department": data.get("known_for_department"),
        "profile_url": get_image_url(data.get("profile_path"), "w500"),
    }


def get_person_credits(person_id: int) -> dict:
    """Fetch combined credits (acting and crew) for a person."""
    data = _get(f"/person/{person_id}/combined_credits")
    if not data:
        return {"cast": [], "crew": []}

    def _fmt(item, role_key):
        is_movie = item.get("media_type") == "movie"
        release = item.get("release_date") if is_movie else item.get("first_air_date")
        return {
            "id": item["id"],
            "title": item.get("title") or item.get("name") or "Untitled",
            "media_type": item.get("media_type", "movie"),
            "release_date": release or "",
            "vote_average": round(item.get("vote_average", 0), 1) if item.get("vote_average") else None,
            "role": item.get(role_key) or "",
            "poster_url": get_image_url(item.get("poster_path"), "w500"),
            "backdrop_url": get_image_url(item.get("backdrop_path"), "w1280"),
            "popularity": item.get("popularity", 0),
        }

    cast = [_fmt(c, "character") for c in data.get("cast", [])]
    crew = [_fmt(c, "job") for c in data.get("crew", [])]

    # Deduplicate by id and sort by popularity
    seen_cast = set()
    unique_cast = []
    for c in sorted(cast, key=lambda x: x["popularity"], reverse=True):
        if c["id"] not in seen_cast:
            seen_cast.add(c["id"])
            unique_cast.append(c)

    seen_crew = set()
    unique_crew = []
    for c in sorted(crew, key=lambda x: x["popularity"], reverse=True):
        if c["id"] not in seen_crew:
            seen_crew.add(c["id"])
            unique_crew.append(c)

    return {"cast": unique_cast, "crew": unique_crew}



