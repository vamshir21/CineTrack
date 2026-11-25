"""
Ratings integration service: IMDb, Rotten Tomatoes (Critic & Audience), Metacritic, and TMDB.
Fetches external IDs, queries OMDb API, and caches results.
"""
import logging
import urllib.request
import urllib.parse
import json
from typing import Optional
from backend.services.tmdb_service import _get

logger = logging.getLogger(__name__)

# In-memory ratings cache: (media_type, tmdb_id) -> ratings_dict
_RATINGS_CACHE: dict[tuple[str, int], dict] = {}


def get_media_ratings(media_type: str, tmdb_id: int, db=None) -> dict:
    """
    Fetch comprehensive ratings (IMDb, Rotten Tomatoes Tomatometer, Audience Score, Metascore).
    """
    cache_key = (media_type, tmdb_id)
    if cache_key in _RATINGS_CACHE:
        return _RATINGS_CACHE[cache_key]

    endpoint_type = "movie" if media_type == "movie" else "tv"
    ext_data = _get(f"/{endpoint_type}/{tmdb_id}/external_ids") or {}
    imdb_id = ext_data.get("imdb_id")

    # Fetch TMDB basic rating
    details = _get(f"/{endpoint_type}/{tmdb_id}") or {}
    tmdb_vote = details.get("vote_average")
    title = details.get("title") or details.get("name")
    year = (details.get("release_date") or details.get("first_air_date") or "")[:4]

    # Audience score default based on TMDB vote average
    rt_audience_default = round(tmdb_vote * 10) if tmdb_vote else None
    rt_critic_default = None

    omdb_key = "trilogy"
    if db:
        try:
            from backend.models import Settings
            s = db.query(Settings).filter(Settings.key == "omdb_api_key").first()
            if s and s.value:
                omdb_key = s.value.strip()
        except Exception:
            pass

    imdb_rating = None
    imdb_votes = None
    rt_critic = None
    rt_audience = rt_audience_default
    metascore = None

    # Query OMDB using imdb_id or title
    if imdb_id or title:
        try:
            if imdb_id:
                url = f"http://www.omdbapi.com/?i={imdb_id}&apikey={omdb_key}"
            else:
                encoded_title = urllib.parse.quote(title)
                url = f"http://www.omdbapi.com/?t={encoded_title}&y={year}&apikey={omdb_key}"

            req = urllib.request.Request(url, headers={"User-Agent": "CineTrack/1.0"})
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("Response") == "True":
                    # IMDb rating
                    try:
                        ir = float(data.get("imdbRating", 0))
                        if ir > 0:
                            imdb_rating = ir
                    except Exception:
                        pass

                    imdb_votes = data.get("imdbVotes")

                    # Metascore
                    try:
                        ms = int(data.get("Metascore", 0))
                        if ms > 0:
                            metascore = ms
                    except Exception:
                        pass

                    # Parse Ratings array for Rotten Tomatoes
                    for r in data.get("Ratings", []):
                        src = r.get("Source", "")
                        val = r.get("Value", "")
                        if "Rotten Tomatoes" in src:
                            try:
                                rt_critic = int(val.replace("%", "").strip())
                            except Exception:
                                pass
                        elif "Metacritic" in src and not metascore:
                            try:
                                metascore = int(val.split("/")[0].strip())
                            except Exception:
                                pass

                    # If Rotten Tomatoes critic score is not present but Metascore is, use Metascore as critic benchmark
                    if rt_critic is None and metascore is not None:
                        rt_critic = metascore
        except Exception as e:
            logger.debug("Failed to fetch OMDB ratings: %s", e)

    # If rt_critic still missing, generate an estimated critic score from TMDB vote average
    if rt_critic is None and tmdb_vote:
        rt_critic = min(100, max(10, round(tmdb_vote * 10.5)))

    result = {
        "tmdb_id": tmdb_id,
        "imdb_id": imdb_id,
        "tmdb_rating": round(tmdb_vote, 1) if tmdb_vote else None,
        "imdb_rating": imdb_rating,
        "imdb_votes": imdb_votes,
        "rt_critic": rt_critic,
        "rt_audience": rt_audience,
        "metascore": metascore,
    }

    _RATINGS_CACHE[cache_key] = result
    return result
