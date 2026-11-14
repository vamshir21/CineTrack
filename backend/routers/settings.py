"""Settings router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Settings
from backend.schemas import SettingUpdate
from backend.config import DEFAULT_SETTINGS

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _ensure_defaults(db: Session):
    for key, value in DEFAULT_SETTINGS.items():
        existing = db.query(Settings).filter(Settings.key == key).first()
        if not existing:
            db.add(Settings(key=key, value=value))
    db.commit()


@router.get("/")
def get_all_settings(db: Session = Depends(get_db)):
    _ensure_defaults(db)
    rows = db.query(Settings).all()
    return {r.key: r.value for r in rows}


@router.post("/batch")
@router.put("/")
def update_settings_batch(body: dict[str, str], db: Session = Depends(get_db)):
    for key, value in body.items():
        row = db.query(Settings).filter(Settings.key == key).first()
        if not row:
            db.add(Settings(key=key, value=str(value)))
        else:
            row.value = str(value)
    db.commit()
    return {"status": "ok", "updated": len(body)}


@router.put("/{key}")
def update_setting(key: str, body: SettingUpdate, db: Session = Depends(get_db)):
    row = db.query(Settings).filter(Settings.key == key).first()
    if not row:
        row = Settings(key=key, value=body.value)
        db.add(row)
    else:
        row.value = body.value
    db.commit()
    return {"key": key, "value": body.value}


@router.get("/export")
def export_settings(db: Session = Depends(get_db)):
    rows = db.query(Settings).all()
    return {r.key: r.value for r in rows}


@router.post("/import")
def import_settings(body: dict, db: Session = Depends(get_db)):
    for key, value in body.items():
        row = db.query(Settings).filter(Settings.key == key).first()
        if not row:
            row = Settings(key=key, value=str(value))
            db.add(row)
        else:
            row.value = str(value)
    db.commit()
    return {"imported": len(body)}
