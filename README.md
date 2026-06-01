# Universal Media Downloader (UMD)

## Project Overview
A highly scalable, auto-updating, and high-performance media downloader application. The app features a minimalist, elegant UI and uses a powerful backend to handle constant API changes from targeted websites (e.g., YouTube, TikTok).

## Architectural Principles
- **Elegant & Minimalist:** No clutter, dark-mode default, seamless UX.
- **Robustness:** Core extraction logic must auto-update independently of the app shell.
- **High Performance:** Multi-threaded downloads and efficient media processing.

## Tech Stack
- **Frontend:** Electron, React, Tailwind CSS, GSAP (for premium, smooth animations).
- **Backend / Engine:** Python (via `yt-dlp` executable/module) bundled with the app.
- **Accelerators & Processors:** `Aria2c` (for max download speeds), `FFmpeg` (for muxing/format conversion).

## Core Systems (AI Agent Instructions)
1. **Auto-Update Manager:** On launch, the app must ping `yt-dlp` GitHub releases and silently update the binary if a new version exists.
2. **Download Manager:** Intercepts URLs, fetches metadata (qualities, formats), and passes them to the Aria2c-enabled `yt-dlp` engine.
3. **Format Engine:** Handles precise arguments for MP3 conversion and TikTok watermark removal (`-S "vcodec:h264"` and extractor specific args).
4. **UI Controller:** State management using React context, with GSAP handling mount/unmount and progress bar animations.

## Development Constraints
- Strictly adhere to a minimalist design system.
- Ensure all error handling is graceful (no raw error text to the user).
- Modularity is key: Separate UI components from IPC (Inter-Process Communication) and backend scripts.