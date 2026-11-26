"""
In-Browser HTTP 206 Partial Content Video Streaming Router.
Enables instant, hardware-accelerated playback on any LAN device (iPhone, Android, tablet, laptop, Smart TV).
Supports real audio track switching (remux copy) and WebVTT subtitle extraction via FFmpeg.
"""
import os
import json
import mimetypes
import logging
import subprocess
from typing import Optional, List, Dict, Any
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException, Depends, Header, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from backend.database import get_db
from backend.models import Movie, Episode, WatchHistory, Profile
from backend.config import STREAM_CACHE_DIR
from backend.services.language_service import ISO_639_1_MAP, extract_media_languages

# Ensure static-ffmpeg is available in PATH
try:
    import static_ffmpeg
    static_ffmpeg.add_paths()
except Exception:
    pass

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


def probe_media_streams(file_path: str) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Inspect real audio and subtitle tracks from media file using ffprobe."""
    audio_tracks: List[Dict[str, Any]] = []
    subtitle_tracks: List[Dict[str, Any]] = []

    if not file_path or not os.path.isfile(file_path):
        return audio_tracks, subtitle_tracks

    try:
        cmd = ["ffprobe", "-v", "error", "-show_streams", "-of", "json", file_path]
        out = subprocess.check_output(cmd, timeout=5)
        data = json.loads(out)
        streams = data.get("streams", [])

        # Detect fallback languages from filename
        filename_langs = extract_media_languages(file_path)

        a_idx = 0
        s_idx = 0
        for s in streams:
            ctype = s.get("codec_type")
            tags = s.get("tags") or {}
            lang_code = tags.get("language", "").lower()
            title = tags.get("title", "")
            channels = s.get("channels", 2)

            if ctype == "audio":
                lang_name = ISO_639_1_MAP.get(lang_code)
                if not lang_name and a_idx < len(filename_langs):
                    lang_name = filename_langs[a_idx]
                elif not lang_name:
                    lang_name = f"Audio Track {a_idx + 1}"

                label = f"{lang_name} [Original]" if a_idx == 0 else lang_name
                if channels == 6:
                    label += " 5.1"
                elif channels == 8:
                    label += " 7.1"

                audio_tracks.append({
                    "id": str(a_idx),
                    "stream_index": s.get("index"),
                    "label": label,
                    "language": lang_code[:2] if lang_code else "en",
                    "default": a_idx == 0,
                })
                a_idx += 1

            elif ctype == "subtitle":
                lang_name = ISO_639_1_MAP.get(lang_code)
                if not lang_name:
                    lang_name = "English" if s_idx == 0 else f"Subtitle {s_idx + 1}"

                label = f"{lang_name} [CC]" if s_idx == 0 else lang_name
                subtitle_tracks.append({
                    "id": str(s_idx),
                    "stream_index": s.get("index"),
                    "label": label,
                    "language": lang_code[:2] if lang_code else "en",
                    "codec": s.get("codec_name"),
                    "default": False,
                })
                s_idx += 1

    except Exception as e:
        logger.warning("ffprobe failed on %s: %s", file_path, e)

    # Fallback to filename detection if probe returned no audio
    if not audio_tracks:
        detected = extract_media_languages(file_path) if file_path else ["English"]
        for idx, lang in enumerate(detected):
            audio_tracks.append({
                "id": str(idx),
                "stream_index": idx,
                "label": f"{lang} [Original]" if idx == 0 else lang,
                "language": lang.lower()[:2],
                "default": idx == 0,
            })

    return audio_tracks, subtitle_tracks


def get_or_create_audio_remux(file_path: str, media_type: str, media_id: int, audio_index: int) -> str:
    """
    Remux video with selected audio track using ffmpeg stream-copy.
    Takes 2-6s once on NVMe SSD, then cached permanently for instant playback.
    """
    STREAM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = STREAM_CACHE_DIR / f"{media_type}_{media_id}_a{audio_index}.mkv"

    if cache_file.exists() and os.path.getsize(cache_file) > 1024 * 1024:
        return str(cache_file)

    temp_file = STREAM_CACHE_DIR / f"temp_{media_type}_{media_id}_a{audio_index}.mkv"
    try:
        cmd = [
            "ffmpeg", "-y", "-i", file_path,
            "-map", "0:v:0",
            "-map", f"0:a:{audio_index}",
            "-c", "copy",
            str(temp_file)
        ]
        logger.info("Starting audio remux: %s", " ".join(cmd))
        subprocess.check_call(cmd, timeout=30, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        os.replace(temp_file, cache_file)
        logger.info("Audio remux complete: %s (size: %d bytes)", cache_file, os.path.getsize(cache_file))
        return str(cache_file)
    except Exception as e:
        logger.error("Audio remux failed: %s", e)
        if temp_file.exists():
            temp_file.unlink()
        # Fallback to original file
        return file_path


def get_or_create_subtitle_vtt(file_path: str, media_type: str, media_id: int, subtitle_index: int) -> str:
    """Extract subtitle stream to WebVTT on demand and cache it."""
    STREAM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file = STREAM_CACHE_DIR / f"{media_type}_{media_id}_s{subtitle_index}.vtt"

    if cache_file.exists() and os.path.getsize(cache_file) > 0:
        return cache_file.read_text(encoding="utf-8", errors="ignore")

    try:
        cmd = [
            "ffmpeg", "-y", "-i", file_path,
            "-map", f"0:s:{subtitle_index}",
            "-f", "webvtt",
            "pipe:1"
        ]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        vtt_bytes, _ = proc.communicate(timeout=10)
        vtt_text = vtt_bytes.decode("utf-8", errors="ignore")

        if vtt_text.startswith("WEBVTT"):
            cache_file.write_text(vtt_text, encoding="utf-8")
            return vtt_text
    except Exception as e:
        logger.warning("Subtitle extraction failed for track %s on %s: %s", subtitle_index, file_path, e)

    fallback = "WEBVTT\n\nNOTE Subtitle stream not available as text\n"
    return fallback


@router.get("/movie/{movie_id}")
def stream_movie(
    movie_id: int,
    request: Request,
    audio: int = Query(0, description="Audio track index"),
    db: Session = Depends(get_db),
):
    """Stream a movie file to HTML5 <video> with byte-range seeking and audio track selection."""
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie or not movie.file_path:
        raise HTTPException(status_code=404, detail="Movie not found")

    file_to_stream = movie.file_path
    if audio > 0:
        file_to_stream = get_or_create_audio_remux(movie.file_path, "movie", movie_id, audio)

    return get_video_response(file_to_stream, request)


@router.get("/episode/{episode_id}")
def stream_episode(
    episode_id: int,
    request: Request,
    audio: int = Query(0, description="Audio track index"),
    db: Session = Depends(get_db),
):
    """Stream an episode file to HTML5 <video> with byte-range seeking and audio track selection."""
    ep = db.query(Episode).filter(Episode.id == episode_id).first()
    if not ep or not ep.file_path:
        raise HTTPException(status_code=404, detail="Episode not found")

    file_to_stream = ep.file_path
    if audio > 0:
        file_to_stream = get_or_create_audio_remux(ep.file_path, "episode", episode_id, audio)

    return get_video_response(file_to_stream, request)


class PrepareAudioPayload(BaseModel):
    audio_track: int


@router.post("/prepare-audio/{media_type}/{media_id}")
def prepare_audio_track(
    media_type: str,
    media_id: int,
    payload: PrepareAudioPayload,
    db: Session = Depends(get_db),
):
    """Prepare audio track remux ahead of switching video source."""
    if payload.audio_track == 0:
        return {"status": "ready"}

    file_path = None
    if media_type == "movie":
        movie = db.query(Movie).filter(Movie.id == media_id).first()
        if movie:
            file_path = movie.file_path
    elif media_type == "episode":
        ep = db.query(Episode).filter(Episode.id == media_id).first()
        if ep:
            file_path = ep.file_path

    if not file_path or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Media file not found")

    remux_path = get_or_create_audio_remux(file_path, media_type, media_id, payload.audio_track)
    return {"status": "ready", "path": remux_path}


@router.get("/subtitles/{media_type}/{media_id}")
def get_media_subtitles(
    media_type: str,
    media_id: int,
    track: int = Query(0, description="Subtitle track index"),
    db: Session = Depends(get_db),
):
    """Return WebVTT subtitle track for HTML5 <track> element."""
    file_path = None
    if media_type == "movie":
        movie = db.query(Movie).filter(Movie.id == media_id).first()
        if movie:
            file_path = movie.file_path
    elif media_type == "episode":
        ep = db.query(Episode).filter(Episode.id == media_id).first()
        if ep:
            file_path = ep.file_path

    if not file_path or not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Media file not found")

    vtt_content = get_or_create_subtitle_vtt(file_path, media_type, media_id, track)
    return Response(
        content=vtt_content,
        media_type="text/vtt",
        headers={"Content-Type": "text/vtt; charset=utf-8", "Access-Control-Allow-Origin": "*"}
    )


@router.get("/tracks/{media_type}/{media_id}")
def get_media_tracks(media_type: str, media_id: int, db: Session = Depends(get_db)):
    """Return available audio and subtitle tracks for a media item."""
    file_path = None
    if media_type == "movie":
        movie = db.query(Movie).filter(Movie.id == media_id).first()
        if movie:
            file_path = movie.file_path
    elif media_type == "episode":
        ep = db.query(Episode).filter(Episode.id == media_id).first()
        if ep:
            file_path = ep.file_path

    if not file_path or not os.path.isfile(file_path):
        return {
            "audio_tracks": [{"id": "0", "label": "Default Audio", "language": "en", "default": True}],
            "subtitle_tracks": [{"id": "off", "label": "Off", "language": "off", "default": True}],
        }

    audio_tracks, probed_subs = probe_media_streams(file_path)

    # Subtitle choices always include "Off"
    subtitle_tracks = [{"id": "off", "label": "Off", "language": "off", "default": True}]
    subtitle_tracks.extend(probed_subs)

    return {
        "audio_tracks": audio_tracks,
        "subtitle_tracks": subtitle_tracks,
    }


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
