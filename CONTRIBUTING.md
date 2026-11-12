# Contributing to CineTrack

Thanks for considering a contribution.

## Before opening an issue

- Search existing issues for the same problem.
- Include your Linux distribution, desktop environment, Python version, CineTrack version, and VLC version.
- Describe exact reproduction steps and expected behaviour.
- Redact personal paths, usernames, and credentials from logs.
- Never upload movies, episodes, subtitles, databases, `settings.json`, API keys, or access tokens.

## Development setup

```bash
sudo apt install vlc python3-venv
git clone https://github.com/vamshir21/CineTrack.git
cd CineTrack
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -v
```

## Pull requests

- Keep changes focused and explain user-visible behaviour.
- Add or update tests for scanner, database, playback-state, and file-management changes.
- Run unit tests and compile checks before submitting.
- Do not commit local configuration, credentials, media, artwork caches, databases, virtual environments, or generated archives.
- For UI changes, include screenshots captured with sample/non-personal media.
- Document destructive filesystem behaviour and keep deletion opt-in.

## Code style

Prefer small functions, explicit error handling, and standard-library solutions where practical. Avoid blocking network or filesystem work on the Qt UI thread. Preserve local-first behaviour; TMDB must not be mandatory for basic browsing or playback.
