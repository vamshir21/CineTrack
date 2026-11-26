"""
In-Browser HTTP 206 Partial Content Video Streaming Router.
Enables instant, hardware-accelerated playback on any LAN device (iPhone, Android, tablet, laptop, Smart TV)
without transcoding or third-party servers.
"""
import os
import mimetypes
import logging
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, Depends, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from backend.database import get_db
from backend.models import Movie, Episode, WatchHistory, Profile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/stream", tags=["stream"])


def parse_range_header(range_header: str, file_size: int) -> tuple[int, int]:
    """Parse 'Range: bytes=start-end' header into (start, end) offsets."""
    if not range_header or not range_header.startswith("bytes="):
        return 0, file_size - 1

    range_val = range_header.replace("bytes=", "").strip()
    parts = range_val.split("-")
    start = int(parts[0]) if parts[0] else 0
    end = int(parts[1]) if len(parts) > 1 and parts[1] else file_size - 1

    if start >= file_size:
        start = file_size - 1
    if end >= file_size:
        end = file_size - 1
    if start > end:
        start = end

    return start, end


def stream_file_chunk(path: str, start: int, end: int, chunk_size: int = 1024 * 1024):
    """Yield file chunks from start to end (1MB chunks for smooth buffer)."""
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            read_size = min(chunk_size, remaining)
            data = f.read(read_size)
            if not data:
                break
            remaining -= len(data)
            yield data


def get_video_response(file_path: str, request: Request):
    """Build HTTP 206 Partial Content or 200 OK StreamingResponse."""
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Media file not found on disk")

    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("Range")

    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".mkv":
            mime_type = "video/x-matroska"
        elif ext == ".mp4":
            mime_type = "video/mp4"
        elif ext == ".webm":
            mime_type = "video/webm"
        elif ext in [".avi", ".mov"]:
            mime_type = "video/quicktime" if ext == ".mov" else "video/x-msvideo"
        else:
            mime_type = "video/mp4"

    if range_header:
        start, end = parse_range_header(range_header, file_size)
        content_length = end - start + 1
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": mime_type,
        }
        return StreamingResponse(
            stream_file_chunk(file_path, start, end),
            status_code=206,
            headers=headers,
        )
    else:
        headers = {
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
            "Content-Type": mime_type,
        }
        return StreamingResponse(
            stream_file_chunk(file_path, 0, file_size - 1),
            status_code=200,
            headers=headers,
        )


@router.get("/movie/{movie_id}")
def stream_movie(movie_id: int, request: Request, db: Session = Depends(get_db)):
    """Stream a movie file to HTML5 <video> with byte-range seeking."""
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie or not movie.file_path:
        raise HTTPException(status_code=404, detail="Movie not found")
    return get_video_response(movie.file_path, request)


@router.get("/episode/{episode_id}")
def stream_episode(episode_id: int, request: Request, db: Session = Depends(get_db)):
    """Stream an episode file to HTML5 <video> with byte-range seeking."""
    ep = db.query(Episode).filter(Episode.id == episode_id).first()
    if not ep or not ep.file_path:
        raise HTTPException(status_code=404, detail="Episode not found")
    return get_video_response(ep.file_path, request)


class StreamProgressPayload(BaseModel):
    media_type: str  # 'movie' or 'episode'
    media_id: int
    position_seconds: float
    duration_seconds: float
    completed: bool = False


@router.post("/progress")
def update_stream_progress(
    payload: StreamProgressPayload,
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db),
):
    """
    Update watch progress for in-browser HTML5 player.
    Scoped directly to the active profile!
    """
    # Resolve profile ID (default to first admin if not passed)
    profile_id = x_profile_id
    if not profile_id:
        p = db.query(Profile).filter(Profile.is_admin == True).order_by(Profile.id.asc()).first()
        profile_id = p.id if p else 1

    progress = db.query(WatchHistory).filter(
        WatchHistory.profile_id == profile_id,
        WatchHistory.media_type == payload.media_type,
        WatchHistory.media_id == payload.media_id,
    ).first()

    now = datetime.now(timezone.utc)
    completed = payload.completed or (
        payload.duration_seconds > 0
        and (payload.position_seconds / payload.duration_seconds) >= 0.92
    )

    if progress:
        progress.position_seconds = payload.position_seconds
        progress.duration_seconds = payload.duration_seconds
        progress.watched_at = now
        progress.completed = completed
    else:
        progress = WatchHistory(
            profile_id=profile_id,
            media_type=payload.media_type,
            media_id=payload.media_id,
            position_seconds=payload.position_seconds,
            duration_seconds=payload.duration_seconds,
            watched_at=now,
            completed=completed,
        )
        db.add(progress)

    db.commit()
    return {"status": "ok", "profile_id": profile_id, "completed": completed}
