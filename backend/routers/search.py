"""
Search router — search local library.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Movie, TVSeries, Episode
from backend.routers.media import _movie_out, _series_out, _episode_out

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("/")
def search_library(
    q: str = Query(""),
    type: str = Query(""),
    db: Session = Depends(get_db),
):
    if not q:
        return {"movies": [], "series": [], "episodes": []}

    q_lower = q.lower()
    results: dict = {"movies": [], "series": [], "episodes": []}

    if not type or type == "movie":
        movies = db.query(Movie).all()
        for m in movies:
            if q_lower in m.title.lower():
                results["movies"].append(_movie_out(m, db))

    if not type or type == "series":
        series_list = db.query(TVSeries).all()
        for s in series_list:
            if q_lower in s.title.lower():
                results["series"].append(_series_out(s, db))

    if not type or type == "episode":
        episodes = db.query(Episode).all()
        for e in episodes:
            title = e.title or ""
            if q_lower in title.lower() or q_lower in e.file_path.lower():
                results["episodes"].append(_episode_out(e, db))

    return results
