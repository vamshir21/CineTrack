"""
Tests for Franchise/Collections Binge Rails and Upcoming/OTT Hub.
"""
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.main import app
from backend.database import SessionLocal, init_db
from backend.models import Movie


class TestFranchisesAndUpcoming(unittest.TestCase):
    def setUp(self):
        init_db()
        self.client = TestClient(app)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_library_collections_endpoint(self):
        """Test GET /api/library/collections."""
        response = self.client.get("/api/library/collections")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        if len(data) > 0:
            first = data[0]
            self.assertIn("collection_id", first)
            self.assertIn("collection_name", first)
            self.assertIn("movies", first)

    def test_collection_detail_endpoint(self):
        """Test GET /api/library/collections/{collection_id}."""
        # Hunger Games collection ID
        response = self.client.get("/api/library/collections/131635")
        if response.status_code == 200:
            data = response.json()
            self.assertEqual(data.get("id"), 131635)
            self.assertIn("parts", data)
            self.assertIn("owned_count", data)
            self.assertIn("total_count", data)

    def test_upcoming_movies_endpoint(self):
        """Test GET /api/tmdb/upcoming."""
        response = self.client.get("/api/tmdb/upcoming")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("results", data)
        self.assertIsInstance(data["results"], list)

    def test_now_playing_endpoint(self):
        """Test GET /api/tmdb/now-playing."""
        response = self.client.get("/api/tmdb/now-playing")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("results", data)
        self.assertIsInstance(data["results"], list)

    def test_ott_releases_endpoint(self):
        """Test GET /api/tmdb/ott-releases."""
        response = self.client.get("/api/tmdb/ott-releases")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("results", data)
        self.assertIsInstance(data["results"], list)

    def test_watch_providers_endpoint(self):
        """Test GET /api/tmdb/movie/{tmdb_id}/providers."""
        response = self.client.get("/api/tmdb/movie/70160/providers")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("flatrate", data)
        self.assertIn("rent", data)
        self.assertIn("buy", data)

    def test_invalid_media_type_providers(self):
        """Test invalid media type returns 400."""
        response = self.client.get("/api/tmdb/invalid_type/70160/providers")
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
