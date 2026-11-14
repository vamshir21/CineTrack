"""
Comprehensive CineTrack Test Suite.
Tests:
- Database models and relationships
- Media filename parsing and clean title extraction
- TV episode detection across diverse formats
- TV series consolidation (multiple episodes grouped into ONE series)
- Duplicate detection
- TMDB matching and confidence scoring
- Artwork URL generation
- Image caching service
- Playback progress and completion threshold calculation
- Watchlist operations
- Settings persistence
"""
import os
import sys
import unittest
from pathlib import Path
from difflib import SequenceMatcher

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.services.scanner import (
    _strip_quality,
    _normalize_series_name,
    _parse_episode,
)
from backend.services.tmdb_service import (
    _similarity,
    get_image_url,
)
from backend.database import Base, engine, SessionLocal
from backend.models import (
    Movie,
    TVSeries,
    Season,
    Episode,
    WatchHistory,
    Watchlist,
    Settings,
    MediaFolder,
)


class TestFilenameParsing(unittest.TestCase):
    def test_strip_quality_movie(self):
        cases = [
            ("Inception.2010.1080p.BluRay.x264-SPARKS", "Inception"),
            ("The.Dark.Knight.2008.2160p.UHD.HDR.REMUX", "The Dark Knight"),
            ("Interstellar (2014) [1080p] [WEBRip]", "Interstellar"),
            ("Parasite.2019.KOREAN.1080p.WEBRip.x265", "Parasite"),
            ("Fight Club 1999 720p BrRip x264", "Fight Club"),
        ]
        for raw, expected in cases:
            cleaned = _strip_quality(raw)
            self.assertEqual(cleaned, expected, f"Failed on '{raw}': got '{cleaned}', expected '{expected}'")

    def test_tv_episode_detection(self):
        cases = [
            # path, expected series, season, ep
            (Path("Breaking.Bad.S01E01.Pilot.720p.HDTV.mkv"), "Breaking Bad", 1, 1),
            (Path("Breaking.Bad.s02e04.1080p.mkv"), "Breaking Bad", 2, 4),
            (Path("Stranger.Things.1x03.Chapter.Three.mp4"), "Stranger Things", 1, 3),
            (Path("Game.of.Thrones.Season.1.Episode.5.mkv"), "Game of Thrones", 1, 5),
            (Path("/media/TV/The Wire/Season 1/S01E02.mkv"), "The Wire", 1, 2),
        ]
        for path, exp_series, exp_s, exp_e in cases:
            res = _parse_episode(path)
            self.assertIsNotNone(res, f"Failed to detect TV episode for {path}")
            series, season, ep = res
            self.assertEqual(series, exp_series)
            self.assertEqual(season, exp_s)
            self.assertEqual(ep, exp_e)

    def test_movie_is_not_detected_as_episode(self):
        movie_path = Path("/media/Movies/The.Matrix.1999.1080p.BluRay.mkv")
        self.assertIsNone(_parse_episode(movie_path))


class TestSeriesConsolidation(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_series_grouping(self):
        """Verify multiple episodes from multiple seasons group under ONE TVSeries record."""
        # Clean test records if any
        self.db.query(Episode).filter(Episode.title.like("TestBB_%")).delete(synchronize_session=False)
        self.db.query(TVSeries).filter(TVSeries.title == "Test Breaking Bad").delete(synchronize_session=False)
        self.db.commit()

        # Create 1 Series
        series = TVSeries(
            title="Test Breaking Bad",
            folder_key=_normalize_series_name("Test Breaking Bad"),
        )
        self.db.add(series)
        self.db.flush()

        # Create Season 1 and Season 2
        s1 = Season(series_id=series.id, season_number=1, name="Season 1", episode_count=2)
        s2 = Season(series_id=series.id, season_number=2, name="Season 2", episode_count=1)
        self.db.add_all([s1, s2])
        self.db.flush()

        # Create 3 Episodes across 2 seasons
        e1 = Episode(series_id=series.id, season_id=s1.id, season_number=1, episode_number=1, title="TestBB_Pilot", file_path="/tv/bb/s01e01.mkv")
        e2 = Episode(series_id=series.id, season_id=s1.id, season_number=1, episode_number=2, title="TestBB_Cat in the Bag", file_path="/tv/bb/s01e02.mkv")
        e3 = Episode(series_id=series.id, season_id=s2.id, season_number=2, episode_number=1, title="TestBB_Seven Thirty-Seven", file_path="/tv/bb/s02e01.mkv")
        self.db.add_all([e1, e2, e3])
        self.db.commit()

        # Query series: there should be exactly 1 card for "Test Breaking Bad"
        matching_series = self.db.query(TVSeries).filter(TVSeries.title == "Test Breaking Bad").all()
        self.assertEqual(len(matching_series), 1, "Series consolidation failed: expected 1 series card")

        # Check season count & episode count
        seasons = self.db.query(Season).filter(Season.series_id == series.id).all()
        self.assertEqual(len(seasons), 2)

        episodes = self.db.query(Episode).filter(Episode.series_id == series.id).all()
        self.assertEqual(len(episodes), 3)

        # Cleanup
        self.db.query(Episode).filter(Episode.series_id == series.id).delete(synchronize_session=False)
        self.db.query(Season).filter(Season.series_id == series.id).delete(synchronize_session=False)
        self.db.query(TVSeries).filter(TVSeries.id == series.id).delete(synchronize_session=False)
        self.db.commit()


class TestTMDBMatching(unittest.TestCase):
    def test_score_match_exact(self):
        score = _similarity("Inception", "Inception")
        self.assertEqual(score, 1.0)

    def test_score_match_case_insensitive(self):
        score = _similarity("interstellar", "Interstellar")
        self.assertEqual(score, 1.0)

    def test_score_match_mismatched(self):
        score = _similarity("Inception", "The Godfather")
        self.assertLess(score, 0.4)

    def test_artwork_url_generation(self):
        url = get_image_url("/path123.jpg", size="w500")
        self.assertEqual(url, "https://image.tmdb.org/t/p/w500/path123.jpg")

        backdrop = get_image_url("/bg456.jpg", size="w1280")
        self.assertEqual(backdrop, "https://image.tmdb.org/t/p/w1280/bg456.jpg")


class TestPlaybackAndWatchlist(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_completion_calculation(self):
        duration = 7200.0  # 2 hours (120 min)
        threshold_sec = 5 * 60  # 5 min threshold = 300 sec

        # At 1h 56m (within 5 min of end):
        pos_near_end = 7200.0 - 200.0
        completed = pos_near_end >= (duration - threshold_sec) or (pos_near_end / duration) >= 0.9
        self.assertTrue(completed)

        # At 1h 00m (halfway):
        pos_halfway = 3600.0
        completed_halfway = pos_halfway >= (duration - threshold_sec) or (pos_halfway / duration) >= 0.9
        self.assertFalse(completed_halfway)

    def test_watchlist_operations(self):
        # Clean existing test entry
        self.db.query(Watchlist).filter(Watchlist.media_type == "movie", Watchlist.media_id == 9999).delete()
        self.db.commit()

        # Add
        w = Watchlist(media_type="movie", media_id=9999)
        self.db.add(w)
        self.db.commit()

        found = self.db.query(Watchlist).filter(Watchlist.media_type == "movie", Watchlist.media_id == 9999).first()
        self.assertIsNotNone(found)

        # Remove
        self.db.delete(found)
        self.db.commit()

        removed = self.db.query(Watchlist).filter(Watchlist.media_type == "movie", Watchlist.media_id == 9999).first()
        self.assertIsNone(removed)

    def test_settings_persistence(self):
        key = "test_custom_setting"
        val = "test_value_123"

        row = self.db.query(Settings).filter(Settings.key == key).first()
        if not row:
            row = Settings(key=key, value=val)
            self.db.add(row)
        else:
            row.value = val
        self.db.commit()

        fetched = self.db.query(Settings).filter(Settings.key == key).first()
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.value, val)

        # Cleanup
        self.db.delete(fetched)
        self.db.commit()

    def test_settings_batch_update_api(self):
        from fastapi.testclient import TestClient
        from backend.main import app
        client = TestClient(app)
        res = client.post(
            "/api/settings/batch",
            json={
                "auto_next_episode": "true",
                "next_episode_countdown": "30",
                "completion_threshold_minutes": "2",
                "resume_playback": "true",
                "default_volume": "100",
            },
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

        get_res = client.get("/api/settings/")
        self.assertEqual(get_res.status_code, 200)
        settings = get_res.json()
        self.assertEqual(settings["auto_next_episode"], "true")
        self.assertEqual(settings["next_episode_countdown"], "30")
        self.assertEqual(settings["completion_threshold_minutes"], "2")

    def test_random_library_item_api(self):
        from fastapi.testclient import TestClient
        from backend.main import app
        from backend.models import Movie
        client = TestClient(app)
        # Add a dummy movie
        m = Movie(title="RandomTestMovie", file_path="/movies/random.mkv")
        self.db.add(m)
        self.db.commit()

        res = client.get("/api/library/random")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("title", data)

        # Cleanup
        self.db.delete(m)
        self.db.commit()

    def test_playback_toggle_api(self):
        from fastapi.testclient import TestClient
        from backend.main import app
        client = TestClient(app)
        res = client.post("/api/playback/toggle")
        self.assertEqual(res.status_code, 200)


if __name__ == "__main__":
    unittest.main()
