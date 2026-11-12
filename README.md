# CineTrack

**Your media. Your library. Your control.**

CineTrack is a local-first desktop media library for browsing a personal collection of movies and TV shows. It provides a cinematic poster-based interface, optional TMDB metadata and artwork, VLC playback, playback progress, and episode-aware Continue Watching.

<p align="center">
  <a href="https://github.com/vamshir21/CineTrack/archive/refs/heads/main.zip"><strong>⬇ Download latest source ZIP</strong></a>
  &nbsp; · &nbsp;
  <a href="https://github.com/vamshir21/CineTrack/releases"><strong>Releases</strong></a>
  &nbsp; · &nbsp;
  <a href="https://github.com/vamshir21/CineTrack/issues"><strong>Report a bug</strong></a>
</p>

> **Project status:** early public release. CineTrack is developed primarily for Ubuntu Linux. The automated suite does not replace manual testing of Qt rendering, VLC hand-off, codecs, or desktop integration.

## Screenshots

### Home — Continue Watching and Recently Added

![CineTrack Home](docs/screenshots/home.jpg)

### Movies — poster-based collection

![CineTrack Movies](docs/screenshots/movies.jpg)

### TV Shows — seasons and episode browser

![CineTrack TV Shows](docs/screenshots/tv-shows.jpg)

## Features

- Dark, poster-based desktop interface with Home, Movies, TV Shows, My Library, Watchlist, and Settings.
- Recursive media-folder scanning, startup scanning, and periodic checks for newly added files.
- Series grouping: one series card in library views, with episodes in the series detail browser.
- Season and episode selection, watched status, and episode-aware Continue Watching.
- VLC playback with resume position and progress persistence.
- Five-minute end-credit completion window and next-episode prompt.
- Optional TMDB metadata, posters, backdrops, and filename-derived title fallback.
- Local artwork cache, Watchlist, and SQLite database.
- Explicit remove-from-library and optional permanent local-file deletion confirmation.

## Download

**No Git required.** Download the latest source as a ZIP:

[![Download ZIP](https://img.shields.io/badge/Download-Latest%20ZIP-1f6feb?style=for-the-badge&logo=github)](https://github.com/vamshir21/CineTrack/archive/refs/heads/main.zip)

For versioned releases and release notes, visit [GitHub Releases](https://github.com/vamshir21/CineTrack/releases). GitHub also provides a ZIP and tar.gz source archive for each published tag.

## Requirements

- Ubuntu or another Linux desktop environment with Qt support.
- Python 3.10 or newer.
- VLC installed and available as the `vlc` command.
- Optional TMDB v3 API Key or v4 Read Access Token.

## Install

Install system dependencies:

```bash
sudo apt update
sudo apt install vlc python3-venv git
```

Clone the repository and install:

```bash
git clone https://github.com/vamshir21/CineTrack.git
cd CineTrack
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m cinetrack.app
```

For the desktop launcher:

```bash
chmod +x launch-cinetrack.sh install-desktop.sh
./install-desktop.sh
```

## Add your media

1. Launch CineTrack and choose **Add media folder**.
2. Select a folder containing movies and/or TV series.
3. CineTrack scans nested folders and remembers the registered location.
4. New files are picked up on startup and during periodic scans.

Supported video extensions include MKV, MP4, AVI, MOV, M4V, WMV, WebM, MPG, MPEG, TS, and M2TS.

Recognised TV episode patterns include `Show.Name.S03E04.mkv`, `Show.Name.3x04.mkv`, and `Show/Season 03/01 - Episode Name.mkv`.

## TMDB setup

TMDB is optional. Open **Settings → Artwork & metadata**, then enter either a TMDB v3 API Key or a TMDB v4 Read Access Token.

Credentials are stored locally in the user's CineTrack settings directory and must never be committed to Git. CineTrack uses the TMDB API but is not endorsed or certified by TMDB. See TMDB's terms and attribution requirements before redistributing metadata or artwork.

## Data and privacy

By default, CineTrack stores its local data under `~/.local/share/cinetrack/` (or `$XDG_DATA_HOME/cinetrack/`), including the SQLite database, settings, and artwork cache. Media files remain in their original locations during normal scanning and playback.

Removing a title from CineTrack does not delete files unless permanent deletion is explicitly selected. Permanent deletion cannot be undone. Review the selected folder before confirming.

## Tests

```bash
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m compileall -q cinetrack tests
```

The automated suite covers filename parsing, library grouping, SQLite playback state, episode completion/selection, and guarded file deletion. It does not replace manual testing of the full GUI or real VLC playback.

## Known limitations

- Linux is the supported target for this initial release; Windows and macOS are not validated.
- VLC must be installed separately.
- TMDB matching is best-effort; filename-derived titles remain available without a match.
- Metadata and artwork require network access and valid TMDB credentials.
- Full Qt rendering and real VLC playback are not covered by automated tests.

## Contributing

Bug reports, reproducible test cases, documentation improvements, and focused pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md). Never attach media files, API credentials, local databases, or personal paths to issues.

## License

CineTrack's original source code is released under the MIT License. See [LICENSE](LICENSE). Third-party software and services remain subject to their own licenses and terms.
