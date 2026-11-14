"""
CineTrack FastAPI backend entry point.
"""
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.config import APP_DATA_DIR, ARTWORK_DIR, LOG_PATH, DEFAULT_SETTINGS

# ── Logging setup ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(str(LOG_PATH)),
    ],
)
logger = logging.getLogger(__name__)


# ── Lifespan ───────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure directories exist
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    ARTWORK_DIR.mkdir(parents=True, exist_ok=True)

    # Init DB tables
    from backend.database import init_db
    init_db()

    # Seed default settings
    from backend.database import SessionLocal
    from backend.models import Settings
    db = SessionLocal()
    try:
        for key, value in DEFAULT_SETTINGS.items():
            if not db.query(Settings).filter(Settings.key == key).first():
                db.add(Settings(key=key, value=value))
        db.commit()
    finally:
        db.close()

    logger.info("CineTrack backend started. DB: %s", APP_DATA_DIR / "cinetrack.db")
    yield
    logger.info("CineTrack backend shutting down.")


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CineTrack API",
    description="Netflix-style local media center backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for cached artwork
app.mount("/api/images", StaticFiles(directory=str(ARTWORK_DIR), html=False), name="images")

# ── Routers ────────────────────────────────────────────────────────────────────
from backend.routers import media, playback, tmdb, settings, search, watchlist, scanner  # noqa: E402

app.include_router(media.router)
app.include_router(scanner.router)
app.include_router(tmdb.router)
app.include_router(settings.router)
app.include_router(search.router)
app.include_router(watchlist.router)
app.include_router(playback.router)


# ── Health check ─────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "healthy"}


# ── Frontend static files & SPA routing ─────────────────────────────────────────
from fastapi.responses import FileResponse

frontend_dist = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
assets_dir = os.path.join(frontend_dist, 'assets')
if os.path.exists(assets_dir):
    app.mount('/assets', StaticFiles(directory=assets_dir), name='assets')


@app.get("/{full_path:path}")
def serve_frontend(full_path: str):
    file_path = os.path.join(frontend_dist, full_path)
    if full_path and os.path.isfile(file_path):
        return FileResponse(file_path)
    index_file = os.path.join(frontend_dist, 'index.html')
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"status": "ok", "app": "CineTrack", "version": "1.0.0"}

