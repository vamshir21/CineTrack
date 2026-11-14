"""Scanner router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import MediaFolder
from backend.schemas import MediaFolderCreate, MediaFolderOut, ScanStatus
from backend.services.scanner import start_scan, cancel_scan, get_scan_status

import os

router = APIRouter(prefix="/api/scanner", tags=["scanner"])


@router.post("/folders", response_model=MediaFolderOut)
def add_folder(body: MediaFolderCreate, db: Session = Depends(get_db)):
    if not os.path.isdir(body.path):
        raise HTTPException(status_code=400, detail=f"Path does not exist: {body.path}")
    existing = db.query(MediaFolder).filter(MediaFolder.path == body.path).first()
    if existing:
        raise HTTPException(status_code=409, detail="Folder already registered")
    folder = MediaFolder(path=body.path, name=body.name)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


@router.get("/folders", response_model=list[MediaFolderOut])
def list_folders(db: Session = Depends(get_db)):
    return db.query(MediaFolder).all()


@router.delete("/folders/{folder_id}")
def delete_folder(folder_id: int, db: Session = Depends(get_db)):
    folder = db.query(MediaFolder).filter(MediaFolder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    db.delete(folder)
    db.commit()
    return {"deleted": folder_id}


@router.post("/scan")
def trigger_scan():
    started = start_scan()
    if not started:
        return {"status": "already_running"}
    return {"status": "started"}


@router.get("/scan/status", response_model=ScanStatus)
def scan_status():
    return get_scan_status()


@router.post("/scan/cancel")
def cancel_scan_endpoint():
    cancel_scan()
    return {"status": "cancelling"}
