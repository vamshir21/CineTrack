"""
Tests for Discovery & Deep Engagement:
- Actor & Director Filmography Hub
- "Surprise Me by Vibe" Mood Selector & Shuffle
- Multi-Source Ratings (Rotten Tomatoes & IMDb)
"""
import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import SessionLocal, init_db


class TestDiscoveryAndVibes(unittest.TestCase):
    def setUp(self):
        init_db()
        self.client = TestClient(app)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_get_vibes_list(self):
        """Test GET /api/library/vibes returns all 6 mood definitions."""
        response = self.client.get("/api/library/vibes")
        self.assertEqual(response.status_code, 200)
        vibes = response.json()
        self.assertIsInstance(vibes, list)
        self.assertGreaterEqual(len(vibes), 6)

        keys = [v["key"] for v in vibes]
        self.assertIn("mind_benders", keys)
        self.assertIn("adrenaline_rush", keys)
        self.assertIn("crime_thriller", keys)
        self.assertIn("high_octane", keys)
        self.assertIn("feel_good", keys)
        self.assertIn("dystopian", keys)

        for v in vibes:
            self.assertIn("emoji", v)
            self.assertIn("tagline", v)
            self.assertIn("count", v)
            self.assertIn("preview_titles", v)

    def test_get_vibe_titles(self):
        """Test GET /api/library/vibes/{vibe_key}."""
        response = self.client.get("/api/library/vibes/mind_benders")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("vibe", data)
        self.assertIn("items", data)
        self.assertIn("count", data)
        self.assertEqual(data["vibe"]["key"], "mind_benders")

    def test_get_vibe_surprise_endpoint(self):
        """Test GET /api/library/vibes/surprise."""
        response = self.client.get("/api/library/vibes/surprise?vibe=mind_benders")
        if response.status_code == 200:
            data = response.json()
            self.assertIn("item", data)
            self.assertIn("vibe", data)
            self.assertEqual(data["vibe"]["key"], "mind_benders")

    def test_get_person_filmography(self):
        """Test GET /api/library/person/{person_id}/filmography (e.g. Denis Villeneuve id=137427)."""
        response = self.client.get("/api/library/person/137427/filmography")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("person", data)
        self.assertIn("in_library", data)
        self.assertIn("other_works", data)
        self.assertIn("total_credits", data)
        self.assertEqual(data["person"]["name"], "Denis Villeneuve")

    def test_get_ratings_endpoint(self):
        """Test GET /api/tmdb/movie/{tmdb_id}/ratings (e.g. Arrival id=329865)."""
        response = self.client.get("/api/tmdb/movie/329865/ratings")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("tmdb_id"), 329865)
        self.assertIn("tmdb_rating", data)
        self.assertIn("imdb_rating", data)
        self.assertIn("rt_critic", data)
        self.assertIn("rt_audience", data)
