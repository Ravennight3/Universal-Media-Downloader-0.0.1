import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import type { IpcMainEvent } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import type { DownloadProgress, MetadataResult, VideoMetadata } from '../preload/ipc-api'
import { ensureBinaries, type BinaryPaths } from './binaries'
import { ensureYtDlpUpToDate } from './ytdlp-updater'

/**
 * Creates the application's main window.
 *
 * The window is intentionally frameless / borderless — we will build a custom
 * title bar (with our own drag region and window controls) in a later step.
 */
function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 780,
    height: 580,
    minWidth: 600,
    minHeight: 500,
    show: false,
    // Borderless + frameless. No native chrome — custom title bar comes later.
    frame: false,
    // Match the renderer's dark background so there is no white flash on load.
    backgroundColor: '#09090b', // Tailwind zinc-950
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // contextIsolation keeps the renderer sandboxed from Node; the preload
      // is the only bridge. sandbox is disabled so the bundled (CJS) preload
      // can run — we expose nothing privileged from it yet.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Open any target="_blank" / external links in the user's browser, never
  // inside an Electron window.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite sets ELECTRON_RENDERER_URL in development (the Vite dev
  // server). In production we load the built HTML file from disk.
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- Python engine plumbing -------------------------------------------------

/** Paths to the provisioned native binaries, populated on startup. */
let binaries: BinaryPaths = { ffmpeg: null, aria2c: null, deno: null }

/**
 * Builds the environment for the engine child process, injecting the provisioned
 * FFmpeg / aria2c paths (consumed explicitly by engine.py) and prepending their
 * directory to PATH so yt-dlp's own binary lookups succeed.
 */
function engineEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  // Force unbuffered Python stdout so NDJSON progress lines arrive in real time.
  env.PYTHONUNBUFFERED = '1'
  const dirs: string[] = []
  if (binaries.ffmpeg) {
    env.UMD_FFMPEG = binaries.ffmpeg
    dirs.push(dirname(binaries.ffmpeg))
  }
  if (binaries.aria2c) {
    env.UMD_ARIA2C = binaries.aria2c
    dirs.push(dirname(binaries.aria2c))
  }
  if (binaries.deno) {
    env.UMD_DENO = binaries.deno
    dirs.push(dirname(binaries.deno))
  }
  if (dirs.length > 0) {
    env.PATH = [...new Set(dirs)].join(delimiter) + delimiter + (env.PATH ?? '')
  }
  return env
}

/**
 * Background startup tasks: keep yt-dlp current and provision FFmpeg / aria2c.
 * Both are best-effort and non-blocking — the window opens immediately and
 * downloads work in a degraded mode until provisioning finishes.
 */
function initEngineEnvironment(): void {
  const python = resolvePython()
  const userData = app.getPath('userData')

  ensureYtDlpUpToDate(python, userData, (m) => console.log(`[updater] ${m}`)).catch((e) =>
    console.log(`[updater] ${String(e)}`)
  )

  ensureBinaries(resolveBinDir(), (m) => console.log(`[provision] ${m}`))
    .then((paths) => {
      binaries = paths
      console.log(
        `[provision] ready — ffmpeg=${paths.ffmpeg ?? 'none'} aria2c=${paths.aria2c ?? 'none'} deno=${paths.deno ?? 'none'}`
      )
    })
    .catch((e) => console.log(`[provision] ${String(e)}`))
}

/** Resolves the Python interpreter that runs the extraction engine. */
function resolvePython(): string {
  const override = process.env.UMD_PYTHON
  if (override && existsSync(override)) return override

  // Packaged: a relocatable embeddable Python is embedded at resources/python
  // (python.exe sits at its root — it is not a venv).
  if (app.isPackaged) {
    const embedded =
      process.platform === 'win32'
        ? join(process.resourcesPath, 'python', 'python.exe')
        : join(process.resourcesPath, 'python', 'bin', 'python3')
    if (existsSync(embedded)) return embedded
  }

  // Dev: the project venv at the app root.
  const rel = process.platform === 'win32' ? join('Scripts', 'python.exe') : join('bin', 'python')
  const devVenv = join(app.getAppPath(), '.venv', rel)
  if (existsSync(devVenv)) return devVenv

  // Last resort: whatever Python is on PATH.
  return process.platform === 'win32' ? 'python' : 'python3'
}

/** Resolves the engine.py script across dev and packaged builds. */
function resolveEnginePath(): string {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'engine.py'), join(__dirname, 'engine.py')]
    : [join(app.getAppPath(), 'src', 'main', 'engine.py'), join(__dirname, 'engine.py')]
  return candidates.find(existsSync) ?? candidates[0]
}

/**
 * Directory holding the native binaries. In a packaged build they are embedded
 * (and already present) under resources/bin; in dev they are provisioned into
 * the writable userData/bin on first launch.
 */
function resolveBinDir(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'bin')
    : join(app.getPath('userData'), 'bin')
}

interface EngineHandlers {
  /** Called once per JSON object emitted on the engine's stdout. */
  onJson: (obj: Record<string, unknown>) => void
  /** Called if the engine process itself fails to start. */
  onError: (message: string) => void
  /** Called when the process exits, with its exit code. */
  onClose?: (code: number | null) => void
}

/**
 * Spawns the engine and parses its stdout as NDJSON — one JSON object per line —
 * forwarding each parsed object as it arrives. yt-dlp's own logging is written
 * to stderr, so it never corrupts the JSON stream.
 */
function spawnEngine(args: string[], handlers: EngineHandlers): void {
  const python = resolvePython()
  const script = resolveEnginePath()
  const child = spawn(python, [script, ...args], { windowsHide: true, env: engineEnv() })

  let buffer = ''

  child.stdout.setEncoding('utf-8')
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk
    let newlineIndex: number
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (!line) continue
      try {
        handlers.onJson(JSON.parse(line))
      } catch {
        // A non-JSON line should never reach stdout; ignore defensively.
      }
    }
  })

  child.stderr.setEncoding('utf-8')
  child.stderr.on('data', (chunk: string) => {
    process.stderr.write(chunk) // mirror engine diagnostics into the dev console
  })

  child.on('error', (err) => {
    handlers.onError(`Failed to start the engine (${python}): ${err.message}`)
  })

  child.on('close', (code) => {
    const tail = buffer.trim()
    if (tail) {
      try {
        handlers.onJson(JSON.parse(tail))
      } catch {
        /* ignore trailing partial line */
      }
    }
    handlers.onClose?.(code)
  })
}

/** Safe reply helper — never throws if the window was closed mid-task. */
function replyTo(event: IpcMainEvent, channel: string, payload: unknown): void {
  if (!event.sender.isDestroyed()) {
    event.sender.send(channel, payload)
  }
}

/** Runs the engine in metadata mode and replies on the `metadata` channel. */
function handleMetadata(event: IpcMainEvent, url: string): void {
  console.log(`[ipc] metadata request: ${url}`)
  let replied = false
  const reply = (result: MetadataResult): void => {
    if (replied) return
    replied = true
    replyTo(event, 'metadata', result)
  }

  spawnEngine(['--mode', 'metadata', '--url', url], {
    onJson: (obj) => {
      if (obj.status === 'metadata') {
        reply({ status: 'ok', data: obj as unknown as VideoMetadata })
      } else if (obj.status === 'error') {
        reply({ status: 'error', error: String(obj.error ?? 'Unknown engine error') })
      }
    },
    onError: (message) => reply({ status: 'error', error: message }),
    onClose: (code) => {
      if (!replied) reply({ status: 'error', error: `Engine exited with code ${code}.` })
    }
  })
}

/** Runs the engine in download mode and streams the `progress` channel. */
function handleDownload(event: IpcMainEvent, url: string, format: string, outDir?: string): void {
  console.log(`[ipc] download request: ${url} @ ${format}${outDir ? ` -> ${outDir}` : ''}`)

  const args = ['--mode', 'download', '--url', url, '--format', format]
  if (outDir) args.push('--out', outDir)

  spawnEngine(args, {
    onJson: (obj) => replyTo(event, 'progress', obj as unknown as DownloadProgress),
    onError: (message) =>
      replyTo(event, 'progress', { status: 'error', progress: 0, error: message } as DownloadProgress)
    // The engine emits a structured {status:'error'} line on failure, so a
    // non-zero exit needs no extra handling here.
  })
}

/** Wires the renderer → main IPC channels to the Python engine. */
function registerIpcHandlers(): void {
  ipcMain.on('send-url', (event, url: string) => handleMetadata(event, url))
  ipcMain.on('start-download', (event, url: string, format: string, outDir?: string) =>
    handleDownload(event, url, format, outDir)
  )

  // Reveal a finished download in the OS file manager.
  ipcMain.on('open-folder', (_event, filePath: string) => {
    if (filePath) shell.showItemInFolder(filePath)
  })

  // Custom frameless-window controls.
  ipcMain.on('window-minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
  ipcMain.on('window-close', (event) => BrowserWindow.fromWebContents(event.sender)?.close())

  // The OS default downloads folder (shown as the initial save location).
  ipcMain.handle('get-downloads-path', () => app.getPath('downloads'))

  // Native folder picker for choosing a custom download location.
  ipcMain.handle('choose-folder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Choose download folder',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  initEngineEnvironment()
  createWindow()

  app.on('activate', () => {
    // macOS: re-create a window when the dock icon is clicked and none are open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Quit on all platforms except macOS, where apps stay alive until Cmd+Q.
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
