# CineTrack Troubleshooting Guide

---

## 🔴 VLC Not Found

**Symptom:** Clicking Play does nothing, or the backend logs show `VLC not found`.

**Fix:**
```bash
sudo apt install vlc
```

On Fedora/RHEL:
```bash
sudo dnf install vlc
```

On macOS:
```bash
brew install vlc
```

After installing VLC, restart the backend:
```bash
./launch-cinetrack.sh
```

> **Note:** `python-vlc` requires the VLC shared libraries (`libvlc`). Installing the VLC application usually includes them. If not, install `libvlc-dev` separately.

---

## 🔴 Port 8000 Already in Use

**Symptom:**
```
ERROR: [Errno 98] Address already in use
```

**Fix — Option 1:** Let the launcher kill it automatically
The `launch-cinetrack.sh` script calls `fuser -k 8000/tcp` before starting. If it failed, run manually:
```bash
fuser -k 8000/tcp
```

**Fix — Option 2:** Find and kill the process yourself
```bash
lsof -i :8000
kill -9 <PID>
```

**Fix — Option 3:** Change the port
Edit `.env`:
```env
PORT=8080
```
Then access CineTrack at `http://localhost:8080`.

---

## 🔴 TMDB API Key Not Configured

**Symptom:** No artwork loads, or the app shows "TMDB API key not configured."

**Fix:**
1. Get a free key at [themoviedb.org](https://www.themoviedb.org/) → Settings → API
2. Copy your v3 API key
3. Create `.env` from the template:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env`:
   ```env
   TMDB_API_KEY=your_actual_key_here
   ```
5. Restart the backend

> **Note:** Rate limit for free TMDB keys is ~40 requests/10 seconds. Large library scans will slow down automatically to avoid hitting this limit.

---

## 🔴 Media Not Found After Scan

**Symptom:** You scanned a folder but no movies or shows appear in the library.

**Checklist:**

1. **Confirm the folder path is correct**
   - Go to Settings → Media Folders and verify the path
   - Test: `ls /your/media/path`

2. **Check file extensions**
   CineTrack recognises: `.mp4 .mkv .avi .mov .wmv .flv .m4v .ts .m2ts .webm`
   Other extensions are ignored.

3. **Check permissions**
   ```bash
   ls -la /your/media/path
   ```
   The user running CineTrack must have read access.

4. **Re-scan explicitly**
   - Settings → Scan Library → click **Scan Now**
   - Watch the progress bar; errors are listed at the bottom

5. **Check scan errors**
   ```bash
   curl http://localhost:8000/api/scanner/scan/status
   ```

6. **Filename parsing**
   CineTrack tries to parse titles from filenames. Unusual naming can confuse the scanner. Rename files to standard patterns:
   - Movies: `Movie Title (2023).mkv`
   - Episodes: `Show Name S01E03.mkv` or `Show.Name.1x03.mkv`

---

## 🔴 Images Not Loading

**Symptom:** Poster thumbnails show broken image icons.

**Causes & Fixes:**

| Cause | Fix |
|-------|-----|
| TMDB key missing | Set `TMDB_API_KEY` in `.env` and rescan |
| Artwork cache directory missing | `mkdir -p ~/.cinetrack/artwork` |
| No internet during scan | Rescan with internet connected |
| TMDB rate limit hit | Wait 30 s and trigger a manual metadata refresh |

**Manual refresh for one item:**
```bash
# Refresh a specific movie (replace 42 with the movie ID from the URL)
curl -X POST http://localhost:8000/api/tmdb/refresh/movie/42
```

---

## 🔴 Playback Issues

### VLC opens but video doesn't play
- Check the file path in the backend logs
- Try opening the file directly in VLC to confirm it's not corrupted
- Ensure the file is readable: `ls -lh "/path/to/file.mkv"`

### No audio
- Check VLC's audio output settings (Tools → Preferences → Audio)
- Try a different audio output module

### Subtitles not showing
1. Click the CC button in the CineTrack player bar
2. Select a subtitle track
3. If no tracks appear, the file has no embedded subtitles — add an `.srt` file with the same base name

### Seek jumps back
- This can happen with VBR files. It's a VLC/file issue, not CineTrack.

### "python-vlc" import error at startup
```
ModuleNotFoundError: No module named 'vlc'
```
```bash
./venv/bin/pip install python-vlc
```
If that still fails, ensure the system VLC and its development libraries are installed:
```bash
sudo apt install vlc libvlc-dev
```

---

## 🔴 Frontend Not Loading (blank page or 404)

**Symptom:** Opening `http://localhost:8000` shows a blank page or 404.

**Fix:**
```bash
cd frontend
npm install
npm run build
cd ..
./launch-cinetrack.sh
```

The backend serves the built frontend from `frontend/dist/`. If that directory doesn't exist, you'll get a 404 on `/`.

---

## 🔴 Database Errors

**Symptom:** `OperationalError` or `no such table` in logs.

**Fix — reset the database:**
```bash
rm -f ~/.cinetrack/cinetrack.db
./launch-cinetrack.sh   # DB is recreated on first start
```

> ⚠️ This deletes your library index, watchlist, and watch history. Your actual media files are unaffected.

---

## 🔎 Collecting Logs for Bug Reports

```bash
# Run with verbose output
./venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --log-level debug 2>&1 | tee cinetrack.log
```

Include `cinetrack.log` when reporting issues.

---

## 💬 Still stuck?

Check the README for setup steps, or open an issue in the project repository.
