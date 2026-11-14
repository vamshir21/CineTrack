#!/usr/bin/env python3
"""
CineTrack Native Desktop Application.
Runs the FastAPI backend and renders the Netflix-style UI in a native desktop window.
"""
import os
import sys
import time
import socket
import threading
import subprocess
from pathlib import Path

# Paths
APP_DIR = Path(__file__).parent.resolve()
ICON_PATH = APP_DIR / "assets" / "icon.png"
VENV_PYTHON = APP_DIR / "venv" / "bin" / "python"
if not VENV_PYTHON.exists():
    VENV_PYTHON = Path(sys.executable)

def find_available_port(preferred=8000, fallback=8088):
    """Find a guaranteed available port to bind to."""
    for port in [preferred, fallback, 8089, 8090, 8091, 8092]:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]

PORT = find_available_port()

def wait_for_server(port, timeout=15):
    """Wait until backend server is ready."""
    import requests
    start = time.time()
    url = f"http://127.0.0.1:{port}/health"
    while time.time() - start < timeout:
        try:
            r = requests.get(url, timeout=1)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.3)
    return False

def run_backend(port):
    """Run uvicorn server in a subprocess."""
    cmd = [
        str(VENV_PYTHON),
        "-m", "uvicorn",
        "backend.main:app",
        "--host", "127.0.0.1",
        "--port", str(port),
        "--log-level", "warning",
    ]
    return subprocess.Popen(cmd, cwd=str(APP_DIR))

def launch_desktop_gui(port, backend_process):
    """Launch PyQt6 WebEngine desktop window."""
    from PyQt6.QtWidgets import QApplication, QMainWindow
    from PyQt6.QtWebEngineWidgets import QWebEngineView
    from PyQt6.QtWebEngineCore import QWebEngineProfile, QWebEnginePage
    from PyQt6.QtGui import QIcon, QKeySequence, QShortcut
    from PyQt6.QtCore import QUrl, Qt

    app = QApplication(sys.argv)
    app.setApplicationName("CineTrack")
    app.setDesktopFileName("cinetrack")
    if ICON_PATH.exists():
        app.setWindowIcon(QIcon(str(ICON_PATH)))

    window = QMainWindow()
    window.setWindowTitle("CineTrack")
    window.resize(1360, 850)
    window.setMinimumSize(960, 600)

    # Style main window dark
    window.setStyleSheet("background-color: #141414;")

    web_view = QWebEngineView(window)
    web_view.setUrl(QUrl(f"http://127.0.0.1:{port}/"))

    # Dark background while loading
    web_view.setStyleSheet("background-color: #141414;")
    window.setCentralWidget(web_view)

    # Fullscreen shortcut (F11)
    def toggle_fullscreen():
        if window.isFullScreen():
            window.showNormal()
        else:
            window.showFullScreen()

    f11_shortcut = QShortcut(QKeySequence(Qt.Key.Key_F11), window)
    f11_shortcut.activated.connect(toggle_fullscreen)

    # Clean shutdown on close
    def on_close(event):
        try:
            if backend_process and backend_process.poll() is None:
                backend_process.terminate()
                backend_process.wait(timeout=3)
        except Exception:
            pass
        event.accept()

    window.closeEvent = on_close

    window.show()
    return app.exec()

def main():
    print(f"🎬 Starting CineTrack Desktop App on port {PORT}...")
    backend_proc = run_backend(PORT)

    ready = wait_for_server(PORT)
    if not ready:
        print("❌ Error: Backend failed to start.")
        backend_proc.terminate()
        sys.exit(1)

    print("✓ Backend ready. Launching desktop window...")
    try:
        ret = launch_desktop_gui(PORT, backend_proc)
    except Exception as e:
        print(f"⚠ Native desktop window error: {e}")
        print("Falling back to default browser...")
        import webbrowser
        webbrowser.open(f"http://127.0.0.1:{PORT}")
        backend_proc.wait()
        ret = 0
    finally:
        if backend_proc and backend_proc.poll() is None:
            backend_proc.terminate()

    sys.exit(ret)

if __name__ == "__main__":
    main()
