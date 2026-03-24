#!/bin/bash
# EC2 Ubuntu Local Mode Setup Script for Clipity
# Run as: sudo bash setup-ec2.sh

set -e

echo "=== Clipity EC2 Ubuntu Setup ==="

# Update system
apt-get update
apt-get upgrade -y

# Install dependencies
apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    ffmpeg \
    python3 \
    python3-pip \
    sqlite3 \
    build-essential \
    pkg-config

# Install Bun
if ! command -v bun &> /dev/null; then
echo "Installing Bun..."
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
fi

# Install yt-dlp
echo "Installing yt-dlp..."
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
chmod +x /usr/local/bin/yt-dlp

# Install whisper.cpp (whisper-cli)
echo "Building whisper.cpp..."
cd /opt
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# Download a model (base is good for most use cases)
bash models/download-ggml-model.sh base

# Build whisper-cli
make

# Create symlink
ln -sf /opt/whisper.cpp/main /usr/local/bin/whisper-cli

# Create app directory
mkdir -p /opt/clipity
cd /opt/clipity

# Create data directories
mkdir -p data output assets

# Create environment file template
cat > .env << 'EOF'
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional overrides (defaults are fine for most cases)
WHISPER_MODEL=base
MAX_PARALLEL_CLIPS=3
OUTPUT_WIDTH=1080
OUTPUT_HEIGHT=1920

# Web server
PORT=3000
APP_URL=http://your-ec2-public-ip:3000

# Local mode (default - don't change)
APP_MODE=local
EOF

echo ""
echo "=== Setup Complete ==="
echo "Next steps:"
echo "1. Edit /opt/clipity/.env and add your GEMINI_API_KEY"
echo "2. Copy your application code to /opt/clipity/"
echo "3. Run: cd /opt/clipity && bun install"
echo "4. Start with: bun run src/web/server.ts"
echo ""
echo "Note: Open port 3000 in your EC2 security group"
