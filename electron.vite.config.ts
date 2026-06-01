import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Electron main process — window lifecycle, native APIs.
  main: {},

  // Preload — the secure bridge between main and renderer.
  preload: {},

  // Renderer — the React + Tailwind UI.
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
