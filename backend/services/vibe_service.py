"""
Mood / Vibe classification and selection engine for CineTrack.
Groups media by vibe and powers the "Surprise Me by Vibe" shuffle experience.
"""
import json
import random
from sqlalchemy.orm import Session
from backend.models import Movie, TVSeries

VIBE_DEFINITIONS = [
    {
        "key": "mind_benders",
        "name": "Mind-Benders",
        "emoji": "🌀",
        "tagline": "Thought-provoking sci-fi, psychological puzzles & reality-bending mysteries",
        "color": "from-purple-900/60 to-indigo-900/60 border-purple-500/50",
        "badge_color": "bg-purple-900/80 text-purple-200 border-purple-600/60",
        "genres": ["Science Fiction", "Mystery"],
        "keywords": ["sci-fi", "mind", "alien", "time", "space", "puzzle", "dystopian", "psychological", "future", "arrival", "inception", "interstellar", "matrix"],
    },
    {
        "key": "adrenaline_rush",
        "name": "Adrenaline Rush",
        "emoji": "⚡",
        "tagline": "High-stakes survival, military operations & pulse-pounding tension",
        "color": "from-red-950/60 to-amber-950/60 border-red-500/50",
        "badge_color": "bg-red-900/80 text-red-200 border-red-600/60",
        "genres": ["War", "Action", "Thriller", "Adventure"],
        "keywords": ["seal", "soldier", "sniper", "mission", "survival", "combat", "military", "tactical", "terminal list", "valor", "lone", "hostage"],
    },
    {
        "key": "crime_thriller",
        "name": "Late-Night Crime & Thriller",
        "emoji": "🕵️",
        "tagline": "Detective investigations, dark conspiracies, gangsters & neo-noir",
        "color": "from-slate-900/80 to-blue-950/60 border-cyan-500/50",
        "badge_color": "bg-cyan-900/80 text-cyan-200 border-cyan-600/60",
        "genres": ["Crime", "Mystery", "Drama"],
        "keywords": ["detective", "murder", "police", "mafia", "crime", "agent", "syndicate", "investigation", "mentalist", "gentlemen", "cbi", "fbi"],
    },
    {
        "key": "high_octane",
        "name": "High-Octane Action",
        "emoji": "💥",
        "tagline": "Explosive blockbusters, non-stop fights & epic showdowns",
        "color": "from-orange-950/60 to-red-900/60 border-orange-500/50",
        "badge_color": "bg-orange-900/80 text-orange-200 border-orange-600/60",
        "genres": ["Action", "Adventure"],
        "keywords": ["jailer", "revenge", "fight", "action", "explosive", "chase", "tiger", "hero", "syndicate", "ranabaali", "karuppu"],
    },
    {
        "key": "feel_good",
        "name": "Feel-Good & Popcorn",
        "emoji": "🍿",
        "tagline": "Lighthearted comedy, fun adventures & easy watches",
        "color": "from-yellow-950/60 to-emerald-950/60 border-yellow-500/50",
        "badge_color": "bg-yellow-900/80 text-yellow-200 border-yellow-600/60",
        "genres": ["Comedy", "Animation", "Family"],
        "keywords": ["comedy", "fun", "laughs", "humor", "animation", "talent", "standup", "latent"],
    },
    {
        "key": "dystopian",
        "name": "Dystopian Survival",
        "emoji": "🔥",
        "tagline": "Brutal regimes, post-apocalyptic arenas & desperate rebellion",
        "color": "from-amber-950/60 to-red-950/60 border-amber-500/50",
        "badge_color": "bg-amber-900/80 text-amber-200 border-amber-600/60",
        "genres": ["Science Fiction", "Adventure", "Action"],
        "keywords": ["games", "tribute", "panem", "rebellion", "capitol", "arena", "dystopian", "hunger", "catching fire", "mockingjay"],
    },
]


def _match_vibe(item, vibe_def: dict) -> bool:
    """Check if a Movie or TVSeries matches a vibe definition."""
    genres = []
    if item.genres:
        try:
            genres = json.loads(item.genres)
        except Exception:
            pass
    genres_lower = [g.lower() for g in genres]

    title_text = ((item.title or "") + " " + (item.overview or "")).lower()

    # Direct genre overlap
    has_genre_match = any(g.lower() in genres_lower for g in vibe_def["genres"])

    # Keyword check
    has_keyword_match = any(k in title_text for k in vibe_def["keywords"])

    # Match if:
    # 1. Has genre match AND keyword match, OR
    # 2. Strong keyword match in title, OR
    # 3. For genres with high specificity (e.g. War for adrenaline, Mystery for mind-benders)
    if has_keyword_match:
        return True

    if has_genre_match:
        if vibe_def["key"] == "crime_thriller" and "crime" in genres_lower:
            return True
        if vibe_def["key"] == "feel_good" and "comedy" in genres_lower:
            return True
        if vibe_def["key"] == "high_octane" and "action" in genres_lower:
            return True
        if vibe_def["key"] == "mind_benders" and ("science fiction" in genres_lower or "mystery" in genres_lower):
            return True

    return False


def get_vibe_summary(db: Session, serializer_movie, serializer_series) -> list[dict]:
    """Return all vibes with their local matching count and first few previews."""
    movies = db.query(Movie).all()
    series = db.query(TVSeries).all()

    vibes_out = []
    for v in VIBE_DEFINITIONS:
        matched_movies = [m for m in movies if _match_vibe(m, v)]
        matched_series = [s for s in series if _match_vibe(s, v)]

        total_count = len(matched_movies) + len(matched_series)
        vibes_out.append({
            "key": v["key"],
            "name": v["name"],
            "emoji": v["emoji"],
            "tagline": v["tagline"],
            "color": v["color"],
            "badge_color": v["badge_color"],
            "count": total_count,
            "preview_titles": [m.title for m in matched_movies[:3]] + [s.title for s in matched_series[:2]],
        })

    return vibes_out


def get_vibe_items(db: Session, vibe_key: str, serializer_movie, serializer_series) -> dict:
    """Return all items belonging to a given vibe."""
    vibe_def = next((v for v in VIBE_DEFINITIONS if v["key"] == vibe_key), None)
    if not vibe_def:
        return {"vibe": None, "items": []}

    movies = db.query(Movie).all()
    series = db.query(TVSeries).all()

    matched_movies = [serializer_movie(m, db) for m in movies if _match_vibe(m, vibe_def)]
    matched_series = [serializer_series(s, db) for s in series if _match_vibe(s, vibe_def)]

    combined = matched_movies + matched_series
    # Shuffle or sort by rating
    combined.sort(key=lambda x: x.get("vote_average") or 0, reverse=True)

    return {
        "vibe": {
            "key": vibe_def["key"],
            "name": vibe_def["name"],
            "emoji": vibe_def["emoji"],
            "tagline": vibe_def["tagline"],
            "color": vibe_def["color"],
            "badge_color": vibe_def["badge_color"],
        },
        "items": combined,
        "count": len(combined),
    }


def get_random_vibe_surprise(db: Session, vibe_key: str | None, serializer_movie, serializer_series) -> dict | None:
    """Return a single random surprise matching the vibe (or any vibe if None)."""
    movies = db.query(Movie).all()
    series = db.query(TVSeries).all()

    if vibe_key and vibe_key != "all":
        vibe_def = next((v for v in VIBE_DEFINITIONS if v["key"] == vibe_key), None)
        if not vibe_def:
            vibe_def = random.choice(VIBE_DEFINITIONS)
    else:
        vibe_def = random.choice(VIBE_DEFINITIONS)

    matched_movies = [m for m in movies if _match_vibe(m, vibe_def)]
    matched_series = [s for s in series if _match_vibe(s, vibe_def)]
    candidates = [(m, "movie") for m in matched_movies] + [(s, "series") for s in matched_series]

    if not candidates:
        # Fallback to any random movie
        if movies:
            choice_m = random.choice(movies)
            return {
                "item": serializer_movie(choice_m, db),
                "vibe": {
                    "key": vibe_def["key"],
                    "name": vibe_def["name"],
                    "emoji": vibe_def["emoji"],
                    "tagline": vibe_def["tagline"],
                    "badge_color": vibe_def["badge_color"],
                },
            }
        return None

    choice, mtype = random.choice(candidates)
    serialized = serializer_movie(choice, db) if mtype == "movie" else serializer_series(choice, db)
    return {
        "item": serialized,
        "vibe": {
            "key": vibe_def["key"],
            "name": vibe_def["name"],
            "emoji": vibe_def["emoji"],
            "tagline": vibe_def["tagline"],
            "badge_color": vibe_def["badge_color"],
        },
    }
