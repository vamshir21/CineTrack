<div align="center">

  <img src="https://raw.githubusercontent.com/vamshir21/CineTrack/main/frontend/public/favicon.ico" width="84" alt="CineTrack Logo" style="border-radius: 20%;" />

  # CineTrack 4.0
  ### *The Netflix of Local Media & LAN Streaming.*

  **A production-grade, privacy-first media center and home streaming platform that transforms your offline movie and TV collection into a multi-device Netflix experience across phones, tablets, smart TVs, and desktop.**

  <p align="center">
    <a href="https://github.com/vamshir21/CineTrack/releases/tag/v4.0.0"><img src="https://img.shields.io/badge/Release-v4.0.0-E50914?style=for-the-badge&logo=netflix&logoColor=white" alt="Release"></a>
    <a href="https://github.com/vamshir21/CineTrack/actions"><img src="https://img.shields.io/badge/Tests-41%2F41%20Passing-brightgreen?style=for-the-badge&logo=githubactions&logoColor=white" alt="Tests"></a>
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
    <a href="#-lan-streaming--mdns"><strong>LAN & Mobile</strong></a> •
    <a href="#-architecture"><strong>Architecture Guide</strong></a> •
    <a href="#-shortcuts"><strong>Shortcuts</strong></a>
  </p>

</div>

---

> [!IMPORTANT]
> **Dual Playback Engine & 100% Privacy:** CineTrack never sends your files to external servers or requires a third-party account. On the host desktop, it decodes directly via native **libVLC hardware acceleration** with zero transcoding. Across your Wi-Fi network (phones, tablets, TVs), it streams via **HTTP 206 byte-range streaming** with on-the-fly audio remuxing and dynamic WebVTT subtitle extraction.

---

## 📥 Downloads

CineTrack is distributed as ready-to-run source archives:

| Version | Engine & Stack | Key Highlights | Direct Download |
| :--- | :--- | :--- | :---: |
| 🚀 **CineTrack 4.0** <br>*(Latest Release)* | React 19 · FastAPI · libVLC · HTTP 206 | **LAN Streaming & mDNS (`cinema.local`)**, **Multi-Profile System with Kids Isolation**, **2104 Admin PIN Protection**, **Rich Netflix-Grade Web Media Player** (audio & WebVTT track switcher, double-tap seek, scrub preview, end-credits countdown), **Mobile Responsive UI** (bottom nav, auto-landscape), **Zero-Clipping Adaptive Rails** | [**⬇️ Download v4.0.0 (.zip)**](https://github.com/vamshir21/CineTrack/archive/refs/tags/v4.0.0.zip) |
| 🌟 **CineTrack 3.0** <br>*(Previous)* | React 19 · FastAPI · libVLC | Upcoming Theaters/OTT Hub with Global Stream Finder, Franchise Binge Rails, Cast & Crew Filmography Hub, Mood-Based Vibe Selector & Shuffle, Rotten Tomatoes & IMDb Ratings, Light Mode & Theme Toggle | [**⬇️ Download v3.0.0 (.zip)**](https://github.com/vamshir21/CineTrack/archive/refs/tags/v3.0.0.zip) |
| 📦 **CineTrack 2.0** <br>*(Classic)* | React 19 · FastAPI · libVLC | Complete Netflix-style rebuild, Top 10 rail, 4K badges, Play Something, Library Stats, Permanent Deletion controls | [**⬇️ Download v2.0.0 (.zip)**](https://github.com/vamshir21/CineTrack/archive/refs/tags/v2.0.0.zip) |

---

## 🖼️ UI Showcase

<div align="center">

### 1. Cinematic Hero Banner & Adaptive Netflix Rails
*Full-width dynamic backdrop slideshow with focal positioning, smooth gradient overlays, carousel dots, and responsive horizontal rails.*

<img src="https://github.com/user-attachments/assets/4f38542f-f2a4-4d6a-80ac-d5f5d4dcc9ba" width="100%" alt="CineTrack - Hero Banner & Browse Experience" />

<br><br>

### 2. Netflix-Style Expanded Hover Cards & Top 10 Rail
*Smooth Framer Motion scale-up positioned directly over the hovered card with zero vertical clipping on Continue Watching, metadata previews, action triggers, and authentic outlined Top 10 numbers.*

<img src="https://github.com/user-attachments/assets/1afd20f9-03a0-49c3-ba4d-179724d09c86" width="100%" alt="CineTrack - Hover Cards & Top 10 Numbered Rail" />

<br><br>

### 3. Pro Web Player with Track Switcher & End-Credits Countdown
*Full-featured HTML5 web video suite with centered controls, audio track switcher, WebVTT subtitle switcher, draggable timeline with hover preview tooltip, next episode button, and end-credits countdown.*

<img src="https://github.com/user-attachments/assets/5c8e44de-5f6b-4d8f-951d-3686480e2d70" width="85%" alt="CineTrack - Video Playback Rig & Next Episode Countdown" />

<br><br>

### 4. Executive Library Dashboard & Storage Management
*Glassmorphism metric cards displaying total storage in GB, hours watched, title counts, in-library search/sort, and disk-level permanent file deletion.*

<img src="https://github.com/user-attachments/assets/65ba90a9-21c8-4c6a-8578-9031e9291cd9" width="100%" alt="CineTrack - Library Stats Dashboard & Storage Management" />

</div>

---

## ⚡ Why CineTrack?

| Capability | **CineTrack 4.0** | **Generic Media Players (VLC / MPV)** | **Heavy Media Servers (Plex / Jellyfin)** |
| :--- | :---: | :---: | :---: |
| **Streaming Platform UX** | **Authentic Netflix Quality** | Basic File Player | Generic Web UI |
| **Local Desktop Playback** | **Direct libVLC Hardware GPU** | Direct Player | Browser Video / Transcoded HLS |
| **LAN & Mobile Streaming** | **HTTP 206 Partial Content + mDNS** | Streaming Wizard (Complex) | Heavy Server Transcoder |
| **Privacy & Accounts** | **100% Offline / Zero Account** | 100% Offline | Account & Cloud Dependencies |
| **Multi-User Profiles** | **Yes (Avatars, Kids Mode Isolation)** | No | Cloud Account Dependent |
| **Admin Protection** | **2104 PIN Protection on Deletion/Config** | None | Role Perms |
| **Automatic Next Episode** | **Yes (Settings-Driven Countdown)** | Manual / Playlist | Yes |
| **Discovery & Ratings** | **RT (🍅 Critic / 🍿 Popcorn), IMDb, Vibes** | None | Add-ons Required |
| **Device Flexibility** | **Mobile Bottom Nav, Auto-Landscape** | Desktop Only | App Store Downloads |

---

## ✨ Core Features

### 🚀 LAN Streaming & Multi-Device Freedom (New in v4.0)
* **Zero-Config mDNS Network Name:** Access your library on any device at **`http://cinema.local:8088`** without memorizing IP addresses.
* **Dual Playback Engine:**
  * **Local Host (Ubuntu):** Direct libVLC bitstream hardware acceleration with 0% transcoding overhead.
  * **LAN & Remote Devices:** HTTP 206 Range-Request video streaming with on-the-fly FFmpeg AAC audio remuxing and dynamic WebVTT subtitle extraction.
* **Mobile & Tablet Optimized:**
  * Auto-fullscreen and auto-landscape orientation lock on mobile devices.
  * Mobile double-tap gestures: double-tap left seeks -10s; double-tap right seeks +10s with ripple animations.
  * Sticky Mobile Bottom Navigation bar (`MobileBottomNav.tsx`).
* **Netflix-Grade Web Media Player:**
  * Centered large play/pause suite.
  * Interactive scrub bar with hover timecode tooltip and video thumbnail preview.
  * Real-time audio and subtitle track selector dialog.
  * End-credits countdown popup with configurable threshold and next-episode button.

### 🛡️ Profiles, Kids Mode & Admin PIN 2104 Security (New in v4.0)
* **Multi-User Profiles:** Independent Continue Watching rows and watchlists for each household member.
* **Kids Mode Isolation:** Automatic certification filtering (`G`, `PG`, `TV-Y`, `TV-Y7`, `TV-G`), hiding mature and R-rated content.
* **Admin PIN Safeguards (`2104`):** Only authenticated admins can permanently delete files from disk, rescan media, or modify system settings. Non-admin users have read-only streaming access.

### 🌟 Discovery, Filmography & Multi-Source Ratings
* **Upcoming In-Theaters & OTT Hub:** Full-screen explorer for anticipated theater and digital streaming releases with release countdowns and universal stream finder.
* **Franchise & Movie Saga Rails:** Automatic grouping of cinematic universes (*The Hunger Games*, *Harry Potter*, *Star Wars*) in chronological watch order.
* **Actor & Director Filmography Hub:** Click any cast member to see local titles ready to play alongside external works tagged with legal streaming badges (Netflix, Prime, Disney+, Apple TV).
* **"Surprise Me by Vibe" Mood Selector:** Curated mood rails (*Mind-Benders*, *Adrenaline Rush*, *Crime Thriller*, *Action*, *Feel-Good*, *Dystopian*) with slot-machine shuffle modal.
* **Rotten Tomatoes & IMDb Ratings:** Side-by-side critic score (🍅), audience popcorn score (🍿), and IMDb score.

---

## ⌨️ Desktop & Player Keyboard Shortcuts

| Key | Action | Context |
| :---: | :--- | :--- |
| <kbd>Space</kbd> | Play / Pause video | Video Player |
| <kbd>F</kbd> | Toggle Fullscreen | Video Player |
| <kbd>M</kbd> | Toggle Mute | Video Player |
| <kbd>←</kbd> / <kbd>→</kbd> | Seek Backward / Forward 5s | Video Player |
| <kbd>J</kbd> / <kbd>L</kbd> | Seek Backward / Forward 10s | Video Player |
| <kbd>N</kbd> | Play Next Episode | Video Player (Series) |
| <kbd>S</kbd> | Audio & Subtitle Track Menu / "Play Something" | Video Player / Global |
| <kbd>/</kbd> | Focus Library Search | Global |
| <kbd>Esc</kbd> | Close Modal / Exit Player | Global |

---

## 🚀 Quick Start (Ubuntu Linux)

### 1. Prerequisites
Ensure you have Python 3.10+, Node.js 18+, and VLC installed:
```bash
sudo apt update && sudo apt install -y python3 python3-venv nodejs npm vlc ffmpeg curl avahi-daemon avahi-utils
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
Get a free API key from [The Movie Database (TMDB)](https://www.themoviedb.org/settings/api):
```bash
cp .env.example .env
nano .env
# Set: TMDB_API_KEY=your_tmdb_v3_key
```

### 4. Launch CineTrack
```bash
./launch-cinetrack.sh
```
* **Local Desktop:** Open [**`http://localhost:8088`**](http://localhost:8088)
* **LAN Devices:** Open [**`http://cinema.local:8088`**](http://cinema.local:8088) or `http://<YOUR_IP>:8088`

---

## 📖 In-Depth Engineering Documentation

For a comprehensive, byte-level architectural breakdown of every layer of CineTrack 4.0, read the official guide:
👉 [**Master Architecture & Developer Guide**](docs/MASTER_ARCHITECTURE_GUIDE.md)

---

## 🧪 Automated Testing

CineTrack includes an automated unit & regression test suite:

```bash
# Run all 41 unit, deletion, LAN, and profile tests
./venv/bin/python -m unittest discover tests
```

Expected output:
```text
Ran 41 tests in 22.091s
OK
```

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/vamshir21">vamshir21</a></sub>
</div>
