#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🎬 Starting CineTrack Native Desktop App..."

# Check venv
if [ ! -d "venv" ]; then
    echo "⚠ Virtual environment not found. Run ./install.sh first."
    exit 1
fi

# Check frontend build
if [ ! -d "frontend/dist" ]; then
    echo "▶ Building frontend..."
    cd frontend && npm run build && cd ..
fi

# Launch the native desktop window application
exec ./venv/bin/python app.py "$@"
