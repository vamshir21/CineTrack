<div align="center">

  <img src="https://raw.githubusercontent.com/vamshir21/CineTrack/main/frontend/public/favicon.ico" width="84" alt="CineTrack Logo" style="border-radius: 20%;" />

  # CineTrack 3.0
  ### *The Netflix of Local Media.*

  **A production-grade, privacy-first desktop streaming platform that transforms your offline movie and TV collection into an authentic streaming experience.**

  <p align="center">
    <a href="https://github.com/vamshir21/CineTrack/releases/tag/v3.0.0"><img src="https://img.shields.io/badge/Release-v3.0.0-E50914?style=for-the-badge&logo=netflix&logoColor=white" alt="Release"></a>
    <a href="https://github.com/vamshir21/CineTrack/actions"><img src="https://img.shields.io/badge/Tests-30%2F30%20Passing-brightgreen?style=for-the-badge&logo=githubactions&logoColor=white" alt="Tests"></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"></a>
    <a href="https://www.videolan.org/"><img src="https://img.shields.io/badge/VLC-libVLC%20Engine-FF8800?style=for-the-badge&logo=vlcmediaplayer&logoColor=white" alt="VLC"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"></a>
  </p>

  <p align="center">
    <a href="#-downloads"><strong>Download</strong></a> •
    <a href="#-ui-showcase"><strong>UI Showcase</strong></a> •
    <a href="#-features"><strong>Features</strong></a> •
    <a href="#-why-cinetrack"><strong>Why CineTrack?</strong></a> •
    <a href="#-quick-start"><strong>Quick Start</strong></a> •
    <a href="#-architecture"><strong>Architecture</strong></a> •
    <a href="#-shortcuts"><strong>Keyboard Shortcuts</strong></a>
  </p>

</div>

---

> [!IMPORTANT]
> **100% Local & Private:** CineTrack never streams your videos over external servers or requires a third-party account. All media files stay entirely on your computer, decoded with zero-latency hardware acceleration via native libVLC.

---

## 📥 Downloads

CineTrack is distributed as ready-to-run source archives. Choose your version below:

| Version | Engine & Stack | Key Highlights | Direct Download |
| :--- | :--- | :--- | :---: |
| 🌟 **CineTrack 3.0** <br>*(Latest Release)* | React 19 · FastAPI · libVLC | Upcoming Theaters/OTT Hub with Global Stream Finder, Franchise Binge Rails, Cast & Crew Filmography Hub, Mood-Based Vibe Selector & Shuffle, Rotten Tomatoes & IMDb Ratings, Light Mode & Theme Toggle, Perfect Row Layouts | [**⬇️ Download v3.0.0 (.zip)**](https://github.com/vamshir21/CineTrack/archive/refs/tags/v3.0.0.zip) |
| 🚀 **CineTrack 2.0** <br>*(Previous)* | React 19 · FastAPI · libVLC | Complete Netflix-style rebuild, Top 10 rail, 4K badges, Play Something, Library Stats, Permanent Deletion controls | [**⬇️ Download v2.0.0 (.zip)**](https://github.com/vamshir21/CineTrack/archive/refs/tags/v2.0.0.zip) |
| 📦 **CineTrack 1.0** <br>*(Classic)* | PySide6 / PyQt Desktop Shell | Original legacy release | [**⬇️ Download v1.0.0 (.zip)**](https://github.com/vamshir21/CineTrack/archive/refs/tags/v1.0.0.zip) |

---

## 🖼️ UI Showcase

<div align="center">

### 1. Cinematic Hero Banner & Netflix Rails
*Full-width dynamic backdrop slideshow with focal positioning, smooth gradient overlays, carousel dots, and responsive horizontal rails.*

<img src="https://github.com/user-attachments/assets/4f38542f-f2a4-4d6a-80ac-d5f5d4dcc9ba" width="100%" alt="CineTrack 2.0 - Hero Banner & Browse Experience" />

<br><br>

### 2. Netflix-Style Expanded Hover Cards & Top 10 Rail
*Smooth Framer Motion scale-up positioned directly over the hovered card with boundary collision avoidance, metadata previews, action triggers, and authentic outlined Top 10 numbers.*

<img src="https://github.com/user-attachments/assets/1afd20f9-03a0-49c3-ba4d-179724d09c86" width="100%" alt="CineTrack 2.0 - Hover Cards & Top 10 Numbered Rail" />

<br><br>

### 3. Native VLC Video Rig & Automatic Up-Next Timer
*Hardware-accelerated libVLC video engine with real-time scrub bar, audio/subtitle selectors, and a Netflix-style 10-second countdown prompt before the next episode starts.*

<img src="https://github.com/user-attachments/assets/5c8e44de-5f6b-4d8f-951d-3686480e2d70" width="85%" alt="CineTrack 2.0 - VLC Playback Rig & Next Episode Countdown" />

<br><br>

### 4. Executive Library Dashboard & Storage Management
*Glassmorphism metric cards displaying total storage in GB, hours watched, title counts, in-library search/sort, and disk-level permanent file deletion.*

<img src="https://github.com/user-attachments/assets/65ba90a9-21c8-4c6a-8578-9031e9291cd9" width="100%" alt="CineTrack 2.0 - Library Stats Dashboard & Storage Management" />

</div>

---

## ⚡ Why CineTrack?

| Capability | **CineTrack 3.0** | **Generic Media Players (VLC / MPV)** | **Heavy Media Servers (Plex / Jellyfin)** |
| :--- | :---: | :---: | :---: |
| **Streaming Platform UX** | **Netflix-Quality** | Basic File Player | Generic Web UI |
| **Playback Latency** | **Instant (Zero Transcode)** | Instant | High (Server Transcoding) |
| **Privacy & Accounts** | **100% Offline / No Account** | 100% Offline | Account & Cloud Dependencies |
| **Native Playback Engine** | **libVLC Hardware Acceleration** | Direct Player | Browser Video / Transcoded HLS |
| **Automatic Next Episode** | **Yes (10s Countdown Timer)** | Manual / Playlist | Yes |
| **Disk Storage Management** | **In-App Permanent Deletion** | Manual File Manager | Complex Permissions |
| **Global OTT & Discovery** | **Integrated (Where to Stream, Vibes, Rotten Tomatoes)** | No | Limited / External Plugins |
| **Theme Customization** | **Cinematic Dark & Clean Light Modes** | Fixed | Theme Packs |
| **Resource Usage** | **Ultra-Lightweight** | Lightweight | Heavy Background Daemon |

---

## ✨ Core Features

### 🌟 Discovery, Filmography & Multi-Source Ratings (New in v3.0)
* **Upcoming In-Theaters & OTT Hub:** Full-screen explorer for anticipated theater and digital streaming releases with release countdowns and a universal search bar discovering where any movie streams (Netflix, Amazon Prime Video, Disney+, Apple TV+, etc.), age certificates, and available languages.
* **Franchise & Movie Saga Rails:** Automatic grouping of cinematic universes (e.g. *The Hunger Games*, *Jailer*, *Star Wars*, *Harry Potter*) in chronological watch order with "X in Library" counters.
* **Actor & Director Filmography Hub:** In the Cast & Crew rail, clicking any actor or director opens their profile hub with photo, bio, and filmography partitioned into *"In Your Library"* (instant Play) and *"Other Works & Where to Stream"* (with direct OTT streaming badges).
* **"Surprise Me by Vibe" Mood Selector:** Curated mood rails (*Mind-Benders*, *Adrenaline Rush*, *Late-Night Crime & Thriller*, *High-Octane Action*, *Feel-Good & Popcorn*, *Dystopian Survival*) with real-time library filters and animated slot-machine shuffle modal.
* **Rotten Tomatoes & IMDb Ratings:** Real-time integration of Rotten Tomatoes Tomatometer (🍅 Critic Score, 🍿 Audience Score) and IMDb ratings displayed side by side across hero banners, hover cards, and modals.
* **Light Mode & Theme Customization:** Instant 1-click Sun/Moon toggle in the top Navbar and Settings with full high-contrast theme engine and automatic persistent state.
* **Native Audio Language Badges:** Auto-detected audio language tags (Hindi, English, Telugu, Tamil, Korean, etc.) displayed across all local media cards and hero banners.

### 🎬 Authentic Streaming Experience
* **Cinematic Hero Carousel:** High-resolution backdrop rotation, focal positioning, gradient vignettes, and one-click playback.
* **Expanded Hover Cards:** Smooth Framer Motion scale-up positioned directly over the hovered card with boundary collision avoidance (never opens off-screen or in the window center).
* **Top 10 Numbered Rail:** Giant outlined SVG ranking glyphs (`1` to `10`) for your library's highest-rated titles.
* **Media Quality & Spec Badges:** Automatic badges (`4K UHD`, `HDR`, `5.1 Surround`, `MKV`/`MP4`) parsed from filenames and media tracks.

### 🎮 Pro Playback Engine
* **Local VLC Engine:** Hardware-accelerated playback with position memory and real-time state synchronization over WebSockets.
* **Smart "Continue Watching":** Tracks exact playback positions; resumes seamlessly or queues the chronological next unwatched episode.
* **"Play Something" Shuffle Mode:** Can't decide what to watch? Press <kbd>S</kbd> or click the Navbar button for instant randomized suggestions with auto-preview.
* **Automatic Next Episode:** Configurable buffer timers prompt a countdown modal before automatically loading the next episode.

### 📦 Library Management & Permanent File Deletion
* **Disk Storage Permanent Deletion:** Delete movies, series, or single episodes from CineTrack with an optional **tick checkbox** to permanently erase the actual video file from system memory (hard drive storage) via `os.remove`.
* **Mark as Watched / Unwatched:** Instant checkmark toggle for entire series, specific seasons, individual episodes, or movies.
* **Executive Statistics Dashboard:** Real-time metrics bar calculating total gigabytes on disk, titles count, completed titles, and hours of watch time.
* **TMDB Metadata Matcher:** Automatic fuzzy title matching with manual search override modal for fixing posters and backdrops.

---

## ⌨️ Desktop Keyboard Shortcuts

| Key | Action | Context |
| :---: | :--- | :--- |
| <kbd>Space</kbd> | Play / Pause video | Video Player |
| <kbd>F</kbd> | Toggle Fullscreen | Video Player |
| <kbd>S</kbd> | Launch "Play Something" Shuffle Picker | Global |
| <kbd>/</kbd> | Instant Library Search Focus | Global |
| <kbd>?</kbd> | Open Keyboard Shortcuts Cheat Sheet | Global |
| <kbd>Esc</kbd> | Close Modal / Player / Drawer | Global |

---

## 🚀 Quick Start (Ubuntu Linux)

### 1. Prerequisites
Ensure you have Python 3.10+, Node.js 18+, and VLC installed:
```bash
sudo apt update && sudo apt install -y python3 python3-venv nodejs npm vlc curl
```

### 2. Clone & Setup
```bash
git clone https://github.com/vamshir21/CineTrack.git
cd CineTrack

# Run the automated installer
chmod +x install.sh launch-cinetrack.sh
./install.sh
```

### 3. TMDB API Key Setup
Get a free API key from [The Movie Database (TMDB)](https://www.themoviedb.org/settings/api) for posters, backdrops, and synopses:
```bash
cp .env.example .env
nano .env
# Set: TMDB_API_KEY=your_tmdb_v3_key
```

### 4. Launch CineTrack
```bash
./launch-cinetrack.sh
```
Open **`http://localhost:8088`** in your browser.

---

## 🖥️ Running on Windows & macOS

CineTrack is built on a portable **FastAPI + React 19 + VLC** core. While the automated `install.sh` script is tailored for Linux, you can run CineTrack on Windows or macOS with the simple adjustments below:

### 🪟 Windows Setup (PowerShell or CMD)

1. **Install Prerequisites:**
   * **Python 3.10+**: Download from [python.org](https://www.python.org/downloads/) *(⚠️ Check **"Add python.exe to PATH"** during installation)*.
   * **Node.js 18+**: Download from [nodejs.org](https://nodejs.org/).
   * **VLC Media Player (64-bit)**: Download from [videolan.org](https://www.videolan.org/vlc/). *(⚠️ Must match Python's 64-bit architecture)*.

2. **Setup Dependencies (Manual alternative to `install.sh`):**
   ```powershell
   # 1. Clone the repository
   git clone https://github.com/vamshir21/CineTrack.git
   cd CineTrack

   # 2. Create and activate virtual environment
   python -m venv venv
   .\venv\Scripts\activate

   # 3. Install Python dependencies
   pip install fastapi uvicorn sqlalchemy pydantic python-vlc aiofiles requests python-dotenv httpx websockets

   # 4. Build the frontend
   cd frontend
   npm install
   npm run build
   cd ..
   ```

3. **Configure & Launch:**
   * Copy `.env.example` to `.env` and set your `TMDB_API_KEY`.
   * Start the server:
     ```powershell
     python -m uvicorn backend.main:app --host 127.0.0.1 --port 8088
     ```
   * Open **`http://localhost:8088`** in your browser.
   * *Folder Path Tip:* When adding media folders in Settings, enter standard Windows paths such as `D:\Movies` or `C:\Users\YourName\Videos`.

---

### 🍎 macOS Setup (Terminal)

1. **Install Prerequisites via Homebrew:**
   ```bash
   brew install python@3.11 node
   brew install --cask vlc
   ```

2. **Setup Dependencies:**
   ```bash
   # 1. Clone the repository
   git clone https://github.com/vamshir21/CineTrack.git
   cd CineTrack

   # 2. Create virtual environment
   python3 -m venv venv
   source venv/bin/activate

   # 3. Install Python dependencies
   pip install fastapi uvicorn sqlalchemy pydantic python-vlc aiofiles requests python-dotenv httpx websockets

   # 4. Build the frontend
   cd frontend && npm install && npm run build && cd ..
   ```

3. **Configure & Launch:**
   * Copy `.env.example` to `.env` and set your `TMDB_API_KEY`.
   * If libVLC is not automatically located, export the plugins path:
     ```bash
     export VLC_PLUGIN_PATH="/Applications/VLC.app/Contents/MacOS/plugins"
     ```
   * Start the server:
     ```bash
     python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8088
     ```
   * Open **`http://localhost:8088`** in your browser.
   * *Folder Path Tip:* When adding media folders in Settings, use standard macOS paths such as `/Users/YourName/Movies`.


---

## 🏗️ Architecture & Technology Stack

```mermaid
graph TD
    Client["React 19 + Vite Frontend<br>(Tailwind CSS / Framer Motion / Lucide)"]
    API["FastAPI ASGI Server<br>(Port 8088)"]
    DB[("SQLite Database<br>(SQLAlchemy 2.0)")]
    TMDB["TMDB API v3<br>(Artwork & Metadata Cache)"]
    VLC["libVLC Engine<br>(Local Hardware Acceleration)"]
    Disk["Local Storage Filesystem<br>(/home/.../Movies & TV)"]

    Client <-->|REST & WebSocket Status| API
    API <-->|Relational Queries| DB
    API <-->|Metadata & Image Downloads| TMDB
    API <-->|Playback Controller| VLC
    VLC <-->|Direct File Access| Disk
```

### Technology Breakdown
* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, TanStack Query, Lucide Icons
* **Backend:** Python 3.10+, FastAPI, SQLite, SQLAlchemy, Pydantic v2, Uvicorn
* **Playback:** libVLC (via `python-vlc`), WebSocket state telemetry
* **Metadata:** TMDB API v3 with disk image caching in `~/.cinetrack/artwork/`

---

## 🧪 Automated Testing

CineTrack includes an automated unit & regression test suite:

```bash
# Run unit & deletion tests
./venv/bin/python -m unittest discover tests

# Run live API integration tests
./venv/bin/python test_backend.py
```

Expected output:
```text
Ran 20 tests in 0.374s
OK
Results: 14/14 tests passed
```

---

## 🤝 Contributing

Contributions are warmly welcomed!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/vamshir21">vamshir21</a></sub>
</div>
