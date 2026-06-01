// Builds the self-sufficient runtime that electron-builder embeds via
// extraResources, so the installed app needs NO system Python or tools:
//
//   resources/bin     -> FFmpeg + Aria2c + Deno (ffprobe dropped to stay lean)
//   resources/python  -> official Windows "embeddable" CPython + pip + yt-dlp
//
// Unlike a venv, the embeddable build is fully relocatable: it ships its own
// pythonXX.dll + zipped stdlib and ignores PYTHONHOME/PYTHONPATH/registry, so it
// runs identically on a clean Windows machine.
import {
  existsSync, mkdirSync, copyFileSync, statSync, createWriteStream,
  writeFileSync, readFileSync, readdirSync, rmSync
} from 'node:fs'
import { join, dirname } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const yauzl = require('yauzl')

const ROOT = process.cwd()
const PY_VERSION = '3.14.5'

// --- helpers ----------------------------------------------------------------

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'UMD-build' } })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('cannot open zip'))
      zip.on('entry', (entry) => {
        const out = join(destDir, entry.fileName)
        if (entry.fileName.endsWith('/')) {
          mkdirSync(out, { recursive: true })
          return zip.readEntry()
        }
        mkdirSync(dirname(out), { recursive: true })
        zip.openReadStream(entry, (e, rs) => {
          if (e || !rs) return reject(e ?? new Error('cannot read entry'))
          const ws = createWriteStream(out)
          rs.on('end', () => zip.readEntry())
          rs.on('error', reject)
          rs.pipe(ws)
        })
      })
      zip.on('end', resolve)
      zip.on('error', reject)
      zip.readEntry()
    })
  })
}

function prunePycache(dir) {
  if (!existsSync(dir)) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === '__pycache__') rmSync(p, { recursive: true, force: true })
      else prunePycache(p)
    }
  }
}

// --- 1) native binaries -----------------------------------------------------

function stageBinaries() {
  const projectBin = join(ROOT, 'resources', 'bin')
  const userBin = join(process.env.APPDATA ?? '', 'universal-media-downloader', 'bin')
  mkdirSync(projectBin, { recursive: true })
  for (const name of ['ffmpeg.exe', 'aria2c.exe', 'deno.exe']) {
    const dest = join(projectBin, name)
    if (existsSync(dest)) {
      console.log(`[prepare-resources] ${name} already staged`)
      continue
    }
    const src = join(userBin, name)
    if (!existsSync(src)) {
      throw new Error(`MISSING ${src} — launch the app once to provision binaries, then re-run.`)
    }
    copyFileSync(src, dest)
    console.log(`[prepare-resources] staged ${name} (${(statSync(dest).size / 1048576).toFixed(1)} MB)`)
  }
}

// --- 2) embeddable Python ---------------------------------------------------

async function buildEmbeddedPython() {
  const pyDir = join(ROOT, 'resources', 'python')
  const pyExe = join(pyDir, 'python.exe')

  // Idempotent: keep an existing build only if yt-dlp imports cleanly.
  if (existsSync(pyExe) && spawnSync(pyExe, ['-c', 'import yt_dlp'], { stdio: 'ignore' }).status === 0) {
    console.log('[prepare-resources] embedded python already built')
    return
  }
  rmSync(pyDir, { recursive: true, force: true })
  mkdirSync(pyDir, { recursive: true })

  console.log(`[prepare-resources] downloading Python ${PY_VERSION} embeddable…`)
  const zip = join(pyDir, 'python-embed.zip')
  await download(`https://www.python.org/ftp/python/${PY_VERSION}/python-${PY_VERSION}-embed-amd64.zip`, zip)
  await extractZip(zip, pyDir)
  rmSync(zip, { force: true })

  // Enable site-packages + the site module in the path-config file so pip works.
  const pthName = readdirSync(pyDir).find((f) => /^python\d+\._pth$/.test(f))
  if (!pthName) throw new Error('embeddable ._pth file not found')
  const pthPath = join(pyDir, pthName)
  let pth = readFileSync(pthPath, 'utf-8').replace(/#\s*import site/g, 'import site')
  if (!/Lib\\site-packages/.test(pth)) pth = pth.replace(/^\.\s*$/m, '.\r\nLib\\site-packages')
  writeFileSync(pthPath, pth)

  console.log('[prepare-resources] bootstrapping pip…')
  const getPip = join(pyDir, 'get-pip.py')
  await download('https://bootstrap.pypa.io/get-pip.py', getPip)
  if (spawnSync(pyExe, [getPip, '--no-warn-script-location'], { stdio: 'inherit' }).status !== 0)
    throw new Error('get-pip failed')
  rmSync(getPip, { force: true })

  console.log('[prepare-resources] installing yt-dlp…')
  if (spawnSync(pyExe, ['-m', 'pip', 'install', '--no-warn-script-location', '--no-cache-dir', 'yt-dlp'], { stdio: 'inherit' }).status !== 0)
    throw new Error('pip install yt-dlp failed')

  prunePycache(join(pyDir, 'Lib', 'site-packages'))

  const check = spawnSync(pyExe, ['-c', 'import yt_dlp,sys; sys.stdout.write(yt_dlp.version.__version__)'], { encoding: 'utf-8' })
  if (check.status !== 0) throw new Error('yt_dlp verification failed:\n' + (check.stderr || ''))
  console.log(`[prepare-resources] embedded python ready — yt-dlp ${check.stdout.trim()}`)
}

// --- run --------------------------------------------------------------------

try {
  stageBinaries()
  await buildEmbeddedPython()
  console.log('[prepare-resources] done')
} catch (err) {
  console.error('[prepare-resources] ' + String(err?.message ?? err))
  process.exit(1)
}
