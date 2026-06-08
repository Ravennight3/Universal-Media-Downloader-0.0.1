#!/usr/bin/env python3
"""Universal Media Downloader — extraction engine.

Spawned by the Electron main process as a child process. Communication is via
NDJSON: every line on **stdout** is one self-contained JSON object that the Node
side parses independently. Human-readable diagnostics (and yt-dlp's own logging)
go to **stderr** so they never corrupt the JSON stream.

Usage
-----
    engine.py --mode metadata --url <URL>
    engine.py --mode download --url <URL> --format <FORMAT> [--out <DIR>]

stdout contract (one JSON object per line)
------------------------------------------
metadata mode:
    {"status": "metadata", "title": "...", "duration": "03:45", ...}
    {"status": "error", "error": "..."}

download mode:
    {"status": "downloading", "progress": 45.2, "speed": "12.0MB/s", "eta": "00:12"}
    {"status": "processing", "progress": 100.0}     # merge / post-process
    {"status": "finished", "progress": 100.0, "filename": "..."}
    {"status": "error", "error": "..."}

Errors never crash the process uncontrolled: they are caught and reported as a
structured {"status": "error", ...} line, with a non-zero exit code.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import threading

# Keep stdout/stderr as UTF-8 so non-ASCII titles can't raise UnicodeEncodeError
# on the Windows console code page, and force LINE BUFFERING so every progress
# line reaches the Electron side immediately (no stuck-at-0% bar). The spawner
# also sets PYTHONUNBUFFERED=1; emit() additionally flushes — belt and braces.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)  # type: ignore[attr-defined]
    except Exception:
        pass

_emit_lock = threading.Lock()


def emit(obj: dict) -> None:
    """Write one JSON object as a single, flushed line on stdout (thread-safe)."""
    line = json.dumps(obj, ensure_ascii=True)
    with _emit_lock:
        sys.stdout.write(line + "\n")
        sys.stdout.flush()


def log(msg: str) -> None:
    """Diagnostics to stderr — never pollutes the stdout JSON stream."""
    sys.stderr.write(f"[engine] {msg}\n")
    sys.stderr.flush()


class StderrLogger:
    """Routes all of yt-dlp's logging to stderr, keeping stdout clean."""

    def debug(self, msg: str) -> None:
        if not msg.startswith("[debug] "):
            sys.stderr.write(msg + "\n")

    def info(self, msg: str) -> None:
        sys.stderr.write(msg + "\n")

    def warning(self, msg: str) -> None:
        sys.stderr.write(msg + "\n")

    def error(self, msg: str) -> None:
        sys.stderr.write(msg + "\n")


# --- formatting helpers -----------------------------------------------------

def fmt_duration(seconds) -> str | None:
    if not seconds:
        return None
    seconds = int(seconds)
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    return f"{hours:d}:{minutes:02d}:{secs:02d}" if hours else f"{minutes:02d}:{secs:02d}"


def human_speed(bps) -> str | None:
    if not bps:
        return None
    value = float(bps)
    for unit in ("B/s", "KB/s", "MB/s", "GB/s"):
        if value < 1024 or unit == "GB/s":
            return f"{value:.1f}{unit}"
        value /= 1024
    return None


def codec_name(value) -> str | None:
    if not value or value == "none":
        return None
    return str(value).split(".")[0]


# --- tool discovery ---------------------------------------------------------

def find_ffmpeg() -> str | None:
    return os.environ.get("UMD_FFMPEG") or shutil.which("ffmpeg")


def find_aria2c() -> str | None:
    return os.environ.get("UMD_ARIA2C") or shutil.which("aria2c")


def find_deno() -> str | None:
    return os.environ.get("UMD_DENO") or shutil.which("deno")


def prepend_tool_paths() -> None:
    """Put the provisioned binaries (ffmpeg / aria2c / deno) on PATH so yt-dlp's
    own lookups find them — aria2c is resolved by name, and yt-dlp auto-detects
    a `deno` JS runtime on PATH for YouTube extraction."""
    for binary in (find_ffmpeg(), find_aria2c(), find_deno()):
        if binary and os.path.dirname(binary):
            os.environ["PATH"] = os.path.dirname(binary) + os.pathsep + os.environ.get("PATH", "")


# --- metadata mode ----------------------------------------------------------

def run_metadata(url: str) -> int:
    from yt_dlp import YoutubeDL

    opts = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "skip_download": True,
        "noplaylist": True,
        "logger": StderrLogger(),
    }

    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)

    # If a playlist slipped through, describe its first real entry.
    if info.get("entries"):
        entries = [e for e in info["entries"] if e]
        if not entries:
            emit({"status": "error", "error": "No downloadable media found at that URL."})
            return 1
        info = entries[0]

    formats = info.get("formats") or []

    heights = sorted(
        {
            int(f["height"])
            for f in formats
            if f.get("height") and codec_name(f.get("vcodec"))
        },
        reverse=True,
    )

    curated: list[dict] = []
    for height in heights:
        candidates = [
            f for f in formats
            if f.get("height") == height and codec_name(f.get("vcodec"))
        ]
        best = max(candidates, key=lambda f: (f.get("tbr") or 0))
        curated.append(
            {
                "label": f"{height}p",
                "height": height,
                "ext": best.get("ext"),
                "vcodec": codec_name(best.get("vcodec")),
                "acodec": codec_name(best.get("acodec")),
                "filesize": best.get("filesize") or best.get("filesize_approx"),
                "formatId": best.get("format_id"),
            }
        )

    audio_only = [
        f for f in formats
        if codec_name(f.get("acodec")) and not codec_name(f.get("vcodec"))
    ]
    has_any_audio = any(codec_name(f.get("acodec")) for f in formats)
    if audio_only:
        best_audio = max(audio_only, key=lambda f: (f.get("abr") or f.get("tbr") or 0))
        curated.append(
            {
                "label": "Audio Only",
                "height": None,
                "ext": best_audio.get("ext"),
                "vcodec": None,
                "acodec": codec_name(best_audio.get("acodec")),
                "filesize": best_audio.get("filesize") or best_audio.get("filesize_approx"),
                "formatId": best_audio.get("format_id"),
            }
        )
    elif has_any_audio and find_ffmpeg():
        # No standalone audio stream (e.g. TikTok serves one combined file), but
        # FFmpeg can extract the soundtrack from it into a clean MP3 — so still
        # offer the "Audio Only" capsule.
        curated.append(
            {
                "label": "Audio Only",
                "height": None,
                "ext": "mp3",
                "vcodec": None,
                "acodec": "mp3",
                "filesize": None,
                "formatId": None,
            }
        )

    qualities = [f["label"] for f in curated]
    if not qualities:
        # Extractors that don't expose discrete formats (some TikTok/IG URLs).
        qualities = ["Best"]

    emit(
        {
            "status": "metadata",
            "title": info.get("title"),
            "duration": fmt_duration(info.get("duration")),
            "durationSeconds": info.get("duration"),
            "thumbnail": info.get("thumbnail"),
            "uploader": info.get("uploader") or info.get("channel") or info.get("uploader_id"),
            "extractor": info.get("extractor_key") or info.get("extractor"),
            "webpageUrl": info.get("webpage_url") or url,
            "qualities": qualities,
            "formats": curated,
        }
    )
    return 0


# --- download mode ----------------------------------------------------------

def build_format(label: str, has_ffmpeg: bool) -> dict:
    """Translate a UI quality label (or raw selector) into a yt-dlp format spec."""
    token = (label or "").strip().lower()

    if token in ("audio", "audio only", "mp3", "bestaudio"):
        return {"format": "bestaudio/best", "audio": True}

    match = re.match(r"(\d{3,4})p?$", token)
    if match:
        height = int(match.group(1))
        if has_ffmpeg:
            # Codec/container preference (H.264 + MP4) is applied via format_sort;
            # keep the selector permissive so we reliably get the chosen height.
            selector = f"bestvideo[height<={height}]+bestaudio/best[height<={height}]/best"
        else:
            # No ffmpeg => can't merge; stick to progressive (audio+video in one file).
            selector = f"best[height<={height}][ext=mp4]/best[height<={height}]/best"
        return {"format": selector, "audio": False}

    if token in ("", "best", "auto"):
        selector = "bestvideo+bestaudio/best" if has_ffmpeg else "best[ext=mp4]/best"
        return {"format": selector, "audio": False}

    # Anything else is treated as a raw yt-dlp selector or explicit format id.
    return {"format": label, "audio": False}


def run_download(url: str, fmt: str, out_dir: str | None) -> int:
    from yt_dlp import YoutubeDL

    out_dir = out_dir or os.path.join(os.path.expanduser("~"), "Downloads")
    os.makedirs(out_dir, exist_ok=True)

    ffmpeg = find_ffmpeg()
    selection = build_format(fmt, bool(ffmpeg))

    state = {"last_file": None}

    def progress_hook(d: dict) -> None:
        status = d.get("status")
        if status == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            downloaded = d.get("downloaded_bytes") or 0
            if total:
                percent = downloaded / total * 100
            else:
                raw = re.sub(r"[^\d.]", "", d.get("_percent_str") or "0")
                percent = float(raw) if raw else 0.0
            emit(
                {
                    "status": "downloading",
                    "progress": round(percent, 1),
                    "speed": human_speed(d.get("speed")),
                    "eta": fmt_duration(d.get("eta")),
                    "downloaded": downloaded,
                    "total": total,
                }
            )
        elif status == "finished":
            state["last_file"] = d.get("filename")
            emit({"status": "processing", "progress": 100.0})

    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "noplaylist": True,
        "logger": StderrLogger(),
        "progress_hooks": [progress_hook],
        "format": selection["format"],
        "outtmpl": os.path.join(out_dir, "%(title).200B [%(id)s].%(ext)s"),
        "windowsfilenames": True,
        "retries": 5,
        "fragment_retries": 5,
        # Use yt-dlp's OWN downloader (not aria2c) so progress_hooks fire
        # continuously and the UI bar tracks smoothly. Concurrency covers
        # fragmented (HLS/DASH) media; http_chunk_size keeps single-file
        # downloads (e.g. TikTok) reporting fine-grained progress too.
        "concurrent_fragment_downloads": 16,
        "http_chunk_size": 10 * 1024 * 1024,
    }

    if not selection.get("audio"):
        # MP4 container by default, but RESOLUTION wins. "res" is listed first so
        # yt-dlp always grabs the highest-resolution DASH stream; "ext:mp4:m4a"
        # then prefers the MP4/M4A (H.264/AAC) rendition only to break ties at the
        # SAME height (so 1080p still plays everywhere, and TikTok still yields its
        # clean H.264 file).
        #
        # NOTE: a bare "vcodec:h264" here is a trap — format_sort fields outrank
        # resolution, so it silently caps YouTube at 1080p (the highest H.264 it
        # offers) and ignores the 1440p/2160p VP9/AV1 streams. That is exactly what
        # made high-quality picks look soft/pixelated. merge_output_format still
        # guarantees the final .mp4 container after the bestvideo+bestaudio merge.
        opts["merge_output_format"] = "mp4"
        opts["format_sort"] = ["res", "ext:mp4:m4a"]

    if ffmpeg:
        opts["ffmpeg_location"] = os.path.dirname(ffmpeg)

    if selection.get("audio"):
        if ffmpeg:
            # Extract/convert the soundtrack to a high-quality MP3 (V0 VBR) and
            # drop the source video. Works for sites with a dedicated audio
            # stream AND for combined-only sources like TikTok.
            opts["postprocessors"] = [
                {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "0"}
            ]
        else:
            log("FFmpeg not found; saving audio in its native container (no MP3 conversion)")

    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)

    # Resolve the FINAL path (after any merge / post-processing) rather than an
    # intermediate per-stream file captured by the progress hook.
    final_path = None
    if info:
        requested = info.get("requested_downloads") or []
        if requested:
            final_path = requested[0].get("filepath") or requested[0].get("_filename")
        final_path = final_path or info.get("filepath")

    emit({"status": "finished", "progress": 100.0, "filename": final_path or state["last_file"]})
    return 0


# --- entrypoint -------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="UMD extraction engine")
    parser.add_argument("--mode", required=True, choices=["metadata", "download"])
    parser.add_argument("--url", required=True)
    parser.add_argument("--format", default="best")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    # Ensure provisioned binaries are discoverable in both modes (metadata
    # extraction also benefits from a JS runtime for YouTube).
    prepend_tool_paths()

    try:
        if args.mode == "metadata":
            return run_metadata(args.url)
        return run_download(args.url, args.format, args.out)
    except Exception as exc:  # noqa: BLE001 — every failure becomes a clean JSON line
        # yt-dlp raises DownloadError for invalid URLs, geo-blocks, network issues…
        message = str(exc).strip() or exc.__class__.__name__
        # Strip yt-dlp's "ERROR: " prefix for a cleaner UI message.
        message = re.sub(r"^ERROR:\s*", "", message)
        emit({"status": "error", "error": message})
        log(f"fatal: {exc!r}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
