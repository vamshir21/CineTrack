# CineTrack

A Netflix-style local media center that lets you browse, organize, and play your personal movie and TV show collection — all from your browser.

![CineTrack](https://img.shields.io/badge/version-1.0.0-blue) ![Python](https://img.shields.io/badge/Python-3.9%2B-green) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## ✨ Features

- 🎬 **Movie & TV Library** — Automatic scanning and organization of your media files
- 🔍 **TMDB Metadata** — Rich artwork, descriptions, ratings from The Movie Database
- ▶️ **VLC Playback** — Full playback control via VLC: play, pause, seek, volume, subtitles
- 📋 **Watchlist** — Save titles to watch later
- 🕐 **Continue Watching** — Resume exactly where you left off
- 🔎 **Search** — Instant search across your entire local library
- ⚙️ **Settings** — Configurable media folders, TMDB key, and more

---

## 🚀 Quick Start

```bash
# 1. Clone / download the project
cd /home/vamshi-yadav/cine

# 2. Configure your TMDB API key
cp .env.example .env
nano .env   # set TMDB_API_KEY=<your_key>

# 3. Install everything
./install.sh

# 4. Launch!
./launch-cinetrack.sh
```

Open **http://localhost:8000** in your browser.

---

## 📋 Requirements

| Requirement | Minimum | Install |
|-------------|---------|---------|
| Python | 3.9+ | `sudo apt install python3 python3-venv` |
| Node.js | 16+ | `sudo apt install nodejs npm` |
| VLC | Any | `sudo apt install vlc` |
| curl | Any | `sudo apt install curl` |

---

## ⚙️ Configuration

### TMDB API Key (required for artwork & metadata)

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/)
2. Go to **Settings → API** and request an API key (v3 auth)
3. Copy the key into your `.env` file:

```env
TMDB_API_KEY=your_actual_key_here
HOST=0.0.0.0
PORT=8000
DEBUG=false
```

> **Note:** Without a TMDB key, CineTrack still works — files are scanned and listed — but no artwork or metadata will be fetched.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TMDB_API_KEY` | _(empty)_ | TMDB v3 API key |
| `HOST` | `0.0.0.0` | Bind address for the server |
| `PORT` | `8000` | Server port |
| `DEBUG` | `false` | Enable FastAPI debug mode |

---

## 🗂️ Installation Steps (Manual)

If `./install.sh` doesn't work, follow these steps:

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Install Python dependencies
pip install fastapi uvicorn sqlalchemy pydantic python-vlc \
            aiofiles requests python-dotenv alembic httpx websockets

# Build the frontend
cd frontend
npm install
npm run build
cd ..

# Create data directory
mkdir -p ~/.cinetrack/artwork
```

---

## 📖 Usage Guide

### 1. Adding Media Folders

After launching CineTrack, go to **Settings → Media Folders**:

1. Click **Add Folder**
2. Enter the full path to your movies or TV folder (e.g., `/home/user/Movies`)
3. Click **Save**
4. Click **Scan Library** to index your files

> **Tip:** Add separate folders for Movies and TV Shows. CineTrack auto-detects file types.

### 2. Scanning Your Library

- Click **Scan** in the top bar or go to **Settings → Scan Library**
- Progress is shown in real time
- New files are matched against TMDB automatically
- Rescan any time you add new files

### 3. Browsing & Playing

- **Home** — Featured items, Continue Watching, Recently Added rails
- **Movies** — Full movie library grid with filters
- **TV Shows** — Shows organized by series → seasons → episodes
- **Watchlist** — Your saved titles
- Click any title → open detail page → click ▶ **Play** to launch VLC

### 4. Matching Metadata Manually

If a file wasn't matched automatically:
1. Open the detail page
2. Click **Match with TMDB**
3. Search for the correct title and confirm

### 5. Playback Controls

| Action | How |
|--------|-----|
| Play/Pause | Click in the player bar or press `Space` |
| Seek | Click the progress bar |
| Volume | Drag the volume slider |
| Subtitles | Click the CC button → choose track |
| Speed | Click the speed button |
| Stop | Click ■ Stop |

---

## 🏗️ Architecture Overview

```
CineTrack
├── Backend (Python / FastAPI)
│   ├── REST API at /api/*
│   ├── SQLite database via SQLAlchemy
│   ├── Background media scanner
│   ├── TMDB integration & image cache
│   └── VLC playback control via python-vlc
│
└── Frontend (React / Vite)
    ├── Served as static files from /
    ├── TailwindCSS styling
    └── Axios for API calls
```

**Data Flow:**
1. User adds a folder in Settings
2. Scanner walks the directory tree, extracts metadata from filenames
3. Each file is looked up on TMDB; artwork downloaded to `~/.cinetrack/artwork/`
4. Frontend fetches data from `/api/*` endpoints and renders the UI
5. Play requests go to `/api/playback/play` → python-vlc launches VLC

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend language | Python 3.9+ |
| Web framework | FastAPI |
| ASGI server | Uvicorn |
| Database | SQLite (via SQLAlchemy 2.x) |
| Migrations | Alembic |
| Media player | VLC (via python-vlc) |
| Metadata source | TMDB API v3 |
| Frontend framework | React 18 |
| Build tool | Vite |
| CSS | TailwindCSS |
| HTTP client | Axios |

---

## 📁 Project Structure

```
cine/
├── backend/
│   ├── main.py          # FastAPI app & static file serving
│   ├── database.py      # SQLAlchemy engine & session
│   ├── models.py        # DB models
│   ├── schemas.py       # Pydantic schemas
│   ├── config.py        # App settings
│   ├── routers/         # API route modules
│   └── services/        # Business logic
├── frontend/
│   ├── src/             # React source
│   └── dist/            # Built output (served by backend)
├── .env.example         # Sample environment config
├── install.sh           # One-step installer
├── launch-cinetrack.sh  # Launcher script
├── test_backend.py      # API sanity tests
├── README.md
├── CHANGELOG.md
└── TROUBLESHOOTING.md
```

---

## 🧪 Testing the Backend

With the server running, execute:

```bash
./venv/bin/python test_backend.py
```

Expected output:
```
✓ Health check: 200
✓ Home data: 200
✓ Movies list: 200
...
========================================
Results: 10/10 tests passed
```

---

## ❓ Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

---

## 📄 License

MIT — do whatever you like with it.
