# Scene Sync Agent

Automated pipeline for creating narrated video slideshows with frame-accurate timing using OpenAI Whisper and Remotion.

## Features

- **Whisper-based sync** — aligns image duration to narration using segment-level position mapping (no fragile text matching)
- **Sentiment-driven transitions** — 10 sentiment types with weighted transition selection based on narrative context
- **Ken Burns effect** — per-image zoom animations tied to sentiment intensity and narrative escalation
- **Multi-track audio** — per-chapter narration files with crossfaded background music tracks
- **Chapter pause overlay** — 2s inter-chapter break with title overlay and fade-to-black
- **Deterministic rendering** — all visual effects use seeded pseudo-random functions for reproducible output
- **GPU-accelerated** — ANGLE/DirectX 11 rendering via Remotion (beneficial on NVIDIA cards)

## Requirements

- Node.js 18+
- [ffmpeg](https://ffmpeg.org/) (in PATH)
- [OpenAI Whisper](https://github.com/openai/whisper) (`whisper` command in PATH)
- GPU with DirectX 11 support (recommended for faster rendering)

## Installation

```bash
git clone <repo-url>
cd <project>
npm run setup
```

## Project Structure

```
content/{channel-name}/{video-slug}/
├── INSTRUCCIONES.md          # Video metadata and chapter titles
├── guion.md                  # Full narration script with chapter sections
├── direccion.json            # Per-image metadata (sentiment, transitions, durations)
├── recursos/                 # Global resources (music tracks, intro/outro clips)
├── capitulo-01/
│   ├── narracion.mp3         # Per-chapter narration audio
│   ├── img-01.jpg            # Images (sorted alphabetically)
│   ├── img-02.jpg
│   └── ...
├── capitulo-02/
│   └── ...
└── ...
```

## Pipeline (3 steps)

```bash
# 1. Sync image durations to narration using Whisper
npx tsx src/scripts/sync-durations.ts content/{channel}/{video}

# 2. Build scenes from direction data
npm run build content/{channel}/{video}

# 3. Render final video
npm run render content/{channel}/{video}
```

Step 1 is only needed when audio or text content changes.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | Install all dependencies (npm + whisper) |
| `npm run build <dir>` | Build scenes from direction.json and content |
| `npm run render <dir>` | Render final video with GPU acceleration |
| `npm run validate <dir>` | Validate content structure |
| `npm run studio` | Launch Remotion Studio for preview |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run create-structure` | Scaffold new video directory structure |

## Key Configuration

| Constant | Value | Description |
|----------|-------|-------------|
| FPS | 30 | Frames per second |
| INTRO_FRAMES | 240 (8s) | Intro duration |
| OUTRO_FRAMES | 360 (12s) | Outro duration |
| CHAPTER_PAUSE_FRAMES | 60 (2s) | Inter-chapter pause |
| TRANSITION_FRAMES | 30 (1s) | Scene transition duration |
| CROSSFADE_FRAMES | 90 (3s) | Music crossfade duration |
| MUSIC_VOLUME | 0.10 | Background music level |
| Whisper model | `small` | Model size for transcription |
| Whisper language | `es` | Language (change per project) |

## Synchronization Algorithm

The pipeline uses **segment-level position mapping** instead of word-level text matching:

1. Count expected words per image from `textInclude`
2. Count words per Whisper segment from segment transcript
3. Map image word ranges to Whisper time positions proportionally
4. Interpolate segment boundaries for per-image start/end times
5. Scale total duration to match `audioDuration × FPS`

This approach is robust against ASR transcription errors (e.g., "Thorne" vs "Zorn") because it only uses word counts, not word identities.

See [`BLUEPRINT.md`](./BLUEPRINT.md) for detailed editing rules and algorithm reference.

## License

MIT
