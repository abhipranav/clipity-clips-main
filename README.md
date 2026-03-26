# jiang-clips

Automated short-form clip extraction pipeline for YouTube videos using AI.

## SaaS MVP

This repo now also includes a lightweight browser-based SaaS MVP shell on top of the existing pipeline.

```bash
# Start the web app
bun run web
```

Open `http://localhost:3000` to:

- submit a YouTube URL
- view recent runs
- inspect per-run stage progress
- inspect per-clip progress
- open final reel artifacts from the browser

Current scope:

- in-process background execution
- uses the existing checkpoint database
- no auth, billing, uploads, or external job queue yet

This is intended as the first productization layer, not the final production architecture.

## Prerequisites

- **Runtime**: Bun
- **FFmpeg**: Required for video processing
- **Google Gemini API Key**: Required for AI content generation

## Setup

```bash
# Install dependencies
bun install

# Set environment variables
export GEMINI_API_KEY="your-api-key"
```

## Usage

```bash
# Run the pipeline on a single video
bun run src/index.ts pipeline <youtube-url>

# Batch process a channel
bun run src/index.ts batch <channel-url>

# Resume a previous run
bun run src/index.ts resume <run-id>

# Check status
bun run src/index.ts status [run-id]

# Clean up a run
bun run src/index.ts clean <run-id>

# Rename reels from UUID to title (dry run)
bun run rename:titles -- --run <run-id> --output-dir output/<video-id>

# Apply rename
bun run rename:titles -- --run <run-id> --output-dir output/<video-id> --apply
```

## Configuration

Environment variables (all optional with defaults):

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | (required) | Google Gemini API key |
| `WHISPER_MODEL` | `base` | Whisper model size (tiny\|base\|small\|medium\|large) |
| `MAX_PARALLEL_CLIPS` | `3` | Max parallel clip processing (1-10) |
| `SILENCE_THRESHOLD_DB` | `-35` | Silence detection threshold |
| `OUTPUT_WIDTH` | `1080` | Output video width |
| `OUTPUT_HEIGHT` | `1920` | Output video height |
| `FFMPEG_THREADS` | `2` (local) | FFmpeg thread cap (`0` = auto/all cores) |
| `FFMPEG_PRESET` | `veryfast` (local) | x264 preset (`ultrafast`..`veryslow`) |
| `FFMPEG_CRF` | `23` (local) | Quality/compression target (higher = cooler/smaller) |
| `YTDLP_RETRY_ATTEMPTS` | `6` | Total yt-dlp attempts across fallback client profiles |
| `YTDLP_RETRY_BASE_DELAY_MS` | `1500` | Linear backoff base delay between attempts |
| `YTDLP_USE_IPV4` | `true` | Force IPv4 for yt-dlp requests (helps on some EC2 networks) |
| `YTDLP_PROXY_URLS` | (empty) | Optional comma-separated proxy URLs for automatic rotation |

## Testing

```bash
bun test                     # All tests
bun test tests/utils         # Single test directory
bun test tests/utils/fs.test.ts  # Single test file
```

## Linting & Formatting

```bash
oxlint                       # Lint src/ and tests/
oxfmt --write src tests      # Format and write changes
oxfmt --check src tests      # Check formatting without writing
```

## Project Structure

```
src/
├── index.ts          # CLI entry point
├── config.ts         # Configuration schema
├── pipeline/         # Pipeline orchestration
├── modules/          # Processing modules
├── utils/            # Utilities
└── remotion/         # Video rendering

tests/
├── pipeline/
├── modules/
└── utils/
```
