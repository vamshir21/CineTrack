"""
TMDB router.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Movie, TVSeries, Season, Episode
from backend.schemas import TMDBMatchRequest
from backend.services import tmdb_service

router = APIRouter(prefix="/api/tmdb", tags=["tmdb"])


@router.get("/test")
def test_tmdb_connection():
    api_key = tmdb_service._get_api_key()
    if not api_key:
        return {"status": "error", "message": "No TMDB API key configured"}
    res = tmdb_service._get("/configuration")
    if res:
        return {"status": "ok", "message": "Successfully connected to TMDB API"}
    return {"status": "error", "message": "Failed to connect to TMDB. Verify your API key."}


@router.post("/test-key")
def test_specific_key(body: dict):
    key = body.get("api_key", "").strip()
    if not key:
        return {"status": "error", "message": "API key cannot be empty"}
    import requests
    from backend.config import TMDB_BASE_URL
    headers = dict(tmdb_service.DEFAULT_HEADERS)
    p = {}
    if key.startswith("ey"):
        headers["Authorization"] = f"Bearer {key}"
    else:
        p["api_key"] = key
    try:
        r = requests.get(f"{TMDB_BASE_URL}/configuration", params=p, headers=headers, timeout=6)
        if r.status_code == 200:
            return {"status": "ok", "message": "Valid API key! Successfully authenticated with TMDB."}
        elif r.status_code == 401:
            return {"status": "error", "message": "Invalid TMDB API key."}
        else:
            return {"status": "error", "message": f"TMDB returned status {r.status_code}"}
    except Exception as e:
        return {"status": "error", "message": f"Connection error: {e}"}


@router.post("/sync-all")
def sync_all_metadata(db: Session = Depends(get_db)):
    """Retry TMDB match and artwork download for all unmatched movies and series."""
    api_key = tmdb_service._get_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="No TMDB API key configured")

    matched_movies = 0
    matched_series = 0

    # 1. Unmatched movies
    unmatched_movies = db.query(Movie).filter((Movie.tmdb_id == None) | (Movie.poster_path == None)).all()
    for m in unmatched_movies:
        try:
            candidates = tmdb_service.search_movies(m.title)
            if candidates and candidates[0]["score"] >= 0.5:
                best = candidates[0]
                details = tmdb_service.get_movie_details(best["tmdb_id"])
                if details:
                    tmdb_service.apply_movie_metadata(m, details)
                    db.add(m)
                    matched_movies += 1
        except Exception as e:
            continue

    # 2. Unmatched series
    unmatched_series = db.query(TVSeries).filter((TVSeries.tmdb_id == None) | (TVSeries.poster_path == None)).all()
    for s in unmatched_series:
        try:
            candidates = tmdb_service.search_tv(s.title)
            if candidates and candidates[0]["score"] >= 0.5:
                best = candidates[0]
                details = tmdb_service.get_tv_details(best["tmdb_id"])
                if details:
                    tmdb_service.apply_series_metadata(s, details)
                    db.add(s)
                    for season in db.query(Season).filter(Season.series_id == s.id).all():
                        season_data = tmdb_service.get_season_details(s.tmdb_id, season.season_number)
                        if season_data:
                            tmdb_service.apply_season_metadata(season, season_data, s.tmdb_id)
                            db.add(season)
                            for ep_data in season_data.get("episodes", []):
                                ep = db.query(Episode).filter(
                                    Episode.series_id == s.id,
                                    Episode.season_number == ep_data.get("season_number"),
                                    Episode.episode_number == ep_data.get("episode_number"),
                                ).first()
                                if ep:
                                    tmdb_service.apply_episode_metadata(ep, ep_data, s.tmdb_id)
                                    db.add(ep)
                    matched_series += 1
        except Exception as e:
            continue

    db.commit()
    return {
        "status": "ok",
        "matched_movies": matched_movies,
        "matched_series": matched_series,
        "message": f"Successfully synced {matched_movies} movies and {matched_series} TV shows with TMDB."
    }


@router.get("/search")
def search_tmdb(
    q: str = Query(...),
    type: str = Query("movie"),
):
    if type == "tv":
        results = tmdb_service.search_tv(q)
    else:
        results = tmdb_service.search_movies(q)
    return results


@router.post("/match/movie/{movie_id}")
def match_movie(movie_id: int, body: TMDBMatchRequest, db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    details = tmdb_service.get_movie_details(body.tmdb_id)
    if not details:
        raise HTTPException(status_code=404, detail="TMDB movie not found")

    tmdb_service.apply_movie_metadata(movie, details)
    db.commit()
    db.refresh(movie)
    return {"status": "matched", "tmdb_id": body.tmdb_id}


@router.post("/match/series/{series_id}")
def match_series(series_id: int, body: TMDBMatchRequest, db: Session = Depends(get_db)):
    series = db.query(TVSeries).filter(TVSeries.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    details = tmdb_service.get_tv_details(body.tmdb_id)
    if not details:
        raise HTTPException(status_code=404, detail="TMDB series not found")

    tmdb_service.apply_series_metadata(series, details)
    db.commit()

    # Fetch season/episode metadata
    for season in db.query(Season).filter(Season.series_id == series_id).all():
        season_data = tmdb_service.get_season_details(body.tmdb_id, season.season_number)
        if season_data:
            tmdb_service.apply_season_metadata(season, season_data, body.tmdb_id)
            db.add(season)
            for ep_data in season_data.get("episodes", []):
                ep = (
                    db.query(Episode)
                    .filter(
                        Episode.series_id == series_id,
                        Episode.season_number == ep_data.get("season_number"),
                        Episode.episode_number == ep_data.get("episode_number"),
                    )
                    .first()
                )
                if ep:
                    tmdb_service.apply_episode_metadata(ep, ep_data, body.tmdb_id)
                    db.add(ep)
    db.commit()
    return {"status": "matched", "tmdb_id": body.tmdb_id}


@router.get("/config")
def get_tmdb_config():
    return {
        "image_base_url": "https://image.tmdb.org/t/p/",
        "poster_sizes": ["w342", "w500"],
        "backdrop_sizes": ["w780", "w1280"],
        "still_sizes": ["w300", "w500"],
    }


@router.post("/refresh/movie/{movie_id}")
def refresh_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    if not movie.tmdb_id:
        raise HTTPException(status_code=400, detail="Movie has no TMDB match")

    details = tmdb_service.get_movie_details(movie.tmdb_id)
    if not details:
        raise HTTPException(status_code=502, detail="Failed to fetch TMDB data")

    tmdb_service.apply_movie_metadata(movie, details)
    db.commit()
    return {"status": "refreshed"}


@router.post("/refresh/series/{series_id}")
def refresh_series(series_id: int, db: Session = Depends(get_db)):
    series = db.query(TVSeries).filter(TVSeries.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    if not series.tmdb_id:
        raise HTTPException(status_code=400, detail="Series has no TMDB match")

    details = tmdb_service.get_tv_details(series.tmdb_id)
    if not details:
        raise HTTPException(status_code=502, detail="Failed to fetch TMDB data")

    tmdb_service.apply_series_metadata(series, details)
    db.commit()

    for season in db.query(Season).filter(Season.series_id == series_id).all():
        season_data = tmdb_service.get_season_details(series.tmdb_id, season.season_number)
        if season_data:
            tmdb_service.apply_season_metadata(season, season_data, series.tmdb_id)
            db.add(season)
            for ep_data in season_data.get("episodes", []):
                ep = (
                    db.query(Episode)
                    .filter(
                        Episode.series_id == series_id,
                        Episode.season_number == ep_data.get("season_number"),
                        Episode.episode_number == ep_data.get("episode_number"),
                    )
                    .first()
                )
                if ep:
                    tmdb_service.apply_episode_metadata(ep, ep_data, series.tmdb_id)
                    db.add(ep)
    db.commit()
    return {"status": "refreshed"}
