import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Keeps yt-dlp current. On startup it pings the yt-dlp GitHub Releases API for
 * the latest stable tag, compares it against the version installed in our venv,
 * and—if newer—silently upgrades it (pip replaces the package files). Throttled
 * to once per 24h and entirely best-effort: any failure (offline, rate-limited,
 * pip error) is swallowed so the app keeps working with whatever it already has.
 */

type Logger = (msg: string) => void

const THROTTLE_MS = 24 * 60 * 60 * 1000

interface UpdateState {
  lastCheck: number
  version?: string
}

/** Reads the venv's installed yt-dlp version, or null if it isn't importable. */
function getInstalledVersion(python: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(
      python,
      ['-c', 'import yt_dlp,sys; sys.stdout.write(yt_dlp.version.__version__)'],
      { windowsHide: true }
    )
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.on('error', () => resolve(null))
    child.on('close', () => resolve(out.trim() || null))
  })
}

/** Fetches the latest stable yt-dlp tag from GitHub (null on any failure). */
async function getLatestVersion(timeoutMs = 8000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'UniversalMediaDownloader',
        Accept: 'application/vnd.github+json'
      }
    })
    if (!res.ok) return null
    const data = (await res.json()) as { tag_name?: string }
    return data.tag_name?.trim() || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Compares dotted numeric versions (yt-dlp uses YYYY.MM.DD[.N]). */
function isNewer(remote: string, local: string): boolean {
  const parts = (v: string): number[] => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const r = parts(remote)
  const l = parts(local)
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const a = r[i] ?? 0
    const b = l[i] ?? 0
    if (a !== b) return a > b
  }
  return false
}

/** Upgrades yt-dlp in place via pip (replaces the package/module files). */
function pipUpgrade(python: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(
      python,
      ['-m', 'pip', 'install', '--upgrade', '--quiet', 'yt-dlp'],
      { windowsHide: true }
    )
    child.stderr.on('data', (d) => process.stderr.write(d))
    child.on('error', () => resolve(false))
    child.on('close', (code) => resolve(code === 0))
  })
}

function readState(file: string): UpdateState | null {
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as UpdateState
  } catch {
    return null
  }
}

function writeState(file: string, version: string): void {
  try {
    writeFileSync(file, JSON.stringify({ lastCheck: Date.now(), version } satisfies UpdateState))
  } catch {
    /* state is just an optimization; ignore write failures */
  }
}

/**
 * Checks for and applies a yt-dlp update. Safe to call on every startup — it
 * self-throttles and never throws. Set `UMD_FORCE_UPDATE=1` to bypass throttle.
 */
export async function ensureYtDlpUpToDate(
  python: string,
  stateDir: string,
  log: Logger
): Promise<void> {
  try {
    const stateFile = join(stateDir, 'ytdlp-update.json')
    const force = process.env.UMD_FORCE_UPDATE === '1'

    if (!force && existsSync(stateFile)) {
      const state = readState(stateFile)
      if (state && Date.now() - state.lastCheck < THROTTLE_MS) {
        log('skipped (checked < 24h ago)')
        return
      }
    }

    const local = await getInstalledVersion(python)
    if (!local) {
      log('yt-dlp is not importable; skipping update')
      return
    }

    const remote = await getLatestVersion()
    if (!remote) {
      log(`offline or unreachable; keeping current version (${local})`)
      writeState(stateFile, local)
      return
    }

    if (isNewer(remote, local)) {
      log(`updating ${local} → ${remote}…`)
      const ok = await pipUpgrade(python)
      log(ok ? `updated to ${remote}` : `update failed; keeping ${local}`)
      writeState(stateFile, ok ? remote : local)
    } else {
      log(`up to date (${local})`)
      writeState(stateFile, local)
    }
  } catch (err) {
    log(`update check errored (ignored): ${String(err)}`)
  }
}
