#!/usr/bin/env python3
"""Quick backend sanity tests."""
import os
import sys
import requests

port = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("PORT", "8088")
BASE = f"http://127.0.0.1:{port}"

# Determine mode: live HTTP server or in-process TestClient
use_test_client = False
client = None
try:
    r = requests.get(f"{BASE}/health", timeout=1)
    if r.status_code != 200:
        use_test_client = True
except Exception:
    use_test_client = True

if use_test_client:
    print(f"No active server on {BASE}; running tests via in-process FastAPI TestClient...")
    from fastapi.testclient import TestClient
    from backend.main import app
    client = TestClient(app)
else:
    print(f"Testing live CineTrack server on {BASE}...")

def test(name, url, method="GET", data=None, expected=200):
    try:
        if use_test_client:
            if method == "GET":
                r = client.get(url)
            elif method == "POST":
                r = client.post(url, json=data)
        else:
            if method == "GET":
                r = requests.get(f"{BASE}{url}", timeout=5)
            elif method == "POST":
                r = requests.post(f"{BASE}{url}", json=data, timeout=5)
        ok = r.status_code == expected
        print(f"{'✓' if ok else '✗'} {name}: {r.status_code}")
        if not ok:
            print(f"  Response: {r.text[:200]}")
        return ok
    except Exception as e:
        print(f"✗ {name}: ERROR - {e}")
        return False
results = [
    test("Health check", "/health"),
    test("SPA Root (HTML)", "/"),
    test("Home data", "/api/library/home"),
    test("Random media item", "/api/library/random"),
    test("Movies list", "/api/library/movies"),
    test("Series list", "/api/library/series"),
    test("Media folders", "/api/scanner/folders"),
    test("Settings", "/api/settings/"),
    test("Settings batch update", "/api/settings/batch", method="POST", data={"auto_next_episode": "true", "completion_threshold_minutes": "2"}),
    test("Watchlist", "/api/watchlist/"),
    test("Search", "/api/search/?q=test"),
    test("Playback status", "/api/playback/status"),
    test("Playback toggle", "/api/playback/toggle", method="POST"),
    test("Scan status", "/api/scanner/scan/status"),
]

passed = sum(results)
total = len(results)
print(f"\n{'='*40}")
print(f"Results: {passed}/{total} tests passed")
sys.exit(0 if passed == total else 1)
