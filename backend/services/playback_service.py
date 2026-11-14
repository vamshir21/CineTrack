"""
VLC Playback Service — Launches full native VLC with GUI and tracks watch history via RC socket.
Saves watch history periodically, marks items complete at threshold.
"""
import logging
import os
import re
import shutil
import socket
import subprocess
import threading
import time
from typing import Optional

logger = logging.getLogger(__name__)

# Check if standalone VLC CLI executable is installed on Ubuntu
VLC_BIN = shutil.which("vlc") or ("/usr/bin/vlc" if os.path.exists("/usr/bin/vlc") else None)

try:
    import vlc
    LIBVLC_AVAILABLE = True
except Exception as e:
    logger.warning(f"python-vlc not available: {e}")
    LIBVLC_AVAILABLE = False


class PlaybackService:
    """Singleton VLC player manager supporting full native VLC GUI with background tracking."""

    def __init__(self):
        self._lock = threading.Lock()
        self._vlc_process: Optional[subprocess.Popen] = None
        self._rc_socket: Optional[socket.socket] = None
        self._rc_port: Optional[int] = None
        self._monitor_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        # Fallback libVLC instance
        self._libvlc_instance = None
        self._libvlc_player = None

        self._state: dict = {
            "playing": False,
            "paused": False,
            "file_path": None,
            "media_type": None,
            "media_id": None,
            "position": 0.0,
            "duration": 0.0,
            "volume": 100,
            "speed": 1.0,
            "subtitle_tracks": [],
            "completed": False,
            "completed_episode_id": None,
        }
        self._ws_clients: set = set()

        if LIBVLC_AVAILABLE and not VLC_BIN:
            try:
                self._libvlc_instance = vlc.Instance("--no-xlib")
                self._libvlc_player = self._libvlc_instance.media_player_new()
                logger.info("Fallback libVLC instance created")
            except Exception as e:
                logger.warning(f"libVLC init failed: {e}")

    # ── Settings & Helpers ─────────────────────────────────────────────────────

    def _get_setting(self, key: str, default: str = "") -> str:
        try:
            from backend.database import SessionLocal
            from backend.models import Settings
            db = SessionLocal()
            try:
                row = db.query(Settings).filter(Settings.key == key).first()
                return row.value if row else default
            finally:
                db.close()
        except Exception:
            return default

    def _get_completion_threshold(self) -> float:
        try:
            val = self._get_setting("completion_threshold_minutes", "5")
            return float(val)
        except Exception:
            return 5.0

    def _find_free_port(self) -> int:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(("127.0.0.1", 0))
            return s.getsockname()[1]

    # ── Database Persistence ───────────────────────────────────────────────────

    def _persist_progress(self, media_type: str, media_id: int, position: float, duration: float):
        if not media_type or not media_id or position <= 0:
            return

        from datetime import datetime, timezone
        from backend.database import SessionLocal
        from backend.models import WatchHistory, Movie, Episode

        db = SessionLocal()
        try:
            # Self-healing verification: ensure media_type matches actual entity
            if media_type == "movie":
                m = db.query(Movie).filter(Movie.id == media_id).first()
                if not m:
                    ep = db.query(Episode).filter(Episode.id == media_id).first()
                    if ep:
                        media_type = "episode"
            elif media_type == "episode":
                ep = db.query(Episode).filter(Episode.id == media_id).first()
                if not ep:
                    m = db.query(Movie).filter(Movie.id == media_id).first()
                    if m:
                        media_type = "movie"

            # Completion criteria: mark complete if watched >= 93% OR within safe credit buffer of end
            threshold_minutes = self._get_completion_threshold()
            threshold_seconds = min(threshold_minutes * 60.0, 60.0)
            completed = False
            if duration > 30 and position > 0:
                if (position / duration) >= 0.93 or (duration - position) <= threshold_seconds:
                    completed = True

            record = (
                db.query(WatchHistory)
                .filter(WatchHistory.media_type == media_type, WatchHistory.media_id == media_id)
                .first()
            )
            if record:
                record.position_seconds = position
                if duration > 0:
                    record.duration_seconds = duration
                record.completed = completed
                record.watched_at = datetime.now(timezone.utc)
            else:
                record = WatchHistory(
                    media_type=media_type,
                    media_id=media_id,
                    position_seconds=position,
                    duration_seconds=duration if duration > 0 else 0.0,
                    completed=completed,
                    watched_at=datetime.now(timezone.utc),
                )
                db.add(record)
            db.commit()
            logger.info(f"Persisted watch progress: {media_type} {media_id} -> {position:.1f}s / {duration:.1f}s (completed={completed})")
        except Exception as e:
            logger.warning(f"Failed to persist watch progress: {e}")
        finally:
            db.close()

    # ── Native VLC RC Socket Helpers ───────────────────────────────────────────

    def _send_rc_cmd(self, sock: socket.socket, cmd: str) -> str:
        if not sock:
            return ""
        try:
            sock.sendall(f"{cmd}\n".encode("utf-8"))
            time.sleep(0.1)
            sock.settimeout(0.6)
            resp = b""
            while True:
                try:
                    chunk = sock.recv(1024)
                    if not chunk:
                        break
                    resp += chunk
                    if b"> " in chunk or b"\n" in chunk:
                        break
                except socket.timeout:
                    break
            return resp.decode("utf-8", errors="ignore").strip()
        except Exception:
            return ""

    def _rc_monitor_loop(self, proc: subprocess.Popen, port: int, media_type: str, media_id: int, initial_pos: float):
        """Background thread that tracks VLC playback and updates WatchHistory."""
        # Wait up to 6 seconds for VLC RC socket to become ready
        sock = None
        for _ in range(30):
            if proc.poll() is not None or self._stop_event.is_set():
                return
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(1.0)
                s.connect(("127.0.0.1", port))
                sock = s
                break
            except Exception:
                time.sleep(0.2)

        if not sock:
            logger.warning("Could not connect to VLC RC interface")
            return

        with self._lock:
            self._rc_socket = sock

        # Drain initial welcome banner from socket
        time.sleep(0.3)
        try:
            sock.settimeout(0.3)
            while True:
                chunk = sock.recv(2048)
                if not chunk:
                    break
        except Exception:
            pass

        # Apply default volume from settings (scale: 256 is 100%)
        vol_str = self._get_setting("default_volume", "100")
        try:
            default_vol_pct = int(vol_str)
        except Exception:
            default_vol_pct = 100
        vlc_vol = int((default_vol_pct / 100.0) * 256)
        self._send_rc_cmd(sock, f"volume {vlc_vol}")
        with self._lock:
            self._state["volume"] = default_vol_pct

        save_int_str = self._get_setting("progress_save_interval", "3")
        try:
            save_interval = float(save_int_str)
        except Exception:
            save_interval = 3.0

        max_pos = initial_pos
        cur_dur = 0.0
        last_saved_time = 0.0

        try:
            while not self._stop_event.is_set() and proc.poll() is None:
                # Query current time
                time_resp = self._send_rc_cmd(sock, "get_time")
                pos_matches = re.findall(r"\b\d+\b", time_resp)
                if pos_matches:
                    pos = float(pos_matches[-1])
                    if pos > 0:
                        max_pos = max(max_pos, pos)
                        with self._lock:
                            self._state["position"] = max_pos

                # Query total length
                dur_resp = self._send_rc_cmd(sock, "get_length")
                dur_matches = re.findall(r"\b\d+\b", dur_resp)
                if dur_matches:
                    dur = float(dur_matches[-1])
                    if dur > 0:
                        cur_dur = dur
                        with self._lock:
                            self._state["duration"] = cur_dur

                # Query status
                status_resp = self._send_rc_cmd(sock, "status")
                is_playing = "state playing" in status_resp
                is_paused = "state paused" in status_resp

                with self._lock:
                    if is_playing or is_paused:
                        self._state["playing"] = is_playing
                        self._state["paused"] = is_paused

                # Periodically save progress to SQLite based on configured interval
                if max_pos > 0 and (time.time() - last_saved_time) >= save_interval:
                    self._persist_progress(media_type, media_id, max_pos, cur_dur)
                    last_saved_time = time.time()

                time.sleep(1.0)

        except Exception as e:
            logger.debug(f"VLC monitor loop error: {e}")
        finally:
            # Save final watch position when VLC closes
            with self._lock:
                self._state["playing"] = False
                self._state["paused"] = False

            if max_pos > 0:
                self._persist_progress(media_type, media_id, max_pos, cur_dur)

            try:
                sock.close()
            except Exception:
                pass
            with self._lock:
                if self._rc_socket == sock:
                    self._rc_socket = None

            # Calculate whether playback was completed
            threshold_minutes = self._get_completion_threshold()
            threshold_seconds = min(threshold_minutes * 60.0, 60.0)
            is_completed = (cur_dur > 30.0 and max_pos > 0.0) and (
                (max_pos / cur_dur) >= 0.93 or (cur_dur - max_pos) <= threshold_seconds
            )

            with self._lock:
                self._state["playing"] = False
                self._state["paused"] = False
                self._state["completed"] = is_completed
                if is_completed and media_type == "episode":
                    self._state["completed_episode_id"] = media_id
                else:
                    self._state["completed_episode_id"] = None

    # ── Public API ─────────────────────────────────────────────────────────────

    def play(self, file_path: str, position: float = 0.0, media_type: str = "movie", media_id: int = 0):
        """Play media in native VLC application, enabling all built-in playback controls."""
        self.stop()
        self._stop_event.clear()

        # Check resume_playback setting
        resume_enabled = self._get_setting("resume_playback", "true") == "true"
        if not resume_enabled:
            position = 0.0

        # Database lookup to ensure 100% accurate media_type and media_id
        from backend.database import SessionLocal
        from backend.models import Movie, Episode
        db = SessionLocal()
        try:
            if file_path:
                ep_by_path = db.query(Episode).filter(Episode.file_path == file_path).first()
                if ep_by_path:
                    media_type = "episode"
                    media_id = ep_by_path.id
                else:
                    m_by_path = db.query(Movie).filter(Movie.file_path == file_path).first()
                    if m_by_path:
                        media_type = "movie"
                        media_id = m_by_path.id

            if media_type == "movie" and not db.query(Movie).filter(Movie.id == media_id).first():
                ep = db.query(Episode).filter(Episode.id == media_id).first()
                if ep:
                    media_type = "episode"
            elif media_type == "episode" and not db.query(Episode).filter(Episode.id == media_id).first():
                m = db.query(Movie).filter(Movie.id == media_id).first()
                if m:
                    media_type = "movie"
        finally:
            db.close()

        with self._lock:
            self._state.update({
                "playing": True,
                "paused": False,
                "file_path": file_path,
                "media_type": media_type,
                "media_id": media_id,
                "position": position,
                "duration": 0.0,
                "speed": 1.0,
                "completed": False,
                "completed_episode_id": None,
            })

        if VLC_BIN:
            port = self._find_free_port()
            self._rc_port = port
            cmd = [
                VLC_BIN,
                f"--rc-host=127.0.0.1:{port}",
                "--extraintf=rc",
                f"--start-time={int(position)}",
                file_path,
            ]
            env = os.environ.copy()
            # Inherit user desktop session environment for Wayland/X11 GUI
            try:
                self._vlc_process = subprocess.Popen(
                    cmd,
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                logger.info(f"Launched native VLC (PID: {self._vlc_process.pid}) for {media_type} {media_id} on port {port}")
                self._monitor_thread = threading.Thread(
                    target=self._rc_monitor_loop,
                    args=(self._vlc_process, port, media_type, media_id, position),
                    daemon=True,
                )
                self._monitor_thread.start()
                return
            except Exception as e:
                logger.warning(f"Failed to launch native VLC: {e}. Falling back to libVLC...")

        # Fallback to libvlc if standalone VLC cannot be launched
        if self._libvlc_player and self._libvlc_instance:
            try:
                media = self._libvlc_instance.media_new(file_path)
                self._libvlc_player.set_media(media)
                self._libvlc_player.play()
                if position > 0:
                    threading.Thread(target=self._delayed_libvlc_seek, args=(position,), daemon=True).start()
            except Exception as e:
                logger.error(f"Fallback libVLC error: {e}")

    def _delayed_libvlc_seek(self, position: float):
        time.sleep(1.0)
        try:
            if self._libvlc_player:
                self._libvlc_player.set_time(int(position * 1000))
        except Exception:
            pass

    def pause(self):
        """Toggle pause."""
        with self._lock:
            sock = self._rc_socket
        if sock:
            self._send_rc_cmd(sock, "pause")
            with self._lock:
                self._state["paused"] = not self._state.get("paused", False)
                self._state["playing"] = not self._state["paused"]
        elif self._libvlc_player:
            self._libvlc_player.pause()

    def resume(self):
        """Resume playback."""
        with self._lock:
            sock = self._rc_socket
        if sock:
            self._send_rc_cmd(sock, "play")
            with self._lock:
                self._state["playing"] = True
                self._state["paused"] = False
        elif self._libvlc_player:
            self._libvlc_player.play()

    def seek(self, position: float):
        """Seek to position in seconds."""
        with self._lock:
            sock = self._rc_socket
        if sock:
            self._send_rc_cmd(sock, f"seek {int(position)}")
            with self._lock:
                self._state["position"] = position
        elif self._libvlc_player:
            self._libvlc_player.set_time(int(position * 1000))
            with self._lock:
                self._state["position"] = position

    def stop(self):
        """Stop playback and terminate VLC process."""
        self._stop_event.set()
        with self._lock:
            sock = self._rc_socket
        if sock:
            try:
                self._send_rc_cmd(sock, "quit")
            except Exception:
                pass
            try:
                sock.close()
            except Exception:
                pass
            with self._lock:
                self._rc_socket = None

        if self._vlc_process:
            try:
                if self._vlc_process.poll() is None:
                    self._vlc_process.terminate()
                    self._vlc_process.wait(timeout=1.0)
            except Exception:
                try:
                    self._vlc_process.kill()
                except Exception:
                    pass
            self._vlc_process = None

        if self._libvlc_player:
            try:
                self._libvlc_player.stop()
            except Exception:
                pass

        with self._lock:
            self._state.update({
                "playing": False,
                "paused": False,
                "file_path": None,
                "media_type": None,
                "media_id": None,
                "position": 0.0,
                "duration": 0.0,
                "completed": False,
                "completed_episode_id": None,
            })

    def set_volume(self, level: int):
        """Set volume level 0-200."""
        level = max(0, min(200, level))
        with self._lock:
            sock = self._rc_socket
        if sock:
            vlc_vol = int(level * 2.56)
            self._send_rc_cmd(sock, f"volume {vlc_vol}")
        elif self._libvlc_player:
            self._libvlc_player.audio_set_volume(level)
        with self._lock:
            self._state["volume"] = level

    def set_speed(self, rate: float):
        """Set playback rate."""
        if self._libvlc_player:
            self._libvlc_player.set_rate(rate)
        with self._lock:
            self._state["speed"] = rate

    def get_status(self) -> dict:
        with self._lock:
            return dict(self._state)

    def select_subtitle(self, track_id: int):
        with self._lock:
            sock = self._rc_socket
        if sock:
            self._send_rc_cmd(sock, f"strack {track_id}")
        elif self._libvlc_player:
            self._libvlc_player.video_set_spu(track_id)

    def get_subtitle_tracks(self) -> list:
        return []

    def register_ws_client(self, ws):
        self._ws_clients.add(ws)

    def unregister_ws_client(self, ws):
        self._ws_clients.discard(ws)

    async def broadcast_status(self):
        """Broadcast current status to all WebSocket clients."""
        import json
        status = self.get_status()
        dead = set()
        for ws in list(self._ws_clients):
            try:
                await ws.send_text(json.dumps(status))
            except Exception:
                dead.add(ws)
        self._ws_clients -= dead


# Global singleton
playback_service = PlaybackService()
