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
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Movie, TVSeries, Season, Episode, WatchHistory, Watchlist

router = APIRouter(prefix="/api/library", tags=["library"])


class MarkWatchedRequest(BaseModel):
    media_type: str  # "movie", "episode", "season", "series"
    media_id: int



# ── Progress helpers ───────────────────────────────────────────────────────────

def _get_progress(db: Session, media_type: str, media_id: int) -> dict:
    record = (
        db.query(WatchHistory)
        .filter(WatchHistory.media_type == media_type, WatchHistory.media_id == media_id)
        .first()
    )
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


def _series_progress(db: Session, series_id: int) -> dict:
    """Aggregate progress for a series: last-watched episode progress."""
    # Find most recently watched episode in this series
    eps = db.query(Episode).filter(Episode.series_id == series_id).all()
    ep_ids = [e.id for e in eps]
    if not ep_ids:
        return {"position": 0.0, "duration": 0.0, "completed": False, "percentage": 0.0}

    record = (
        db.query(WatchHistory)
        .filter(WatchHistory.media_type == "episode", WatchHistory.media_id.in_(ep_ids))
        .order_by(WatchHistory.watched_at.desc())
        .first()
    )
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

def _movie_out(movie: Movie, db: Session) -> dict:
    progress = _get_progress(db, "movie", movie.id)
    genres = []
    if movie.genres:
        try:
            genres = json.loads(movie.genres)
        except Exception:
            pass
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
        "vote_average": movie.vote_average,
        "added_at": movie.added_at.isoformat(),
        "file_size": movie.file_size,
        "progress": progress,
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


def _episode_out(episode: Episode, db: Session) -> dict:
    progress = _get_progress(db, "episode", episode.id)
    series = db.query(TVSeries).filter(TVSeries.id == episode.series_id).first() if episode.series_id else None
    series_title = series.title if series else ""
    poster_path = series.poster_path if series else None
    backdrop_path = episode.still_path or (series.backdrop_path if series else None)
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
        "added_at": episode.added_at.isoformat() if episode.added_at else "",
        "progress": progress,
        "media_type": "episode",
    }


def _series_out(series: TVSeries, db: Session, include_seasons: bool = False) -> dict:
    progress = _series_progress(db, series.id)
    genres = []
    if series.genres:
        try:
            genres = json.loads(series.genres)
        except Exception:
            pass
    out = {
        "id": series.id,
        "title": series.title,
        "tmdb_id": series.tmdb_id,
        "overview": series.overview,
        "first_air_date": series.first_air_date,
        "poster_path": series.poster_path,
        "backdrop_path": series.backdrop_path,
        "genres": genres,
        "vote_average": series.vote_average,
        "number_of_seasons": series.number_of_seasons,
        "added_at": series.added_at.isoformat(),
        "folder_key": series.folder_key,
        "progress": progress,
        "media_type": "series",
    }
    if include_seasons:
        seasons = db.query(Season).filter(Season.series_id == series.id).order_by(Season.season_number).all()
        out["seasons"] = [_season_out(s) for s in seasons]
    return out


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/movies")
def list_movies(db: Session = Depends(get_db)):
    movies = db.query(Movie).order_by(Movie.added_at.desc()).all()
    return [_movie_out(m, db) for m in movies]


@router.get("/movies/{movie_id}")
def get_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return _movie_out(movie, db)


@router.delete("/movies/{movie_id}")
def delete_movie(movie_id: int, delete_file: bool = False, db: Session = Depends(get_db)):
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
def list_series(db: Session = Depends(get_db)):
    series_list = db.query(TVSeries).order_by(TVSeries.added_at.desc()).all()
    return [_series_out(s, db) for s in series_list]


@router.get("/series/{series_id}")
def get_series(series_id: int, db: Session = Depends(get_db)):
    series = db.query(TVSeries).filter(TVSeries.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    return _series_out(series, db, include_seasons=True)


@router.get("/series/{series_id}/seasons/{season_num}/episodes")
def list_episodes(series_id: int, season_num: int, db: Session = Depends(get_db)):
    series = db.query(TVSeries).filter(TVSeries.id == series_id).first()
    if not series:
        raise HTTPException(status_code=404, detail="Series not found")
    episodes = (
        db.query(Episode)
        .filter(Episode.series_id == series_id, Episode.season_number == season_num)
        .order_by(Episode.episode_number)
        .all()
    )
    return [_episode_out(e, db) for e in episodes]


@router.delete("/series/{series_id}")
def delete_series(series_id: int, delete_file: bool = False, db: Session = Depends(get_db)):
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
def delete_episode(episode_id: int, delete_file: bool = False, db: Session = Depends(get_db)):
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


def _get_continue_watching_items(db: Session, limit: int = 20) -> list:
    """
    Build Netflix-style Continue Watching list:
    - Movies: included if in-progress (> 0s) and not completed.
    - TV Series: if any episode has watch history, shows the currently in-progress episode.
      If the last watched episode was completed, automatically shows the NEXT unwatched episode (at 0s).
      Each TV series appears at most once, sorted by most recently watched.
    """
    all_history = (
        db.query(WatchHistory)
        .order_by(WatchHistory.watched_at.desc())
        .all()
    )

    items = []
    seen_series_ids = set()
    seen_movie_ids = set()

    for rec in all_history:
        # 1. Movie handling
        if rec.media_type == "movie":
            m = db.query(Movie).filter(Movie.id == rec.media_id).first()
            if not m:
                # Self-healing: check if this ID is an Episode
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
                    items.append(_movie_out(m, db))

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

            # A. Check if there is an episode currently in-progress for this series
            in_prog_hist = (
                db.query(WatchHistory)
                .filter(
                    WatchHistory.media_type == "episode",
                    WatchHistory.media_id.in_(series_ep_ids),
                    WatchHistory.position_seconds > 0,
                    WatchHistory.completed == False,
                )
                .order_by(WatchHistory.watched_at.desc())
                .first()
            )

            if in_prog_hist:
                target_ep = db.query(Episode).filter(Episode.id == in_prog_hist.media_id).first()
                if target_ep:
                    items.append(_episode_out(target_ep, db))
                    if len(items) >= limit:
                        break
                    continue

            # B. Last watched episode was completed: find next episode chronologically
            last_hist = (
                db.query(WatchHistory)
                .filter(
                    WatchHistory.media_type == "episode",
                    WatchHistory.media_id.in_(series_ep_ids),
                )
                .order_by(WatchHistory.watched_at.desc())
                .first()
            )
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
                        ep_out = _episode_out(next_ep, db)
                        ep_out["is_up_next"] = True
                        items.append(ep_out)
                        if len(items) >= limit:
                            break
                        continue

        if len(items) >= limit:
            break

    return items


@router.get("/continue-watching")
def continue_watching(db: Session = Depends(get_db)):
    return _get_continue_watching_items(db, limit=20)


@router.get("/home")
def home(db: Session = Depends(get_db)):
    # All items for featured
    all_movies = db.query(Movie).all()
    all_series = db.query(TVSeries).all()

    all_items = [_movie_out(m, db) for m in all_movies] + [_series_out(s, db) for s in all_series]
    featured = random.sample(all_items, min(5, len(all_items)))

    # Rails
    continue_watching_items = _get_continue_watching_items(db, limit=20)

    recent_movies = db.query(Movie).order_by(Movie.added_at.desc()).limit(10).all()
    recent_series = db.query(TVSeries).order_by(TVSeries.added_at.desc()).limit(10).all()
    recently_added_items = (
        [_movie_out(m, db) for m in recent_movies] +
        [_series_out(s, db) for s in recent_series]
    )
    recently_added_items.sort(key=lambda x: x["added_at"], reverse=True)

    movies_rail = db.query(Movie).order_by(Movie.vote_average.desc().nullslast()).limit(20).all()

    series_rail = db.query(TVSeries).order_by(TVSeries.added_at.desc()).limit(20).all()

    # Watchlist
    watchlist_items_raw = db.query(Watchlist).order_by(Watchlist.added_at.desc()).limit(20).all()
    watchlist_items = []
    for w in watchlist_items_raw:
        if w.media_type == "movie":
            m = db.query(Movie).filter(Movie.id == w.media_id).first()
            if m:
                watchlist_items.append(_movie_out(m, db))
        elif w.media_type == "series":
            s = db.query(TVSeries).filter(TVSeries.id == w.media_id).first()
            if s:
                watchlist_items.append(_series_out(s, db))

    return {
        "featured": featured,
        "rails": {
            "continue_watching": continue_watching_items,
            "recently_added": recently_added_items[:20],
            "popular_movies": [_movie_out(m, db) for m in movies_rail],
            "all_series": [_series_out(s, db) for s in series_rail],
            "watchlist": watchlist_items,
        },
    }


@router.post("/watched")
def mark_watched(body: MarkWatchedRequest, db: Session = Depends(get_db)):
    """Mark a movie, episode, season, or entire series as watched."""
    now = datetime.now(timezone.utc)
    if body.media_type == "movie":
        movie = db.query(Movie).filter(Movie.id == body.media_id).first()
        if not movie:
            raise HTTPException(status_code=404, detail="Movie not found")
        dur = float((movie.runtime or 90) * 60)
        hist = db.query(WatchHistory).filter(WatchHistory.media_type == "movie", WatchHistory.media_id == body.media_id).first()
        if not hist:
            hist = WatchHistory(media_type="movie", media_id=body.media_id)
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
        hist = db.query(WatchHistory).filter(WatchHistory.media_type == "episode", WatchHistory.media_id == body.media_id).first()
        if not hist:
            hist = WatchHistory(media_type="episode", media_id=body.media_id)
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
            hist = db.query(WatchHistory).filter(WatchHistory.media_type == "episode", WatchHistory.media_id == ep.id).first()
            if not hist:
                hist = WatchHistory(media_type="episode", media_id=ep.id)
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
            hist = db.query(WatchHistory).filter(WatchHistory.media_type == "episode", WatchHistory.media_id == ep.id).first()
            if not hist:
                hist = WatchHistory(media_type="episode", media_id=ep.id)
                db.add(hist)
            hist.position_seconds = dur
            hist.duration_seconds = dur
            hist.completed = True
            hist.watched_at = now
    else:
        raise HTTPException(status_code=400, detail="Invalid media_type")

    db.commit()
    return {"status": "marked_watched", "media_type": body.media_type, "media_id": body.media_id}


@router.post("/unwatched")
def mark_unwatched(body: MarkWatchedRequest, db: Session = Depends(get_db)):
    """Mark a movie, episode, season, or entire series as unwatched."""
    if body.media_type == "movie":
        db.query(WatchHistory).filter(
            WatchHistory.media_type == "movie",
            WatchHistory.media_id == body.media_id
        ).delete(synchronize_session=False)
    elif body.media_type == "episode":
        db.query(WatchHistory).filter(
            WatchHistory.media_type == "episode",
            WatchHistory.media_id == body.media_id
        ).delete(synchronize_session=False)
    elif body.media_type == "season":
        eps = db.query(Episode.id).filter(Episode.season_id == body.media_id).all()
        ep_ids = [e[0] for e in eps]
        if ep_ids:
            db.query(WatchHistory).filter(
                WatchHistory.media_type == "episode",
                WatchHistory.media_id.in_(ep_ids)
            ).delete(synchronize_session=False)
    elif body.media_type == "series":
        eps = db.query(Episode.id).filter(Episode.series_id == body.media_id).all()
        ep_ids = [e[0] for e in eps]
        if ep_ids:
            db.query(WatchHistory).filter(
                WatchHistory.media_type == "episode",
                WatchHistory.media_id.in_(ep_ids)
            ).delete(synchronize_session=False)
    else:
        raise HTTPException(status_code=400, detail="Invalid media_type")

    db.commit()
    return {"status": "marked_unwatched", "media_type": body.media_type, "media_id": body.media_id}


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

