"""
Media scanner service: recursively scan registered folders for video files,
parse filenames, group TV episodes, create/update DB records.
"""
import json
import logging
import os
import re
import threading
from pathlib import Path
from typing import Optional

from backend.config import VIDEO_EXTENSIONS

logger = logging.getLogger(__name__)

# ── Global scan state ──────────────────────────────────────────────────────────
scan_state = {
    "running": False,
    "progress": 0,
    "total": 0,
    "current_file": "",
    "errors": [],
    "_cancel": False,
}
_scan_lock = threading.Lock()

# ── Filename parsing ───────────────────────────────────────────────────────────

QUALITY_TAGS = re.compile(
    r"[\.\s\-_\[]"
    r"(?:2160p|1080p|720p|480p|4K|UHD|WEB[\-\.]?DL|WEBRip|BluRay|Blu[\-\.]Ray|BRRip|BDRip|"
    r"x264|x265|HEVC|AVC|HDR|SDR|DV|AAC|DTS|AC3|FLAC|MP3|OPUS|TrueHD|REMUX|PROPER|REPACK|"
    r"Extended|Theatrical|Directors\.?Cut|Unrated|HDTV|WEB|NF|AMZN|DSNP|HMAX|"
    r"10bit|8bit|YIFY|YTS|RARBG|mkvcage|GalaxyRG|"
    r"S\d{2}.*)"  # cut off at season marker from quality list
    r".*$",
    re.IGNORECASE,
)

YEAR_PATTERN = re.compile(r"[\(\[\s\.\-_]?(19|20)\d{2}[\)\]\s\.\-_]?")

EP_PATTERNS = [
    # S01E01 or S01E01E02 or S01.E01
    re.compile(r"[Ss](\d{1,2})[\.\-_]?[Ee](\d{1,2})(?:[Ee]\d{1,2})?"),
    # 1x01
    re.compile(r"\b(\d{1,2})[xX](\d{2})\b"),
    # Season 1 Episode 1 or Season.1.Episode.5 or Season_1_Episode_5
    re.compile(r"[Ss]eason[\.\s\-_]*(\d{1,2})[\.\s\-_]*[Ee]pisode[\.\s\-_]*(\d{1,2})", re.IGNORECASE),
]

SEASON_DIR_PATTERN = re.compile(r"^(?:[Ss]eason\s*(\d{1,2})|[Ss](\d{2}))$", re.IGNORECASE)


def _strip_quality(name: str) -> str:
    """Remove quality/codec tags and trim the name."""
    # Try stripping from first quality tag
    for tag_re in [
        re.compile(r"[\.\s\-_\[](2160p|1080p|720p|480p|4K|UHD|WEB[\-\.]?DL|WEBRip|BluRay|Blu[\-\.]?Ray|BRRip|BDRip|HDTV|x264|x265|HEVC|REMUX|PROPER|REPACK|YIFY|YTS|RARBG|mkvcage|GalaxyRG)", re.IGNORECASE),
    ]:
        m = tag_re.search(name)
        if m:
            name = name[:m.start()]

    # Strip year patterns
    name = re.sub(r"[\(\[\.\s\-](19|20)\d{2}[\)\]\.\s\-]?.*$", "", name)
    # Strip trailing separators
    name = re.sub(r"[\.\-_\s]+$", "", name)
    # Replace dots/underscores with spaces
    name = re.sub(r"[\.\-_]+", " ", name).strip()
    return name


def _normalize_series_name(title: str) -> str:
    """Normalize series title for grouping (lowercase, strip special chars, strip 'the ')."""
    n = title.lower()
    n = re.sub(r"[^a-z0-9\s]", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    if n.startswith("the "):
        n = n[4:]
    return n


def _parse_episode(filepath: Path) -> Optional[tuple[str, int, int]]:
    """
    Try to detect TV episode from filename or parent directory name.
    Returns (series_title, season_number, episode_number) or None for movies.
    """
    name = filepath.stem
    parent_name = filepath.parent.name

    # Try episode patterns on the filename
    for pat in EP_PATTERNS:
        m = pat.search(name)
        if m:
            season = int(m.group(1))
            episode = int(m.group(2))
            # Clean title = everything before the match
            raw_title = name[:m.start()]
            title = _strip_quality(raw_title)
            if not title:
                # If parent is "Season 1" or "S01", title is in parent's parent
                if SEASON_DIR_PATTERN.match(parent_name):
                    title = _strip_quality(filepath.parent.parent.name)
                else:
                    title = _strip_quality(parent_name)
            return (title.strip() or "Unknown Series", season, episode)

    # Check parent directory for "Season 1" or "S01" and grandparent for title
    dm = SEASON_DIR_PATTERN.match(parent_name)
    if dm:
        season = int(dm.group(1) or dm.group(2))
        # Try episode number from filename
        ep_m = re.search(r"[Ee](\d{1,2})\b|[Ee]pisode\s*(\d{1,2})", name, re.IGNORECASE)
        episode = int(ep_m.group(1) or ep_m.group(2)) if ep_m else 1
        # Series title from grandparent
        grandparent = filepath.parent.parent.name
        title = _strip_quality(grandparent) or "Unknown Series"
        return (title.strip(), season, episode)

    return None


def _collect_video_files(folder: str) -> list[Path]:
    files = []
    for root, _dirs, fnames in os.walk(folder):
        for fname in fnames:
            p = Path(root) / fname
            if p.suffix.lower() in VIDEO_EXTENSIONS:
                files.append(p)
    return files


# ── Main scanner ───────────────────────────────────────────────────────────────

def _run_scan():
    from backend.database import SessionLocal
    from backend.models import MediaFolder, Movie, TVSeries, Season, Episode
    from backend.services import tmdb_service

    db = SessionLocal()
    try:
        folders = db.query(MediaFolder).all()
        all_files: list[Path] = []
        for folder in folders:
            if os.path.isdir(folder.path):
                all_files.extend(_collect_video_files(folder.path))

        with _scan_lock:
            scan_state["total"] = len(all_files)
            scan_state["progress"] = 0
            scan_state["errors"] = []

        # Existing file paths to skip duplicates
        existing_movies = {m.file_path for m in db.query(Movie).all()}
        existing_episodes = {e.file_path for e in db.query(Episode).all()}

        # In-memory series registry for this scan
        series_registry: dict[str, TVSeries] = {}
        for s in db.query(TVSeries).all():
            if s.folder_key:
                series_registry[s.folder_key] = s

        new_movies: list[Movie] = []
        new_series_ids: list[int] = []

        for i, fpath in enumerate(all_files):
            if scan_state.get("_cancel"):
                break

            with _scan_lock:
                scan_state["progress"] = i + 1
                scan_state["current_file"] = str(fpath)

            str_path = str(fpath)

            parsed = _parse_episode(fpath)
            if parsed:
                # TV episode
                if str_path in existing_episodes:
                    continue

                series_title, season_num, ep_num = parsed
                folder_key = _normalize_series_name(series_title)

                # Find or create series
                if folder_key not in series_registry:
                    series = db.query(TVSeries).filter(TVSeries.folder_key == folder_key).first()
                    if not series:
                        series = TVSeries(
                            title=series_title,
                            folder_key=folder_key,
                        )
                        db.add(series)
                        db.flush()
                        new_series_ids.append(series.id)
                    series_registry[folder_key] = series
                else:
                    series = series_registry[folder_key]

                # Find or create season
                season = (
                    db.query(Season)
                    .filter(Season.series_id == series.id, Season.season_number == season_num)
                    .first()
                )
                if not season:
                    season = Season(
                        series_id=series.id,
                        season_number=season_num,
                        name=f"Season {season_num}",
                        episode_count=0,
                    )
                    db.add(season)
                    db.flush()

                # Create episode
                ep_title = f"Episode {ep_num}"
                episode = Episode(
                    series_id=series.id,
                    season_id=season.id,
                    season_number=season_num,
                    episode_number=ep_num,
                    title=ep_title,
                    file_path=str_path,
                    file_size=fpath.stat().st_size if fpath.exists() else None,
                )
                db.add(episode)

                # Update season episode count
                season.episode_count = (season.episode_count or 0) + 1

            else:
                # Movie
                if str_path in existing_movies:
                    continue

                raw_name = fpath.stem
                title = _strip_quality(raw_name) or raw_name
                movie = Movie(
                    title=title.strip(),
                    file_path=str_path,
                    file_size=fpath.stat().st_size if fpath.exists() else None,
                )
                db.add(movie)
                db.flush()
                new_movies.append(movie)

        db.commit()

        # Update series season counts
        for series in series_registry.values():
            series.number_of_seasons = (
                db.query(Season).filter(Season.series_id == series.id).count()
            )
        db.commit()

        # TMDB auto-match for new unmatched items
        _auto_match_new(db, new_movies, series_registry, new_series_ids)

    except Exception as e:
        logger.exception(f"Scan error: {e}")
        with _scan_lock:
            scan_state["errors"].append(str(e))
    finally:
        db.close()
        with _scan_lock:
            scan_state["running"] = False
            scan_state["current_file"] = ""


def _auto_match_new(db, new_movies, series_registry, new_series_ids):
    """Attempt TMDB auto-match for newly scanned items."""
    from backend.services import tmdb_service

    api_key = tmdb_service._get_api_key()
    if not api_key:
        return  # No API key, skip

    # Auto-match movies
    for movie in new_movies:
        if movie.tmdb_id:
            continue
        try:
            candidates = tmdb_service.search_movies(movie.title)
            if candidates and candidates[0]["score"] >= 0.8:
                best = candidates[0]
                details = tmdb_service.get_movie_details(best["tmdb_id"])
                if details:
                    tmdb_service.apply_movie_metadata(movie, details)
                    db.add(movie)
        except Exception as e:
            logger.warning(f"Auto-match movie '{movie.title}': {e}")

    # Auto-match series
    for folder_key, series in series_registry.items():
        if series.tmdb_id:
            continue
        if series.id not in new_series_ids:
            continue
        try:
            candidates = tmdb_service.search_tv(series.title)
            if candidates and candidates[0]["score"] >= 0.8:
                best = candidates[0]
                details = tmdb_service.get_tv_details(best["tmdb_id"])
                if details:
                    tmdb_service.apply_series_metadata(series, details)
                    db.add(series)
                    # Fetch season details
                    for s in db.query(Season).filter(Season.series_id == series.id).all():
                        season_data = tmdb_service.get_season_details(series.tmdb_id, s.season_number)
                        if season_data:
                            tmdb_service.apply_season_metadata(s, season_data, series.tmdb_id)
                            db.add(s)
                            # Apply episode metadata
                            for ep_data in season_data.get("episodes", []):
                                ep = db.query(
                                    __import__("backend.models", fromlist=["Episode"]).Episode
                                ).filter(
                                    __import__("backend.models", fromlist=["Episode"]).Episode.series_id == series.id,
                                    __import__("backend.models", fromlist=["Episode"]).Episode.season_number == ep_data.get("season_number"),
                                    __import__("backend.models", fromlist=["Episode"]).Episode.episode_number == ep_data.get("episode_number"),
                                ).first()
                                if ep:
                                    tmdb_service.apply_episode_metadata(ep, ep_data, series.tmdb_id)
                                    db.add(ep)
        except Exception as e:
            logger.warning(f"Auto-match series '{series.title}': {e}")

    try:
        db.commit()
    except Exception as e:
        logger.warning(f"Auto-match commit failed: {e}")
        db.rollback()


def start_scan():
    """Start media scan in background thread."""
    with _scan_lock:
        if scan_state["running"]:
            return False
        scan_state["running"] = True
        scan_state["_cancel"] = False
        scan_state["progress"] = 0
        scan_state["total"] = 0
        scan_state["current_file"] = ""
        scan_state["errors"] = []

    t = threading.Thread(target=_run_scan, daemon=True)
    t.start()
    return True


def cancel_scan():
    """Signal running scan to stop."""
    with _scan_lock:
        scan_state["_cancel"] = True


def get_scan_status() -> dict:
    with _scan_lock:
        return {
            "running": scan_state["running"],
            "progress": scan_state["progress"],
            "total": scan_state["total"],
            "current_file": scan_state["current_file"],
            "errors": list(scan_state["errors"]),
        }
