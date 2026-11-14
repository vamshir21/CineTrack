# Changelog

All notable changes to CineTrack are documented here.

---

## [1.0.0] — 2026-11-14

### 🎉 Initial Release

#### Backend (FastAPI / Python)

- **FastAPI application** with CORS, lifespan context, and structured routing
- **SQLite database** via SQLAlchemy 2.x declarative models
  - `MediaFolder`, `Movie`, `TVSeries`, `Season`, `Episode`, `WatchHistory`, `Watchlist`, `Settings`
- **Alembic** migrations for schema management

#### Library API (`/api/library`)
- `GET /movies` — paginated movie list with watch progress
- `GET /movies/{id}` — full movie detail
- `GET /series` — TV series list (one card per show)
- `GET /series/{id}` — series detail with seasons
- `GET /series/{id}/seasons/{n}/episodes` — episode list
- `GET /recently-added` — last 20 added items
- `GET /continue-watching` — in-progress items
- `GET /home` — home page data bundle (featured, rails)
- `DELETE /movies/{id}` and `DELETE /series/{id}` — remove records

#### Scanner API (`/api/scanner`)
- Add / list / remove media folders
- Background full-library scan with progress tracking
- Cancel scan mid-run
- Recursive file walker supporting common video extensions

#### TMDB API (`/api/tmdb`)
- Search movies and TV shows on TMDB
- Match local items to TMDB IDs
- Refresh metadata for movies and series
- Artwork download & local caching to `~/.cinetrack/artwork/`

#### Playback API (`/api/playback`)
- Play, pause, resume, stop via python-vlc
- Seek to position
- Volume control (0–200)
- Playback speed control
- Subtitle track listing and selection
- Persistent watch position saved to `WatchHistory`

#### Watchlist API (`/api/watchlist`)
- Add / remove / list / check watchlist items for movies and series

#### Search API (`/api/search`)
- Full-text search across local movies, series, and episodes

#### Settings API (`/api/settings`)
- Key-value settings store with GET all / PUT by key / DELETE by key

#### Frontend (React / Vite)
- Home page with hero banner, Continue Watching, Recently Added, Movies, Series, Watchlist rails
- Movie and TV library grid views
- Detail pages with metadata, cast (from TMDB), and Play button
- Playback control bar (play, pause, seek, volume, speed, subtitles)
- Settings page: media folders, TMDB key, scan trigger
- Watchlist page
- Global search with instant results
- Dark Netflix-inspired theme via TailwindCSS

#### Scripts & Configuration
- `install.sh` — one-step dependency installer and frontend builder
- `launch-cinetrack.sh` — starts uvicorn, waits for readiness, opens browser
- `.env.example` — environment variable template
- `test_backend.py` — 10-endpoint sanity test suite

---

## [Unreleased]

- Transcoding support for unsupported formats
- Multi-user profiles
- Mobile-responsive UI improvements
- Hardware-accelerated playback options
- Collections & playlists
