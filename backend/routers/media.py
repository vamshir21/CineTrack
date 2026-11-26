"""
Library / media router.
"""
import json
import logging
import os
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from fastapi import Header
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Movie, TVSeries, Season, Episode, WatchHistory, Watchlist, Profile
from backend.services import tmdb_service

router = APIRouter(prefix="/api/library", tags=["library"])


class MarkWatchedRequest(BaseModel):
    media_type: str  # "movie", "episode", "season", "series"
    media_id: int


def _resolve_profile_id(x_profile_id: Optional[int], db: Session) -> int:
    if x_profile_id:
        return x_profile_id
    p = db.query(Profile).filter(Profile.is_admin == True).order_by(Profile.id.asc()).first()
    return p.id if p else 1


def _require_admin(x_profile_id: Optional[int], db: Session):
    """Enforce that only admin can delete movies/shows or modify library."""
    if x_profile_id:
        p = db.query(Profile).filter(Profile.id == x_profile_id).first()
        if p and not p.is_admin:
            raise HTTPException(
                status_code=403,
                detail="Admin privileges required to delete titles from the library or disk."
            )


# ── Progress helpers ───────────────────────────────────────────────────────────

def _get_progress(db: Session, media_type: str, media_id: int, profile_id: Optional[int] = None) -> dict:
    q = db.query(WatchHistory).filter(WatchHistory.media_type == media_type, WatchHistory.media_id == media_id)
    if profile_id:
        q = q.filter(WatchHistory.profile_id == profile_id)
    record = q.first()
    if not record:
        return {"position": 0.0, "duration": 0.0, "completed": False, "percentage": 0.0}
    pct = 0.0
    if record.duration_seconds and record.duration_seconds > 0:
        pct = round(record.position_seconds / record.duration_seconds * 100, 1)
    return {
        "position": record.position_seconds,
        "duration": record.duration_seconds,
        "completed": record.completed,
        "percentage": pct,
    }


def _series_progress(db: Session, series_id: int, profile_id: Optional[int] = None) -> dict:
    """Aggregate progress for a series: last-watched episode progress."""
    eps = db.query(Episode).filter(Episode.series_id == series_id).all()
    ep_ids = [e.id for e in eps]
    if not ep_ids:
        return {"position": 0.0, "duration": 0.0, "completed": False, "percentage": 0.0}

    q = db.query(WatchHistory).filter(WatchHistory.media_type == "episode", WatchHistory.media_id.in_(ep_ids))
    if profile_id:
        q = q.filter(WatchHistory.profile_id == profile_id)
    record = q.order_by(WatchHistory.watched_at.desc()).first()
    if not record:
        return {"position": 0.0, "duration": 0.0, "completed": False, "percentage": 0.0}
    pct = 0.0
    if record.duration_seconds and record.duration_seconds > 0:
        pct = round(record.position_seconds / record.duration_seconds * 100, 1)
    return {
        "position": record.position_seconds,
        "duration": record.duration_seconds,
        "completed": record.completed,
        "percentage": pct,
    }


# ── Serializers ────────────────────────────────────────────────────────────────

def _movie_out(movie: Movie, db: Session, profile_id: Optional[int] = None) -> dict:
    from backend.services.language_service import extract_media_languages
    progress = _get_progress(db, "movie", movie.id, profile_id)
    genres = []
    if movie.genres:
        try:
            genres = json.loads(movie.genres)
        except Exception:
            pass
    languages = extract_media_languages(movie.file_path)
    return {
        "id": movie.id,
        "title": movie.title,
        "file_path": movie.file_path,
        "tmdb_id": movie.tmdb_id,
        "overview": movie.overview,
        "release_date": movie.release_date,
        "runtime": movie.runtime,
        "poster_path": movie.poster_path,
        "backdrop_path": movie.backdrop_path,
        "genres": genres,
        "languages": languages,
        "vote_average": movie.vote_average,
        "added_at": movie.added_at.isoformat(),
        "file_size": movie.file_size,
        "progress": progress,
        "watched": progress["completed"],
        "media_type": "movie",
    }


def _season_out(season: Season) -> dict:
    return {
        "id": season.id,
        "series_id": season.series_id,
        "season_number": season.season_number,
        "name": season.name,
        "overview": season.overview,
        "poster_path": season.poster_path,
        "air_date": season.air_date,
        "episode_count": season.episode_count,
    }


def _episode_out(episode: Episode, db: Session, profile_id: Optional[int] = None) -> dict:
    from backend.services.language_service import extract_media_languages
    progress = _get_progress(db, "episode", episode.id, profile_id)
    series = db.query(TVSeries).filter(TVSeries.id == episode.series_id).first() if episode.series_id else None
    series_title = series.title if series else ""
    poster_path = series.poster_path if series else None
    backdrop_path = episode.still_path or (series.backdrop_path if series else None)
    languages = extract_media_languages(episode.file_path)
    return {
        "id": episode.id,
        "series_id": episode.series_id,
        "season_id": episode.season_id,
        "season_number": episode.season_number,
        "episode_number": episode.episode_number,
        "title": episode.title,
        "series_title": series_title,
        "file_path": episode.file_path,
        "overview": episode.overview or (series.overview if series else None),
        "still_path": episode.still_path,
        "poster_path": poster_path,
        "backdrop_path": backdrop_path,
        "air_date": episode.air_date,
        "runtime": episode.runtime,
        "file_size": episode.file_size,
        "languages": languages,
        "added_at": episode.added_at.isoformat() if episode.added_at else "",
        "progress": progress,
        "watched": progress["completed"],
        "media_type": "episode",
    }


def _series_out(series: TVSeries, db: Session, include_seasons: bool = False, profile_id: Optional[int] = None) -> dict:
    from backend.services.language_service import extract_media_languages
    progress = _series_progress(db, series.id, profile_id)
    genres = []
    if series.genres:
        try:
            genres = json.loads(series.genres)
        except Exception:
            pass
    first_ep = db.query(Episode).filter(Episode.series_id == series.id).first()
    languages = extract_media_languages(first_ep.file_path if first_ep else None)
    
    # Determine if series is completed for this profile
    eps = db.query(Episode).filter(Episode.series_id == series.id).all()
    ep_ids = [e.id for e in eps]
    is_series_watched = False
    if ep_ids:
        q = db.query(WatchHistory).filter(
            WatchHistory.media_type == "episode",
            WatchHistory.media_id.in_(ep_ids),
            WatchHistory.completed == True,
        )
        if profile_id:
            q = q.filter(WatchHistory.profile_id == profile_id)
        is_series_watched = q.count() >= len(ep_ids)

    out = {
        "id": series.id,
        "title": series.title,
        "tmdb_id": series.tmdb_id,
        "overview": series.overview,
        "first_air_date": series.first_air_date,
        "poster_path": series.poster_path,
        "backdrop_path": series.backdrop_path,
        "genres": genres,
        "languages": languages,
        "vote_average": series.vote_average,
        "number_of_seasons": series.number_of_seasons,
        "added_at": series.added_at.isoformat(),
        "folder_key": series.folder_key,
        "progress": progress,
        "watched": is_series_watched,
        "media_type": "series",
    }
    if include_seasons:
        seasons = db.query(Season).filter(Season.series_id == series.id).order_by(Season.season_number).all()
        out["seasons"] = [_season_out(s) for s in seasons]
    return out


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/movies")
def list_movies(
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db)
):
    profile_id = _resolve_profile_id(x_profile_id, db)
    movies = db.query(Movie).order_by(Movie.added_at.desc()).all()
    return [_movie_out(m, db, profile_id) for m in movies]


@router.get("/movies/{movie_id}")
def get_movie(
    movie_id: int,
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db)
):
    profile_id = _resolve_profile_id(x_profile_id, db)
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return _movie_out(movie, db, profile_id)


@router.delete("/movies/{movie_id}")
def delete_movie(
    movie_id: int,
    delete_file: bool = False,
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db)
):
    _require_admin(x_profile_id, db)
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    file_deleted = False
    if delete_file and movie.file_path:
        try:
            if os.path.exists(movie.file_path):
                os.remove(movie.file_path)
                file_deleted = True
                logger.info(f"Permanently deleted movie file from disk: {movie.file_path}")
        except Exception as e:
            logger.error(f"Failed to delete file {movie.file_path}: {e}")

    # Clean up watch history and watchlist entries
    db.query(WatchHistory).filter(
        WatchHistory.media_type == "movie",
        WatchHistory.media_id == movie_id
    ).delete(synchronize_session=False)

    db.query(Watchlist).filter(
        Watchlist.media_type == "movie",
        Watchlist.media_id == movie_id
    ).delete(synchronize_session=False)

    db.delete(movie)
    db.commit()
    return {"deleted": movie_id, "file_deleted": file_deleted}


@router.get("/series")
def list_series(
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db)
):
    profile_id = _resolve_profile_id(x_profile_id, db)
    series_list = db.query(TVSeries).order_by(TVSeries.added_at.desc()).all()
    return [_series_out(s, db, False, profile_id) for s in series_list]


@router.get("/series/{series_id}")
def get_series(
    series_id: int,
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db)
):
    profile_id = _resolve_profile_id(x_profile_id, db)
    series = db.query(TVSeries).filter(TVSeries.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    return _series_out(series, db, True, profile_id)


@router.get("/series/{series_id}/seasons/{season_num}/episodes")
def list_episodes(
    series_id: int,
    season_num: int,
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db)
):
    profile_id = _resolve_profile_id(x_profile_id, db)
    series = db.query(TVSeries).filter(TVSeries.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    episodes = (
        db.query(Episode)
        .filter(Episode.series_id == series_id, Episode.season_number == season_num)
        .order_by(Episode.episode_number)
        .all()
    )
    return [_episode_out(e, db, profile_id) for e in episodes]


@router.delete("/series/{series_id}")
def delete_series(
    series_id: int,
    delete_file: bool = False,
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db)
):
    _require_admin(x_profile_id, db)
    series = db.query(TVSeries).filter(TVSeries.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")

    episodes = db.query(Episode).filter(Episode.series_id == series_id).all()
    ep_ids = [e.id for e in episodes]

    files_deleted_count = 0
    if delete_file:
        for ep in episodes:
            if ep.file_path:
                try:
                    if os.path.exists(ep.file_path):
                        os.remove(ep.file_path)
                        files_deleted_count += 1
                        logger.info(f"Permanently deleted episode file from disk: {ep.file_path}")
                except Exception as e:
                    logger.error(f"Failed to delete episode file {ep.file_path}: {e}")

    # Clean up watch history for all episodes in this series
    if ep_ids:
        db.query(WatchHistory).filter(
            WatchHistory.media_type == "episode",
            WatchHistory.media_id.in_(ep_ids)
        ).delete(synchronize_session=False)

    # Clean up watchlist
    db.query(Watchlist).filter(
        Watchlist.media_type == "series",
        Watchlist.media_id == series_id
    ).delete(synchronize_session=False)

    # Delete series (cascades to seasons & episodes)
    db.delete(series)
    db.commit()
    return {"deleted": series_id, "files_deleted_count": files_deleted_count, "file_deleted": files_deleted_count > 0}


@router.delete("/episodes/{episode_id}")
def delete_episode(
    episode_id: int,
    delete_file: bool = False,
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db)
):
    _require_admin(x_profile_id, db)
    episode = db.query(Episode).filter(Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    file_deleted = False
    if delete_file and episode.file_path:
        try:
            if os.path.exists(episode.file_path):
                os.remove(episode.file_path)
                file_deleted = True
                logger.info(f"Permanently deleted episode file from disk: {episode.file_path}")
        except Exception as e:
            logger.error(f"Failed to delete episode file {episode.file_path}: {e}")

    # Delete watch history
    db.query(WatchHistory).filter(
        WatchHistory.media_type == "episode",
        WatchHistory.media_id == episode_id
    ).delete(synchronize_session=False)

    season_id = episode.season_id
    db.delete(episode)
    db.commit()

    # Update season episode count if needed
    if season_id:
        count = db.query(Episode).filter(Episode.season_id == season_id).count()
        season = db.query(Season).filter(Season.id == season_id).first()
        if season:
            season.episode_count = count
            db.commit()

    return {"deleted": episode_id, "file_deleted": file_deleted}


@router.get("/recently-added")
def recently_added(db: Session = Depends(get_db)):
    movies = db.query(Movie).order_by(Movie.added_at.desc()).limit(10).all()
    series = db.query(TVSeries).order_by(TVSeries.added_at.desc()).limit(10).all()
    combined = (
        [_movie_out(m, db) for m in movies] +
        [_series_out(s, db) for s in series]
    )
    combined.sort(key=lambda x: x["added_at"], reverse=True)
    return combined[:20]


@router.get("/random")
def get_random_item(exclude_id: Optional[int] = None, media_type: Optional[str] = None, db: Session = Depends(get_db)):
    """Fetch a random movie or TV series for Netflix-style 'Play Something' feature."""
    candidates = []
    if media_type != "series":
        q = db.query(Movie)
        if exclude_id and media_type == "movie":
            q = q.filter(Movie.id != exclude_id)
        movies = q.all()
        candidates.extend([_movie_out(m, db) for m in movies])
    if media_type != "movie":
        q = db.query(TVSeries)
        if exclude_id and media_type == "series":
            q = q.filter(TVSeries.id != exclude_id)
        series = q.all()
        candidates.extend([_series_out(s, db, include_seasons=True) for s in series])

    if not candidates:
        raise HTTPException(status_code=404, detail="No media available")
    return random.choice(candidates)


@router.get("/episodes/{episode_id}/next")
def get_next_episode(episode_id: int, db: Session = Depends(get_db)):
    """Fetch next episode in chronological order for this series."""
    cur = db.query(Episode).filter(Episode.id == episode_id).first()
    if not cur:
        raise HTTPException(status_code=404, detail="Episode not found")

    next_ep = (
        db.query(Episode)
        .filter(
            Episode.series_id == cur.series_id,
            (Episode.season_number > cur.season_number) |
            ((Episode.season_number == cur.season_number) & (Episode.episode_number > cur.episode_number))
        )
        .order_by(Episode.season_number.asc(), Episode.episode_number.asc())
        .first()
    )
    if not next_ep:
        return {"has_next": False, "next_episode": None}
    return {"has_next": True, "next_episode": _episode_out(next_ep, db)}


@router.get("/more-like-this/{media_type}/{item_id}")
def get_more_like_this(media_type: str, item_id: int, limit: int = 6, db: Session = Depends(get_db)):
    """Find related titles from the user's local library based on shared genres and similarity."""
    target_genres = set()
    if media_type == "movie":
        cur = db.query(Movie).filter(Movie.id == item_id).first()
        if not cur:
            raise HTTPException(status_code=404, detail="Movie not found")
        if cur.genres:
            try:
                target_genres = set(json.loads(cur.genres))
            except Exception:
                pass
    elif media_type in ["series", "tv"]:
        cur = db.query(TVSeries).filter(TVSeries.id == item_id).first()
        if not cur:
            raise HTTPException(status_code=404, detail="Series not found")
        if cur.genres:
            try:
                target_genres = set(json.loads(cur.genres))
            except Exception:
                pass
    else:
        raise HTTPException(status_code=400, detail="Invalid media_type")

    all_movies = db.query(Movie).all()
    all_series = db.query(TVSeries).all()

    candidates = []
    for m in all_movies:
        if media_type == "movie" and m.id == item_id:
            continue
        m_genres = set()
        if m.genres:
            try:
                m_genres = set(json.loads(m.genres))
            except Exception:
                pass
        overlap = len(target_genres.intersection(m_genres))
        score = overlap * 3 + (m.vote_average or 0) * 0.2
        if media_type == "movie":
            score += 1
        candidates.append((score, _movie_out(m, db)))

    for s in all_series:
        if media_type in ["series", "tv"] and s.id == item_id:
            continue
        s_genres = set()
        if s.genres:
            try:
                s_genres = set(json.loads(s.genres))
            except Exception:
                pass
        overlap = len(target_genres.intersection(s_genres))
        score = overlap * 3 + (s.vote_average or 0) * 0.2
        if media_type in ["series", "tv"]:
            score += 1
        candidates.append((score, _series_out(s, db)))

    candidates.sort(key=lambda x: x[0], reverse=True)
    return [c[1] for c in candidates[:limit]]



def _get_continue_watching_items(db: Session, limit: int = 20, profile_id: Optional[int] = None) -> list:
    """
    Build Netflix-style Continue Watching list scoped to active profile:
    - Movies: included if in-progress (> 0s) and not completed.
    - TV Series: if any episode has watch history, shows the currently in-progress episode.
      If the last watched episode was completed, automatically shows the NEXT unwatched episode (at 0s).
      Each TV series appears at most once, sorted by most recently watched.
    """
    q = db.query(WatchHistory)
    if profile_id:
        q = q.filter(WatchHistory.profile_id == profile_id)
    all_history = q.order_by(WatchHistory.watched_at.desc()).all()

    items = []
    seen_series_ids = set()
    seen_movie_ids = set()

    for rec in all_history:
        # 1. Movie handling
        if rec.media_type == "movie":
            m = db.query(Movie).filter(Movie.id == rec.media_id).first()
            if not m:
                ep = db.query(Episode).filter(Episode.id == rec.media_id).first()
                if ep:
                    rec.media_type = "episode"
                    db.commit()
                else:
                    continue
            else:
                if m.id in seen_movie_ids:
                    continue
                seen_movie_ids.add(m.id)
                # Only show movie if in-progress and not completed
                if rec.position_seconds > 0 and not rec.completed:
                    items.append(_movie_out(m, db, profile_id))

        # 2. Episode handling
        if rec.media_type == "episode":
            ep = db.query(Episode).filter(Episode.id == rec.media_id).first()
            if not ep or not ep.series_id:
                continue

            series_id = ep.series_id
            if series_id in seen_series_ids:
                continue
            seen_series_ids.add(series_id)

            series_eps = (
                db.query(Episode)
                .filter(Episode.series_id == series_id)
                .order_by(Episode.season_number.asc(), Episode.episode_number.asc())
                .all()
            )
            series_ep_ids = [e.id for e in series_eps]

            # A. Check if there is an episode currently in-progress for this series for this profile
            in_prog_q = db.query(WatchHistory).filter(
                WatchHistory.media_type == "episode",
                WatchHistory.media_id.in_(series_ep_ids),
                WatchHistory.position_seconds > 0,
                WatchHistory.completed == False,
            )
            if profile_id:
                in_prog_q = in_prog_q.filter(WatchHistory.profile_id == profile_id)
            in_prog_hist = in_prog_q.order_by(WatchHistory.watched_at.desc()).first()

            if in_prog_hist:
                target_ep = db.query(Episode).filter(Episode.id == in_prog_hist.media_id).first()
                if target_ep:
                    items.append(_episode_out(target_ep, db, profile_id))
                    if len(items) >= limit:
                        break
                    continue

            # B. Last watched episode was completed: find next episode chronologically
            last_hist_q = db.query(WatchHistory).filter(
                WatchHistory.media_type == "episode",
                WatchHistory.media_id.in_(series_ep_ids),
            )
            if profile_id:
                last_hist_q = last_hist_q.filter(WatchHistory.profile_id == profile_id)
            last_hist = last_hist_q.order_by(WatchHistory.watched_at.desc()).first()

            if last_hist:
                last_ep = db.query(Episode).filter(Episode.id == last_hist.media_id).first()
                if last_ep:
                    next_ep = (
                        db.query(Episode)
                        .filter(
                            Episode.series_id == series_id,
                            (Episode.season_number > last_ep.season_number) |
                            ((Episode.season_number == last_ep.season_number) & (Episode.episode_number > last_ep.episode_number))
                        )
                        .order_by(Episode.season_number.asc(), Episode.episode_number.asc())
                        .first()
                    )
                    if next_ep:
                        ep_out = _episode_out(next_ep, db, profile_id)
                        ep_out["is_up_next"] = True
                        items.append(ep_out)
                        if len(items) >= limit:
                            break
                        continue

        if len(items) >= limit:
            break

    return items


@router.get("/continue-watching")
def continue_watching(
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db)
):
    profile_id = _resolve_profile_id(x_profile_id, db)
    return _get_continue_watching_items(db, limit=20, profile_id=profile_id)


@router.get("/home")
def home(
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db)
):
    profile_id = _resolve_profile_id(x_profile_id, db)
    # All items for featured
    all_movies = db.query(Movie).all()
    all_series = db.query(TVSeries).all()

    all_items = [_movie_out(m, db, profile_id) for m in all_movies] + [_series_out(s, db, False, profile_id) for s in all_series]
    featured = random.sample(all_items, min(5, len(all_items)))

    # Rails scoped to active profile
    continue_watching_items = _get_continue_watching_items(db, limit=20, profile_id=profile_id)

    recent_movies = db.query(Movie).order_by(Movie.added_at.desc()).limit(10).all()
    recent_series = db.query(TVSeries).order_by(TVSeries.added_at.desc()).limit(10).all()
    recently_added_items = (
        [_movie_out(m, db, profile_id) for m in recent_movies] +
        [_series_out(s, db, False, profile_id) for s in recent_series]
    )
    recently_added_items.sort(key=lambda x: x["added_at"], reverse=True)

    movies_rail = db.query(Movie).order_by(Movie.vote_average.desc().nullslast()).limit(20).all()
    series_rail = db.query(TVSeries).order_by(TVSeries.added_at.desc()).limit(20).all()

    # Watchlist scoped to active profile
    watchlist_items_raw = (
        db.query(Watchlist)
        .filter(Watchlist.profile_id == profile_id)
        .order_by(Watchlist.added_at.desc())
        .limit(20)
        .all()
    )
    watchlist_items = []
    for w in watchlist_items_raw:
        if w.media_type == "movie":
            m = db.query(Movie).filter(Movie.id == w.media_id).first()
            if m:
                watchlist_items.append(_movie_out(m, db, profile_id))
        elif w.media_type == "series":
            s = db.query(TVSeries).filter(TVSeries.id == w.media_id).first()
            if s:
                watchlist_items.append(_series_out(s, db, False, profile_id))

    return {
        "featured": featured,
        "rails": {
            "continue_watching": continue_watching_items,
            "recently_added": recently_added_items[:20],
            "popular_movies": [_movie_out(m, db, profile_id) for m in movies_rail],
            "all_series": [_series_out(s, db, False, profile_id) for s in series_rail],
            "watchlist": watchlist_items,
        },
    }


@router.post("/watched")
def mark_watched(
    body: MarkWatchedRequest,
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db)
):
    """Mark a movie, episode, season, or entire series as watched for the active profile."""
    profile_id = _resolve_profile_id(x_profile_id, db)
    now = datetime.now(timezone.utc)
    if body.media_type == "movie":
        movie = db.query(Movie).filter(Movie.id == body.media_id).first()
        if not movie:
            raise HTTPException(status_code=404, detail="Movie not found")
        dur = float((movie.runtime or 90) * 60)
        hist = db.query(WatchHistory).filter(
            WatchHistory.profile_id == profile_id,
            WatchHistory.media_type == "movie",
            WatchHistory.media_id == body.media_id
        ).first()
        if not hist:
            hist = WatchHistory(profile_id=profile_id, media_type="movie", media_id=body.media_id)
            db.add(hist)
        hist.position_seconds = dur
        hist.duration_seconds = dur
        hist.completed = True
        hist.watched_at = now
    elif body.media_type == "episode":
        ep = db.query(Episode).filter(Episode.id == body.media_id).first()
        if not ep:
            raise HTTPException(status_code=404, detail="Episode not found")
        dur = float((ep.runtime or 45) * 60)
        hist = db.query(WatchHistory).filter(
            WatchHistory.profile_id == profile_id,
            WatchHistory.media_type == "episode",
            WatchHistory.media_id == body.media_id
        ).first()
        if not hist:
            hist = WatchHistory(profile_id=profile_id, media_type="episode", media_id=body.media_id)
            db.add(hist)
        hist.position_seconds = dur
        hist.duration_seconds = dur
        hist.completed = True
        hist.watched_at = now
    elif body.media_type == "season":
        season = db.query(Season).filter(Season.id == body.media_id).first()
        if not season:
            raise HTTPException(status_code=404, detail="Season not found")
        eps = db.query(Episode).filter(Episode.season_id == body.media_id).all()
        for ep in eps:
            dur = float((ep.runtime or 45) * 60)
            hist = db.query(WatchHistory).filter(
                WatchHistory.profile_id == profile_id,
                WatchHistory.media_type == "episode",
                WatchHistory.media_id == ep.id
            ).first()
            if not hist:
                hist = WatchHistory(profile_id=profile_id, media_type="episode", media_id=ep.id)
                db.add(hist)
            hist.position_seconds = dur
            hist.duration_seconds = dur
            hist.completed = True
            hist.watched_at = now
    elif body.media_type == "series":
        series = db.query(TVSeries).filter(TVSeries.id == body.media_id).first()
        if not series:
            raise HTTPException(status_code=404, detail="Series not found")
        eps = db.query(Episode).filter(Episode.series_id == body.media_id).all()
        for ep in eps:
            dur = float((ep.runtime or 45) * 60)
            hist = db.query(WatchHistory).filter(
                WatchHistory.profile_id == profile_id,
                WatchHistory.media_type == "episode",
                WatchHistory.media_id == ep.id
            ).first()
            if not hist:
                hist = WatchHistory(profile_id=profile_id, media_type="episode", media_id=ep.id)
                db.add(hist)
            hist.position_seconds = dur
            hist.duration_seconds = dur
            hist.completed = True
            hist.watched_at = now
    else:
        raise HTTPException(status_code=400, detail="Invalid media_type")

    db.commit()
    return {"status": "marked_watched", "media_type": body.media_type, "media_id": body.media_id, "profile_id": profile_id}


@router.post("/unwatched")
def mark_unwatched(
    body: MarkWatchedRequest,
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db)
):
    """Mark a movie, episode, season, or entire series as unwatched for the active profile."""
    profile_id = _resolve_profile_id(x_profile_id, db)
    if body.media_type == "movie":
        db.query(WatchHistory).filter(
            WatchHistory.profile_id == profile_id,
            WatchHistory.media_type == "movie",
            WatchHistory.media_id == body.media_id
        ).delete(synchronize_session=False)
    elif body.media_type == "episode":
        db.query(WatchHistory).filter(
            WatchHistory.profile_id == profile_id,
            WatchHistory.media_type == "episode",
            WatchHistory.media_id == body.media_id
        ).delete(synchronize_session=False)
    elif body.media_type == "season":
        eps = db.query(Episode.id).filter(Episode.season_id == body.media_id).all()
        ep_ids = [e[0] for e in eps]
        if ep_ids:
            db.query(WatchHistory).filter(
                WatchHistory.profile_id == profile_id,
                WatchHistory.media_type == "episode",
                WatchHistory.media_id.in_(ep_ids)
            ).delete(synchronize_session=False)
    elif body.media_type == "series":
        eps = db.query(Episode.id).filter(Episode.series_id == body.media_id).all()
        ep_ids = [e[0] for e in eps]
        if ep_ids:
            db.query(WatchHistory).filter(
                WatchHistory.profile_id == profile_id,
                WatchHistory.media_type == "episode",
                WatchHistory.media_id.in_(ep_ids)
            ).delete(synchronize_session=False)
    else:
        raise HTTPException(status_code=400, detail="Invalid media_type")

    db.commit()
    return {"status": "marked_unwatched", "media_type": body.media_type, "media_id": body.media_id, "profile_id": profile_id}


@router.get("/stats")
def get_library_stats(db: Session = Depends(get_db)):
    """Return comprehensive library statistics for the dashboard."""
    total_movies = db.query(Movie).count()
    total_series = db.query(TVSeries).count()
    total_seasons = db.query(Season).count()
    total_episodes = db.query(Episode).count()

    movie_sizes = db.query(Movie.file_size).all()
    ep_sizes = db.query(Episode.file_size).all()
    total_size_bytes = sum(m[0] or 0 for m in movie_sizes) + sum(e[0] or 0 for e in ep_sizes)

    if total_size_bytes >= 1024 ** 4:
        total_size_formatted = f"{total_size_bytes / (1024 ** 4):.2f} TB"
    elif total_size_bytes >= 1024 ** 3:
        total_size_formatted = f"{total_size_bytes / (1024 ** 3):.2f} GB"
    elif total_size_bytes >= 1024 ** 2:
        total_size_formatted = f"{total_size_bytes / (1024 ** 2):.1f} MB"
    else:
        total_size_formatted = f"{total_size_bytes} B"

    watch_records = db.query(WatchHistory.position_seconds, WatchHistory.completed).all()
    total_watch_seconds = sum(w[0] or 0 for w in watch_records)
    completed_titles = sum(1 for w in watch_records if w[1])

    hours = int(total_watch_seconds // 3600)
    minutes = int((total_watch_seconds % 3600) // 60)
    total_watch_formatted = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"

    return {
        "total_movies": total_movies,
        "total_series": total_series,
        "total_seasons": total_seasons,
        "total_episodes": total_episodes,
        "total_size_bytes": total_size_bytes,
        "total_size_formatted": total_size_formatted,
        "total_watch_seconds": total_watch_seconds,
        "total_watch_formatted": total_watch_formatted,
        "completed_titles": completed_titles,
    }


@router.get("/collections")
def get_library_collections(db: Session = Depends(get_db)):
    """Return all movie franchises & collections represented in the user's local library."""
    # Backfill collection metadata for movies that have tmdb_id but missing collection_id
    tmdb_service.sync_local_movie_collections(db)

    movies = (
        db.query(Movie)
        .filter(Movie.collection_id.isnot(None))
        .order_by(Movie.release_date.asc())
        .all()
    )

    collections_map = {}
    for m in movies:
        cid = m.collection_id
        if cid not in collections_map:
            collections_map[cid] = {
                "collection_id": cid,
                "collection_name": m.collection_name or "Movie Collection",
                "movies": [],
            }
        collections_map[cid]["movies"].append(_movie_out(m, db))

    # Fetch collection poster & backdrop for each franchise
    result = []
    for cid, data in collections_map.items():
        coll_info = tmdb_service.get_collection(cid)
        result.append({
            "collection_id": cid,
            "collection_name": data["collection_name"],
            "overview": coll_info.get("overview") if coll_info else None,
            "poster_url": coll_info.get("poster_url") if coll_info else None,
            "backdrop_url": coll_info.get("backdrop_url") if coll_info else None,
            "local_movies_count": len(data["movies"]),
            "movies": data["movies"],
        })

    # Sort collections by count (largest franchises first)
    result.sort(key=lambda c: len(c["movies"]), reverse=True)
    return result


@router.get("/collections/{collection_id}")
def get_collection_franchise(collection_id: int, db: Session = Depends(get_db)):
    """Return full franchise overview cross-referenced with what parts exist locally."""
    coll_info = tmdb_service.get_collection(collection_id)
    if not coll_info:
        raise HTTPException(status_code=404, detail="Collection not found")

    local_movies = db.query(Movie).filter(Movie.tmdb_id.isnot(None)).all()
    local_by_tmdb = {m.tmdb_id: _movie_out(m, db) for m in local_movies}

    # Cross-reference parts
    parts_with_library_status = []
    for part in coll_info.get("parts", []):
        tmdb_id = part["id"]
        local_movie = local_by_tmdb.get(tmdb_id)
        parts_with_library_status.append({
            **part,
            "in_library": local_movie is not None,
            "local_movie": local_movie,
        })

    return {
        **coll_info,
        "parts": parts_with_library_status,
        "owned_count": sum(1 for p in parts_with_library_status if p["in_library"]),
        "total_count": len(parts_with_library_status),
    }


@router.get("/person/{person_id}/filmography")
def get_person_filmography(person_id: int, db: Session = Depends(get_db)):
    """Return person profile and filmography split into In-Library and Other Works with OTT badges."""
    person_details = tmdb_service.get_person_details(person_id)
    if not person_details:
        raise HTTPException(status_code=404, detail="Person not found")

    credits_data = tmdb_service.get_person_credits(person_id)
    all_credits = credits_data.get("cast", []) + credits_data.get("crew", [])

    # Deduplicate credits while keeping highest popularity
    seen_ids = {}
    for c in all_credits:
        cid = c["id"]
        if cid not in seen_ids or c.get("popularity", 0) > seen_ids[cid].get("popularity", 0):
            seen_ids[cid] = c

    local_movies = db.query(Movie).filter(Movie.tmdb_id.isnot(None)).all()
    local_series = db.query(TVSeries).filter(TVSeries.tmdb_id.isnot(None)).all()
    local_movies_by_tmdb = {m.tmdb_id: _movie_out(m, db) for m in local_movies}
    local_series_by_tmdb = {s.tmdb_id: _series_out(s, db) for s in local_series}

    in_library = []
    other_works = []

    for c in sorted(seen_ids.values(), key=lambda x: x.get("popularity", 0), reverse=True):
        cid = c["id"]
        local_movie = local_movies_by_tmdb.get(cid)
        local_tv = local_series_by_tmdb.get(cid)
        local_item = local_movie or local_tv

        if local_item:
            in_library.append({
                **c,
                "in_library": True,
                "local_item": local_item,
            })
        else:
            other_works.append(c)

    # Attach OTT providers to top 16 other works
    annotated_other_works = []
    for c in other_works[:16]:
        providers = tmdb_service.get_watch_providers(c.get("media_type", "movie"), c["id"])
        annotated_other_works.append({
            **c,
            "in_library": False,
            "providers": providers,
        })

    return {
        "person": person_details,
        "in_library": in_library,
        "other_works": annotated_other_works,
        "total_credits": len(seen_ids),
    }


@router.get("/vibes")
def get_library_vibes(db: Session = Depends(get_db)):
    """Return all mood vibes with counts of local matching titles."""
    from backend.services import vibe_service
    return vibe_service.get_vibe_summary(db, _movie_out, _series_out)


@router.get("/vibes/surprise")
def get_vibe_surprise(vibe: Optional[str] = None, db: Session = Depends(get_db)):
    """Return a random surprise movie or series matching the vibe."""
    from backend.services import vibe_service
    surprise = vibe_service.get_random_vibe_surprise(db, vibe, _movie_out, _series_out)
    if not surprise:
        raise HTTPException(status_code=404, detail="No matching titles found for this vibe")
    return surprise


@router.get("/vibes/{vibe_key}")
def get_vibe_titles(vibe_key: str, db: Session = Depends(get_db)):
    """Return all library titles belonging to a specific vibe."""
    from backend.services import vibe_service
    data = vibe_service.get_vibe_items(db, vibe_key, _movie_out, _series_out)
    if not data["vibe"]:
        raise HTTPException(status_code=404, detail="Vibe not found")
    return data




