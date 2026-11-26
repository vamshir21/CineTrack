"""
Watchlist router.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Watchlist, Movie, TVSeries, Profile
from backend.schemas import WatchlistCreate
from backend.routers.media import _movie_out, _series_out

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


def _resolve_profile_id(x_profile_id: Optional[int], db: Session) -> int:
    if x_profile_id:
        return x_profile_id
    p = db.query(Profile).filter(Profile.is_admin == True).order_by(Profile.id.asc()).first()
    return p.id if p else 1


@router.get("")
@router.get("/")
def list_watchlist(
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db),
):
    profile_id = _resolve_profile_id(x_profile_id, db)
    items = (
        db.query(Watchlist)
        .filter(Watchlist.profile_id == profile_id)
        .order_by(Watchlist.added_at.desc())
        .all()
    )
    result = []
    for w in items:
        item_data = None
        if w.media_type == "movie":
            movie = db.query(Movie).filter(Movie.id == w.media_id).first()
            if movie:
                item_data = _movie_out(movie, db)
        elif w.media_type == "series":
            series = db.query(TVSeries).filter(TVSeries.id == w.media_id).first()
            if series:
                item_data = _series_out(series, db)
        result.append({
            "id": w.id,
            "media_type": w.media_type,
            "media_id": w.media_id,
            "added_at": w.added_at.isoformat(),
            "item": item_data,
        })
    return result


@router.post("")
@router.post("/")
def add_to_watchlist(
    body: WatchlistCreate,
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db),
):
    profile_id = _resolve_profile_id(x_profile_id, db)
    existing = (
        db.query(Watchlist)
        .filter(
            Watchlist.profile_id == profile_id,
            Watchlist.media_type == body.media_type,
            Watchlist.media_id == body.media_id,
        )
        .first()
    )
    if existing:
        return {"id": existing.id, "added_at": existing.added_at.isoformat()}
    w = Watchlist(profile_id=profile_id, media_type=body.media_type, media_id=body.media_id)
    db.add(w)
    db.commit()
    db.refresh(w)
    return {"id": w.id, "added_at": w.added_at.isoformat()}


@router.delete("/{media_type}/{media_id}")
def remove_from_watchlist(
    media_type: str,
    media_id: int,
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db),
):
    profile_id = _resolve_profile_id(x_profile_id, db)
    w = (
        db.query(Watchlist)
        .filter(
            Watchlist.profile_id == profile_id,
            Watchlist.media_type == media_type,
            Watchlist.media_id == media_id,
        )
        .first()
    )
    if not w:
        raise HTTPException(status_code=404, detail="Not in watchlist")
    db.delete(w)
    db.commit()
    return {"deleted": True}


@router.get("/check/{media_type}/{media_id}")
def check_watchlist(
    media_type: str,
    media_id: int,
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    db: Session = Depends(get_db),
):
    profile_id = _resolve_profile_id(x_profile_id, db)
    w = (
        db.query(Watchlist)
        .filter(
            Watchlist.profile_id == profile_id,
            Watchlist.media_type == media_type,
            Watchlist.media_id == media_id,
        )
        .first()
    )
    return {"in_watchlist": w is not None}
