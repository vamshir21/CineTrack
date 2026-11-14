#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🎬 Installing CineTrack Native Desktop App for Ubuntu..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 required. Install with: sudo apt install python3 python3-venv"
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js required. Install with: sudo apt install nodejs npm"
    exit 1
fi

# Check VLC
if ! command -v vlc &> /dev/null; then
    echo "⚠ VLC not found. Recommended: sudo apt install vlc"
fi

# Create venv
if [ ! -d "venv" ]; then
    echo "▶ Creating Python virtual environment..."
    python3 -m venv venv
fi

# Install Python deps including desktop GUI framework
echo "▶ Installing Python backend & desktop dependencies..."
./venv/bin/pip install -q \
    fastapi uvicorn sqlalchemy pydantic python-vlc \
    aiofiles requests python-dotenv alembic httpx websockets \
    pywebview PyQt6 PyQt6-WebEngine

# Install Node deps
echo "▶ Installing Node.js dependencies..."
cd frontend
npm install --silent
echo "▶ Building frontend..."
npm run build
cd ..

# Create app data directory
mkdir -p ~/.cinetrack/artwork

# Register Ubuntu desktop application launcher and icons
echo "▶ Registering Ubuntu desktop application launcher..."
mkdir -p ~/.local/share/applications
cp cinetrack.desktop ~/.local/share/applications/cinetrack.desktop
chmod +x ~/.local/share/applications/cinetrack.desktop

for s in 32 48 64 128 256 512; do
    mkdir -p ~/.local/share/icons/hicolor/${s}x${s}/apps
    cp assets/icon.png ~/.local/share/icons/hicolor/${s}x${s}/apps/cinetrack.png
done

update-desktop-database ~/.local/share/applications/ 2>/dev/null || true
gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor 2>/dev/null || true

echo ""
echo "✅ CineTrack Desktop App installed successfully!"
echo "   Launch from your Ubuntu app menu (search 'CineTrack') or run:"
echo "   ./launch-cinetrack.sh"
