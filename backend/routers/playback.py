"""
Playback router.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio

from backend.schemas import PlayRequest, SeekRequest, VolumeRequest, SpeedRequest, SubtitleSelectRequest
from backend.services.playback_service import playback_service

router = APIRouter(prefix="/api/playback", tags=["playback"])


@router.post("/play")
def play(body: PlayRequest):
    playback_service.play(
        file_path=body.file_path,
        position=body.position,
        media_type=body.media_type,
        media_id=body.media_id,
    )
    return playback_service.get_status()


@router.post("/pause")
def pause():
    playback_service.pause()
    return playback_service.get_status()


@router.post("/resume")
def resume():
    playback_service.resume()
    return playback_service.get_status()


@router.post("/seek")
def seek(body: SeekRequest):
    playback_service.seek(body.position)
    return playback_service.get_status()


@router.post("/stop")
def stop():
    playback_service.stop()
    return playback_service.get_status()


@router.post("/volume")
def set_volume(body: VolumeRequest):
    playback_service.set_volume(body.level)
    return playback_service.get_status()


@router.get("/status")
def get_status():
    return playback_service.get_status()


@router.post("/speed")
def set_speed(body: SpeedRequest):
    playback_service.set_speed(body.rate)
    return playback_service.get_status()


@router.get("/subtitles")
def get_subtitles():
    return playback_service.get_subtitle_tracks()


@router.post("/subtitles/select")
def select_subtitle(body: SubtitleSelectRequest):
    playback_service.select_subtitle(body.track_id)
    return {"selected": body.track_id}


from pydantic import BaseModel
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException
from backend.database import get_db
from backend.models import WatchHistory

class RemoveContinueRequest(BaseModel):
    media_type: str
    media_id: int

@router.delete("/continue-watching/{media_type}/{media_id}")
def delete_continue_watching(media_type: str, media_id: int, db: Session = Depends(get_db)):
    """Remove item from Continue Watching."""
    deleted = (
        db.query(WatchHistory)
        .filter(WatchHistory.media_type == media_type, WatchHistory.media_id == media_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"status": "removed", "deleted": deleted, "media_type": media_type, "media_id": media_id}

@router.post("/continue-watching/remove")
def post_remove_continue_watching(body: RemoveContinueRequest, db: Session = Depends(get_db)):
    """Remove item from Continue Watching via POST."""
    deleted = (
        db.query(WatchHistory)
        .filter(WatchHistory.media_type == body.media_type, WatchHistory.media_id == body.media_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"status": "removed", "deleted": deleted, "media_type": body.media_type, "media_id": body.media_id}

@router.websocket("/ws/playback")
async def ws_playback(websocket: WebSocket):
    await websocket.accept()
    playback_service.register_ws_client(websocket)
    try:
        while True:
            await playback_service.broadcast_status()
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        playback_service.unregister_ws_client(websocket)
