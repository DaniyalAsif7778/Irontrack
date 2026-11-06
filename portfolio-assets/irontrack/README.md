# IronTrack portfolio media

Portfolio-ready images and a short narrated project walkthrough.

## Files

- `irontrack-main.png` — primary project cover (1920 × 1080)
- `irontrack-routine.png` — prayer-anchored routine detail
- `irontrack-workout.png` — workout plan and set logging detail
- `irontrack-progress.png` — training, weight, and wellness overview
- `irontrack-demo.mp4` — 36-second landscape walkthrough with English narration and embedded captions
- `irontrack-demo.wav` — narration audio on its own
- `irontrack-demo.srt` — caption file for players that use sidecar subtitles
- `narration.txt` — voiceover script
- `*.svg` — editable vector sources for the four images

The screenshots are designed product illustrations based on IronTrack's current features. Names and metrics in the dashboard are sample values, not a real account. The voiceover uses the installed English Windows speech voice.

## Re-render

Run `node generate-showcase.mjs` to regenerate the vector artwork, `./render-images.ps1` to export the PNGs with Microsoft Edge headless, and `./render-video.ps1` to rebuild the narration and MP4. The scripts expect `ffmpeg`, `ffprobe`, and an English Windows speech voice to be installed.
