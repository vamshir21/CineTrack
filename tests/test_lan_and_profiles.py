"""
Unit tests for CineTrack LAN Streaming, Profiles, and Admin Permissions.
"""
import os
import tempfile
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base, get_db
from backend.main import app
from backend.models import Movie, TVSeries, Episode, Profile, WatchHistory, Watchlist


class TestLanAndProfiles(unittest.TestCase):
    def setUp(self):
        # Create temporary SQLite database for testing
        self.temp_db_fd, self.temp_db_path = tempfile.mkstemp(suffix=".db")
        self.engine = create_engine(f"sqlite:///{self.temp_db_path}", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=self.engine)
        self.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

        def override_get_db():
            db = self.TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

        # Populate test fixtures
        db = self.TestingSessionLocal()
        # Admin profile
        self.admin = Profile(name="Admin", avatar="netflix-red", is_admin=True)
        # Viewer profile
        self.viewer = Profile(name="Brother", avatar="netflix-blue", is_admin=False)
        db.add_all([self.admin, self.viewer])
        db.commit()
        db.refresh(self.admin)
        db.refresh(self.viewer)
        self.admin_id = self.admin.id
        self.viewer_id = self.viewer.id

        # Dummy movie file
        self.movie_fd, self.movie_file = tempfile.mkstemp(suffix=".mp4")
        with open(self.movie_file, "wb") as f:
            f.write(b"0" * 1024 * 10)  # 10KB test media

        self.movie = Movie(
            title="Inception",
            file_path=self.movie_file,
            runtime=148,
            vote_average=8.8,
        )
        db.add(self.movie)
        db.commit()
        db.refresh(self.movie)
        self.movie_id = self.movie.id
        db.close()

    def tearDown(self):
        app.dependency_overrides.clear()
        os.close(self.temp_db_fd)
        if os.path.exists(self.temp_db_path):
            os.remove(self.temp_db_path)
        os.close(self.movie_fd)
        if os.path.exists(self.movie_file):
            os.remove(self.movie_file)

    def test_list_and_create_profiles(self):
        """Test listing profiles and creating a new viewer profile."""
        res = self.client.get("/api/profiles")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 2)
        self.assertTrue(any(p["is_admin"] for p in data))

        # Create viewer profile
        res_create = self.client.post("/api/profiles", json={"name": "Sister", "avatar": "netflix-green"})
        self.assertEqual(res_create.status_code, 201)
        created = res_create.json()
        self.assertEqual(created["name"], "Sister")
        self.assertFalse(created["is_admin"])

    def test_admin_permission_on_delete(self):
        """Non-admin viewer CANNOT delete media; Admin CAN delete."""
        # Viewer tries to delete movie -> 403 Forbidden
        res_viewer = self.client.delete(
            f"/api/library/movies/{self.movie_id}",
            headers={"X-Profile-ID": str(self.viewer_id)}
        )
        self.assertEqual(res_viewer.status_code, 403)
        self.assertIn("Admin privileges required", res_viewer.json()["detail"])

        # Admin deletes movie -> 200 OK
        res_admin = self.client.delete(
            f"/api/library/movies/{self.movie_id}",
            headers={"X-Profile-ID": str(self.admin_id)}
        )
        self.assertEqual(res_admin.status_code, 200)

    def test_profile_isolated_watch_history(self):
        """Watch progress and watched status are strictly isolated per profile."""
        # Viewer marks movie as watched
        res_watch = self.client.post(
            "/api/library/watched",
            json={"media_type": "movie", "media_id": self.movie_id},
            headers={"X-Profile-ID": str(self.viewer_id)}
        )
        self.assertEqual(res_watch.status_code, 200)

        # Viewer checks movie: progress completed is True
        res_v_movie = self.client.get(
            f"/api/library/movies/{self.movie_id}",
            headers={"X-Profile-ID": str(self.viewer_id)}
        )
        self.assertTrue(res_v_movie.json()["watched"])
        self.assertTrue(res_v_movie.json()["progress"]["completed"])

        # Admin checks movie: progress completed is FALSE (unwatched for Admin!)
        res_a_movie = self.client.get(
            f"/api/library/movies/{self.movie_id}",
            headers={"X-Profile-ID": str(self.admin_id)}
        )
        self.assertFalse(res_a_movie.json()["watched"])
        self.assertFalse(res_a_movie.json()["progress"]["completed"])

    def test_profile_isolated_watchlist(self):
        """Watchlist items are strictly isolated per profile."""
        # Viewer adds movie to their watchlist
        self.client.post(
            "/api/watchlist",
            json={"media_type": "movie", "media_id": self.movie_id},
            headers={"X-Profile-ID": str(self.viewer_id)}
        )

        # Viewer's watchlist has 1 item
        wl_viewer = self.client.get("/api/watchlist", headers={"X-Profile-ID": str(self.viewer_id)}).json()
        self.assertEqual(len(wl_viewer), 1)

        # Admin's watchlist is empty!
        wl_admin = self.client.get("/api/watchlist", headers={"X-Profile-ID": str(self.admin_id)}).json()
        self.assertEqual(len(wl_admin), 0)

    def test_http_206_video_streaming(self):
        """In-browser HTML5 video streaming with byte-range requests."""
        # Request bytes 0-499 (500 bytes)
        headers = {"Range": "bytes=0-499"}
        res = self.client.get(f"/api/stream/movie/{self.movie_id}", headers=headers)
        self.assertEqual(res.status_code, 206)
        self.assertEqual(res.headers.get("Content-Range"), "bytes 0-499/10240")
        self.assertEqual(res.headers.get("Accept-Ranges"), "bytes")
        self.assertEqual(len(res.content), 500)

    def test_stream_progress_reporting(self):
        """In-browser player reports playback position scoped to active profile."""
        res = self.client.post(
            "/api/stream/progress",
            json={
                "media_type": "movie",
                "media_id": self.movie_id,
                "position_seconds": 1200.0,
                "duration_seconds": 7200.0,
                "completed": False,
            },
            headers={"X-Profile-ID": str(self.viewer_id)}
        )
        self.assertEqual(res.status_code, 200)

        # Verify progress is reflected on viewer's movie info
        movie_info = self.client.get(
            f"/api/library/movies/{self.movie_id}",
            headers={"X-Profile-ID": str(self.viewer_id)}
        ).json()
        self.assertEqual(movie_info["progress"]["position"], 1200.0)

    def test_lan_info_endpoint(self):
        """LAN connection info returns valid IP and port."""
        res = self.client.get("/api/lan/info")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("lan_ip", data)
        self.assertIn("lan_url", data)
        self.assertEqual(data["port"], 8088)


if __name__ == "__main__":
    unittest.main()
