import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from './ipc-api'

/**
 * The preload script is the single, controlled bridge between the sandboxed
 * renderer and the Electron main process. It exposes a small, typed surface on
 * `window.api` — the renderer never touches `ipcRenderer` or Node directly.
 *
 * This is the seam the Python / yt-dlp engine will plug into later. For now the
 * channels are: renderer → main `send-url`, and main → renderer `metadata` /
 * `progress`.
 */
const api: Api = {
  // Renderer → main: hand a raw URL to the extraction engine.
  sendUrl: (url) => {
    ipcRenderer.send('send-url', url)
  },

  // Renderer → main: start downloading a URL at the chosen format/quality.
  startDownload: (url, format, outDir) => {
    ipcRenderer.send('start-download', url, format, outDir)
  },

  // Main → renderer: fires once metadata has been extracted for a URL.
  // removeAllListeners keeps this a single-subscriber channel, so repeated
  // calls (e.g. React StrictMode re-mounts) never stack duplicate listeners.
  onMetadata: (callback) => {
    ipcRenderer.removeAllListeners('metadata')
    ipcRenderer.on('metadata', (_event, data) => callback(data))
  },

  // Main → renderer: real-time download progress updates.
  onProgress: (callback) => {
    ipcRenderer.removeAllListeners('progress')
    ipcRenderer.on('progress', (_event, progress) => callback(progress))
  },

  // Renderer → main: reveal a finished file / drive the frameless window.
  openFolder: (filePath) => {
    ipcRenderer.send('open-folder', filePath)
  },
  minimizeWindow: () => {
    ipcRenderer.send('window-minimize')
  },
  closeWindow: () => {
    ipcRenderer.send('window-close')
  },

  // Renderer → main (request/response): download location helpers.
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path'),
  chooseFolder: () => ipcRenderer.invoke('choose-folder')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define on window when context isolation is disabled)
  window.api = api
}
