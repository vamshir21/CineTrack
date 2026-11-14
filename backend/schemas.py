from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


# ── MediaFolder ────────────────────────────────────────────────────────────────
class MediaFolderCreate(BaseModel):
    path: str
    name: str


class MediaFolderOut(BaseModel):
    id: int
    path: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Progress ───────────────────────────────────────────────────────────────────
class ProgressInfo(BaseModel):
    position: float = 0.0
    duration: float = 0.0
    completed: bool = False
    percentage: float = 0.0


# ── Movie ──────────────────────────────────────────────────────────────────────
class MovieOut(BaseModel):
    id: int
    title: str
    file_path: str
    tmdb_id: Optional[int] = None
    overview: Optional[str] = None
    release_date: Optional[str] = None
    runtime: Optional[int] = None
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    genres: Optional[list[str]] = None
    vote_average: Optional[float] = None
    added_at: datetime
    file_size: Optional[int] = None
    progress: Optional[ProgressInfo] = None
    media_type: str = "movie"

    model_config = {"from_attributes": True}


# ── TVSeries ───────────────────────────────────────────────────────────────────
class SeasonOut(BaseModel):
    id: int
    series_id: int
    season_number: int
    name: Optional[str] = None
    overview: Optional[str] = None
    poster_path: Optional[str] = None
    air_date: Optional[str] = None
    episode_count: Optional[int] = None

    model_config = {"from_attributes": True}


class EpisodeOut(BaseModel):
    id: int
    series_id: int
    season_id: Optional[int] = None
    season_number: int
    episode_number: int
    title: Optional[str] = None
    file_path: str
    overview: Optional[str] = None
    still_path: Optional[str] = None
    air_date: Optional[str] = None
    runtime: Optional[int] = None
    file_size: Optional[int] = None
    added_at: datetime
    progress: Optional[ProgressInfo] = None
    media_type: str = "episode"

    model_config = {"from_attributes": True}


class TVSeriesOut(BaseModel):
    id: int
    title: str
    tmdb_id: Optional[int] = None
    overview: Optional[str] = None
    first_air_date: Optional[str] = None
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    genres: Optional[list[str]] = None
    vote_average: Optional[float] = None
    number_of_seasons: Optional[int] = None
    added_at: datetime
    folder_key: Optional[str] = None
    seasons: Optional[list[SeasonOut]] = None
    progress: Optional[ProgressInfo] = None
    media_type: str = "series"

    model_config = {"from_attributes": True}


# ── WatchHistory ───────────────────────────────────────────────────────────────
class WatchHistoryOut(BaseModel):
    id: int
    media_type: str
    media_id: int
    position_seconds: float
    duration_seconds: float
    watched_at: datetime
    completed: bool

    model_config = {"from_attributes": True}


# ── Watchlist ──────────────────────────────────────────────────────────────────
class WatchlistCreate(BaseModel):
    media_type: str
    media_id: int


class WatchlistOut(BaseModel):
    id: int
    media_type: str
    media_id: int
    added_at: datetime
    item: Optional[Any] = None

    model_config = {"from_attributes": True}


# ── Settings ───────────────────────────────────────────────────────────────────
class SettingUpdate(BaseModel):
    value: str


class SettingsOut(BaseModel):
    key: str
    value: str

    model_config = {"from_attributes": True}


# ── Playback ───────────────────────────────────────────────────────────────────
class PlayRequest(BaseModel):
    file_path: str
    position: float = 0.0
    media_type: str
    media_id: int


class SeekRequest(BaseModel):
    position: float


class VolumeRequest(BaseModel):
    level: int


class SpeedRequest(BaseModel):
    rate: float


class SubtitleSelectRequest(BaseModel):
    track_id: int


class PlaybackStatus(BaseModel):
    playing: bool = False
    paused: bool = False
    file_path: Optional[str] = None
    media_type: Optional[str] = None
    media_id: Optional[int] = None
    position: float = 0.0
    duration: float = 0.0
    volume: int = 100
    speed: float = 1.0
    subtitle_tracks: list = []
    completed: bool = False
    completed_episode_id: Optional[int] = None


# ── Scanner ────────────────────────────────────────────────────────────────────
class ScanStatus(BaseModel):
    running: bool
    progress: int
    total: int
    current_file: str
    errors: list[str]


# ── TMDB ───────────────────────────────────────────────────────────────────────
class TMDBMatchRequest(BaseModel):
    tmdb_id: int


class TMDBCandidate(BaseModel):
    tmdb_id: int
    title: str
    year: Optional[str] = None
    overview: Optional[str] = None
    poster_path: Optional[str] = None
    score: float


# ── Home ───────────────────────────────────────────────────────────────────────
class HomeResponse(BaseModel):
    featured: list[Any] = []
    rails: dict[str, list[Any]] = {}
