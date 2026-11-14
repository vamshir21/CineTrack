"""
Tests for Library Deletion, Watched Toggles, Stats, and Continue Watching cascade.
"""
import os
import sys
import unittest
import tempfile
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import Movie, TVSeries, Season, Episode, WatchHistory, Watchlist

class TestDeletionAndStats(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_library_stats(self):
        """Test GET /api/library/stats endpoint."""
        res = self.client.get("/api/library/stats")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("total_movies", data)
        self.assertIn("total_series", data)
        self.assertIn("total_episodes", data)
        self.assertIn("total_size_bytes", data)
        self.assertIn("total_size_formatted", data)
        self.assertIn("total_watch_seconds", data)
        self.assertIn("total_watch_formatted", data)
        self.assertIn("completed_titles", data)

    def test_mark_watched_and_unwatched_movie(self):
        """Test marking a movie watched and unwatched."""
        db = SessionLocal()
        # Create a test movie
        test_movie = Movie(
            title="Watched Test Movie",
            file_path="/tmp/test_watched_movie.mkv",
            runtime=120,
            file_size=1024 * 1024 * 500,
        )
        db.add(test_movie)
        db.commit()
        db.refresh(test_movie)
        movie_id = test_movie.id
        db.close()

        try:
            # Mark watched
            res = self.client.post("/api/library/watched", json={"media_type": "movie", "media_id": movie_id})
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.json()["status"], "marked_watched")

            # Check movie progress
            res_m = self.client.get(f"/api/library/movies/{movie_id}")
            self.assertEqual(res_m.status_code, 200)
            self.assertTrue(res_m.json()["progress"]["completed"])

            # Mark unwatched
            res_u = self.client.post("/api/library/unwatched", json={"media_type": "movie", "media_id": movie_id})
            self.assertEqual(res_u.status_code, 200)
            self.assertEqual(res_u.json()["status"], "marked_unwatched")

            # Check movie progress after unwatched
            res_m2 = self.client.get(f"/api/library/movies/{movie_id}")
            self.assertEqual(res_m2.status_code, 200)
            self.assertFalse(res_m2.json()["progress"]["completed"])
        finally:
            # Clean up
            db = SessionLocal()
            db.query(WatchHistory).filter(WatchHistory.media_type == "movie", WatchHistory.media_id == movie_id).delete()
            db.query(Movie).filter(Movie.id == movie_id).delete()
            db.commit()
            db.close()

    def test_delete_movie_without_file(self):
        """Test deleting a movie from library without deleting the file."""
        with tempfile.NamedTemporaryFile(suffix=".mkv", delete=False) as tf:
            tf.write(b"dummy movie data")
            temp_path = tf.name

        db = SessionLocal()
        movie = Movie(
            title="Temporary Movie to Delete",
            file_path=temp_path,
            runtime=90,
            file_size=16,
        )
        db.add(movie)
        db.commit()
        db.refresh(movie)
        movie_id = movie.id
        db.close()

        # Delete with delete_file=false
        res = self.client.delete(f"/api/library/movies/{movie_id}?delete_file=false")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["deleted"], movie_id)
        self.assertFalse(res.json()["file_deleted"])

        # File must STILL exist on disk
        self.assertTrue(os.path.exists(temp_path))

        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

    def test_delete_movie_with_permanent_file_deletion(self):
        """Test deleting a movie and permanently deleting the file on disk."""
        with tempfile.NamedTemporaryFile(suffix=".mkv", delete=False) as tf:
            tf.write(b"dummy movie data to be permanently erased")
            temp_path = tf.name

        self.assertTrue(os.path.exists(temp_path))

        db = SessionLocal()
        movie = Movie(
            title="Permanent Delete Movie",
            file_path=temp_path,
            runtime=90,
            file_size=42,
        )
        db.add(movie)
        db.commit()
        db.refresh(movie)
        movie_id = movie.id
        db.close()

        # Delete with delete_file=true
        res = self.client.delete(f"/api/library/movies/{movie_id}?delete_file=true")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["deleted"], movie_id)
        self.assertTrue(res.json()["file_deleted"])

        # File must be ERASED from disk!
        self.assertFalse(os.path.exists(temp_path))

    def test_delete_series_with_episodes_and_files(self):
        """Test deleting a TV series with cascade to episodes and disk files."""
        with tempfile.NamedTemporaryFile(suffix=".mkv", delete=False) as tf1, \
             tempfile.NamedTemporaryFile(suffix=".mkv", delete=False) as tf2:
            tf1.write(b"ep1 data")
            tf2.write(b"ep2 data")
            ep1_path = tf1.name
            ep2_path = tf2.name

        db = SessionLocal()
        series = TVSeries(title="Test Series For Delete", number_of_seasons=1)
        db.add(series)
        db.commit()
        db.refresh(series)

        season = Season(series_id=series.id, season_number=1, name="Season 1", episode_count=2)
        db.add(season)
        db.commit()
        db.refresh(season)

        ep1 = Episode(series_id=series.id, season_id=season.id, season_number=1, episode_number=1, title="Ep 1", file_path=ep1_path, file_size=8)
        ep2 = Episode(series_id=series.id, season_id=season.id, season_number=1, episode_number=2, title="Ep 2", file_path=ep2_path, file_size=8)
        db.add_all([ep1, ep2])
        db.commit()
        series_id = series.id
        db.close()

        # Delete series with delete_file=true
        res = self.client.delete(f"/api/library/series/{series_id}?delete_file=true")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["deleted"], series_id)
        self.assertEqual(res.json()["files_deleted_count"], 2)

        # Both files must be deleted from disk
        self.assertFalse(os.path.exists(ep1_path))
        self.assertFalse(os.path.exists(ep2_path))

    def test_continue_watching_removal_cascades_for_series(self):
        """Verify removing a TV episode or series clears all watch history for the series."""
        db = SessionLocal()
        series = TVSeries(title="Cascade Removal Test Show", number_of_seasons=1)
        db.add(series)
        db.commit()
        db.refresh(series)

        season = Season(series_id=series.id, season_number=1, name="Season 1", episode_count=2)
        db.add(season)
        db.commit()
        db.refresh(season)

        ep1 = Episode(series_id=series.id, season_id=season.id, season_number=1, episode_number=1, title="E1", file_path="/tmp/e1.mkv")
        ep2 = Episode(series_id=series.id, season_id=season.id, season_number=1, episode_number=2, title="E2", file_path="/tmp/e2.mkv")
        db.add_all([ep1, ep2])
        db.commit()
        db.refresh(ep1)
        db.refresh(ep2)

        # Add completed watch history for ep1
        wh1 = WatchHistory(media_type="episode", media_id=ep1.id, position_seconds=2000, duration_seconds=2000, completed=True)
        db.add(wh1)
        db.commit()

        # Calling remove on ep2 (up next) or ep1 removes the series entirely
        res = self.client.delete(f"/api/playback/continue-watching/episode/{ep2.id}")
        self.assertEqual(res.status_code, 200)

        # Check that watch history for ep1 was deleted
        remaining = db.query(WatchHistory).filter(WatchHistory.media_type == "episode", WatchHistory.media_id.in_([ep1.id, ep2.id])).count()
        self.assertEqual(remaining, 0)

        # Clean up
        db.delete(series)
        db.commit()
        db.close()


if __name__ == "__main__":
    unittest.main()
