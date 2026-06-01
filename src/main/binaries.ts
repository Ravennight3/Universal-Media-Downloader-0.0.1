import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { chmod, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'

/**
 * Provisions the native binaries yt-dlp relies on (FFmpeg for muxing/MP3, aria2c
 * for fast multi-connection downloads) into a writable `bin/` directory under the
 * app's user-data folder. Everything here is best-effort and silent: any failure
 * (offline, blocked, etc.) resolves to `null` so the engine simply falls back to
 * its degraded path and we retry on the next launch.
 */

export interface BinaryPaths {
  ffmpeg: string | null
  aria2c: string | null
  deno: string | null
}

type Logger = (msg: string) => void

const isWin = process.platform === 'win32'

// --- generic helpers --------------------------------------------------------

/** Streams a URL to a file, aborting if the transfer stalls for `stallMs`. */
async function downloadFile(url: string, dest: string, stallMs = 30_000): Promise<void> {
  const controller = new AbortController()
  let timer = setTimeout(() => controller.abort(), stallMs)
  const res = await fetch(url, {
    signal: controller.signal,
    headers: { 'User-Agent': 'UniversalMediaDownloader' },
    redirect: 'follow'
  })
  if (!res.ok || !res.body) {
    clearTimeout(timer)
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  const stream = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])
  stream.on('data', () => {
    clearTimeout(timer)
    timer = setTimeout(() => controller.abort(), stallMs)
  })
  try {
    await pipeline(stream, createWriteStream(dest))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Extracts only the wanted entries from a zip (matched by basename) into
 * `destDir`, skipping everything else — so we never unpack the hundreds of MB of
 * extra binaries inside an FFmpeg build. Returns the basenames actually written.
 */
function extractEntries(
  zipPath: string,
  wanted: Record<string, string>,
  destDir: string
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const written: string[] = []
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) {
        reject(err ?? new Error('failed to open archive'))
        return
      }
      zip.on('entry', (entry: yauzl.Entry) => {
        const base = entry.fileName.split('/').pop() ?? ''
        const destName = wanted[base]
        if (!destName || entry.fileName.endsWith('/')) {
          zip.readEntry()
          return
        }
        zip.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            zip.readEntry()
            return
          }
          const out = createWriteStream(join(destDir, destName))
          readStream.on('end', () => {
            written.push(destName)
            zip.readEntry()
          })
          readStream.on('error', reject)
          readStream.pipe(out)
        })
      })
      zip.on('end', () => resolve(written))
      zip.on('error', reject)
      zip.readEntry()
    })
  })
}

/** GET JSON with a timeout (used for GitHub release lookups). */
async function fetchJson<T>(url: string, timeoutMs = 12_000): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'UniversalMediaDownloader',
        Accept: 'application/vnd.github+json'
      }
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// --- FFmpeg -----------------------------------------------------------------

/** Resolves the platform-specific FFmpeg archive URL + entries to extract. */
function ffmpegSource(): { url: string; entries: Record<string, string> } | null {
  if (isWin) {
    // gyan.dev "essentials" — the lightweight static build (ffmpeg + ffprobe).
    return {
      url: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
      entries: { 'ffmpeg.exe': 'ffmpeg.exe', 'ffprobe.exe': 'ffprobe.exe' }
    }
  }
  // macOS / Linux provisioning to be added when we target those platforms.
  return null
}

async function ensureFfmpeg(binDir: string, log: Logger): Promise<string | null> {
  const dest = join(binDir, isWin ? 'ffmpeg.exe' : 'ffmpeg')
  if (existsSync(dest)) return dest

  const source = ffmpegSource()
  if (!source) {
    log(`FFmpeg auto-provisioning not yet supported on ${process.platform}`)
    return null
  }

  const tmpZip = join(binDir, 'ffmpeg.download.zip')
  try {
    log('downloading FFmpeg (~100 MB, one-time)…')
    await downloadFile(source.url, tmpZip)
    await extractEntries(tmpZip, source.entries, binDir)
    if (!isWin) {
      for (const name of Object.values(source.entries)) {
        await chmod(join(binDir, name), 0o755).catch(() => {})
      }
    }
    if (existsSync(dest)) {
      log(`FFmpeg ready: ${dest}`)
      return dest
    }
    log('FFmpeg archive did not contain the expected binary')
    return null
  } catch (err) {
    log(`FFmpeg provisioning failed (will retry next launch): ${String(err)}`)
    return null
  } finally {
    await rm(tmpZip, { force: true }).catch(() => {})
  }
}

// --- aria2c -----------------------------------------------------------------

interface GithubRelease {
  assets?: { name: string; browser_download_url: string }[]
}

async function aria2Source(): Promise<{ url: string; entries: Record<string, string> } | null> {
  if (!isWin) return null
  const release = await fetchJson<GithubRelease>(
    'https://api.github.com/repos/aria2/aria2/releases/latest'
  )
  const asset = release?.assets?.find((a) => /win-64bit.*\.zip$/i.test(a.name))
  if (!asset) return null
  return { url: asset.browser_download_url, entries: { 'aria2c.exe': 'aria2c.exe' } }
}

async function ensureAria2c(binDir: string, log: Logger): Promise<string | null> {
  if (!isWin) {
    log(`aria2c auto-provisioning not yet supported on ${process.platform}`)
    return null
  }
  const dest = join(binDir, 'aria2c.exe')
  if (existsSync(dest)) return dest

  const tmpZip = join(binDir, 'aria2.download.zip')
  try {
    const source = await aria2Source()
    if (!source) {
      log('could not resolve an aria2c download URL')
      return null
    }
    log('downloading aria2c (~2 MB)…')
    await downloadFile(source.url, tmpZip)
    await extractEntries(tmpZip, source.entries, binDir)
    if (existsSync(dest)) {
      log(`aria2c ready: ${dest}`)
      return dest
    }
    return null
  } catch (err) {
    log(`aria2c provisioning failed (will retry next launch): ${String(err)}`)
    return null
  } finally {
    await rm(tmpZip, { force: true }).catch(() => {})
  }
}

// --- Deno (JS runtime for YouTube extraction) -------------------------------

function denoSource(): { url: string; entries: Record<string, string> } | null {
  if (isWin) {
    return {
      url: 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip',
      entries: { 'deno.exe': 'deno.exe' }
    }
  }
  return null
}

async function ensureDeno(binDir: string, log: Logger): Promise<string | null> {
  const dest = join(binDir, isWin ? 'deno.exe' : 'deno')
  if (existsSync(dest)) return dest

  const source = denoSource()
  if (!source) {
    log(`Deno auto-provisioning not yet supported on ${process.platform}`)
    return null
  }

  const tmpZip = join(binDir, 'deno.download.zip')
  try {
    log('downloading Deno (~40 MB, one-time)…')
    await downloadFile(source.url, tmpZip)
    await extractEntries(tmpZip, source.entries, binDir)
    if (!isWin) await chmod(dest, 0o755).catch(() => {})
    if (existsSync(dest)) {
      log(`Deno ready: ${dest}`)
      return dest
    }
    return null
  } catch (err) {
    log(`Deno provisioning failed (will retry next launch): ${String(err)}`)
    return null
  } finally {
    await rm(tmpZip, { force: true }).catch(() => {})
  }
}

// --- public API -------------------------------------------------------------

/**
 * Ensures FFmpeg and aria2c exist in `binDir`, downloading any that are missing.
 * Runs the two provisioning tasks concurrently; never throws.
 */
export async function ensureBinaries(binDir: string, log: Logger): Promise<BinaryPaths> {
  mkdirSync(binDir, { recursive: true })
  const [ffmpeg, aria2c, deno] = await Promise.all([
    ensureFfmpeg(binDir, log),
    ensureAria2c(binDir, log),
    ensureDeno(binDir, log)
  ])
  return { ffmpeg, aria2c, deno }
}
