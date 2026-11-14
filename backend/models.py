import json
from datetime import datetime, timezone
from sqlalchemy import (
    Integer, String, Float, Boolean, DateTime, ForeignKey, Text, BigInteger
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.database import Base


def _utc_now():
    return datetime.now(timezone.utc)


class MediaFolder(Base):
    __tablename__ = "media_folders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    path: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    file_path: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    release_date: Mapped[str | None] = mapped_column(String, nullable=True)
    runtime: Mapped[int | None] = mapped_column(Integer, nullable=True)
    poster_path: Mapped[str | None] = mapped_column(String, nullable=True)
    backdrop_path: Mapped[str | None] = mapped_column(String, nullable=True)
    genres: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    vote_average: Mapped[float | None] = mapped_column(Float, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    @property
    def genres_list(self):
        if self.genres:
            try:
                return json.loads(self.genres)
            except Exception:
                return []
        return []


class TVSeries(Base):
    __tablename__ = "tv_series"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    tmdb_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_air_date: Mapped[str | None] = mapped_column(String, nullable=True)
    poster_path: Mapped[str | None] = mapped_column(String, nullable=True)
    backdrop_path: Mapped[str | None] = mapped_column(String, nullable=True)
    genres: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    vote_average: Mapped[float | None] = mapped_column(Float, nullable=True)
    number_of_seasons: Mapped[int | None] = mapped_column(Integer, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    folder_key: Mapped[str | None] = mapped_column(String, nullable=True)

    seasons: Mapped[list["Season"]] = relationship("Season", back_populates="series", cascade="all, delete-orphan")
    episodes: Mapped[list["Episode"]] = relationship("Episode", back_populates="series", cascade="all, delete-orphan")

    @property
    def genres_list(self):
        if self.genres:
            try:
                return json.loads(self.genres)
            except Exception:
                return []
        return []


class Season(Base):
    __tablename__ = "seasons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    series_id: Mapped[int] = mapped_column(Integer, ForeignKey("tv_series.id"), nullable=False)
    season_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    poster_path: Mapped[str | None] = mapped_column(String, nullable=True)
    air_date: Mapped[str | None] = mapped_column(String, nullable=True)
    episode_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    series: Mapped["TVSeries"] = relationship("TVSeries", back_populates="seasons")
    episodes: Mapped[list["Episode"]] = relationship("Episode", back_populates="season", cascade="all, delete-orphan")


class Episode(Base):
    __tablename__ = "episodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    series_id: Mapped[int] = mapped_column(Integer, ForeignKey("tv_series.id"), nullable=False)
    season_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("seasons.id"), nullable=True)
    season_number: Mapped[int] = mapped_column(Integer, nullable=False)
    episode_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    file_path: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    still_path: Mapped[str | None] = mapped_column(String, nullable=True)
    air_date: Mapped[str | None] = mapped_column(String, nullable=True)
    runtime: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)

    series: Mapped["TVSeries"] = relationship("TVSeries", back_populates="episodes")
    season: Mapped["Season | None"] = relationship("Season", back_populates="episodes")


class WatchHistory(Base):
    __tablename__ = "watch_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    media_type: Mapped[str] = mapped_column(String, nullable=False)  # 'movie' or 'episode'
    media_id: Mapped[int] = mapped_column(Integer, nullable=False)
    position_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    duration_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    watched_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)


class Watchlist(Base):
    __tablename__ = "watchlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    media_type: Mapped[str] = mapped_column(String, nullable=False)  # 'movie' or 'series'
    media_id: Mapped[int] = mapped_column(Integer, nullable=False)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    value: Mapped[str] = mapped_column(Text, nullable=False, default="")
