/**
 * The IPC contract shared across the Electron main process, the preload bridge,
 * and the React renderer — a single source of truth for the shapes that cross
 * the process boundary. This file is types only and emits no runtime code.
 *
 * Channels:
 *   renderer → main (send)   : `send-url`, `start-download`, `open-folder`,
 *                              `window-minimize`, `window-close`
 *   renderer → main (invoke) : `get-downloads-path`, `choose-folder`
 *   main → renderer          : `metadata`, `progress`
 */

/** A single selectable format/quality, curated from yt-dlp's format list. */
export interface MediaFormat {
  /** Human label, e.g. "1080p" or "Audio Only". */
  label: string
  height: number | null
  ext: string | null
  vcodec: string | null
  acodec: string | null
  filesize: number | null
  formatId: string | null
}

/** Metadata extracted from a URL by the engine (`metadata` mode). */
export interface VideoMetadata {
  title: string | null
  /** Pretty duration, e.g. "03:45" or "1:02:03". */
  duration: string | null
  durationSeconds: number | null
  thumbnail: string | null
  uploader: string | null
  /** yt-dlp extractor key, e.g. "Youtube", "TikTok". */
  extractor: string | null
  webpageUrl: string | null
  /** Quick labels for the UI, e.g. ["1080p", "720p", "Audio Only"]. */
  qualities: string[]
  formats: MediaFormat[]
}

/** Result delivered on the `metadata` channel — success or a handled error. */
export type MetadataResult =
  | { status: 'ok'; data: VideoMetadata }
  | { status: 'error'; error: string }

/** Real-time download status delivered on the `progress` channel. */
export interface DownloadProgress {
  status: 'downloading' | 'processing' | 'finished' | 'error'
  /** 0–100. */
  progress: number
  speed?: string | null
  eta?: string | null
  downloaded?: number | null
  total?: number | null
  filename?: string | null
  error?: string | null
}

/** The secure surface exposed on `window.api` by the preload script. */
export interface Api {
  /** Send a raw URL to the main process for metadata extraction. */
  sendUrl: (url: string) => void
  /** Start downloading a URL at the given quality/format label into `outDir`. */
  startDownload: (url: string, format: string, outDir?: string) => void
  /** Subscribe to metadata (or a handled error) once a URL is resolved. */
  onMetadata: (callback: (result: MetadataResult) => void) => void
  /** Subscribe to real-time download progress updates. */
  onProgress: (callback: (progress: DownloadProgress) => void) => void
  /** Reveal a finished download in the OS file manager. */
  openFolder: (filePath: string) => void
  /** Minimize the frameless window. */
  minimizeWindow: () => void
  /** Close the frameless window. */
  closeWindow: () => void
  /** The OS default downloads directory (initial save location). */
  getDownloadsPath: () => Promise<string>
  /** Open the native folder picker; resolves to the chosen path or null. */
  chooseFolder: () => Promise<string | null>
}
