/// <reference types="vite/client" />

import type { Api } from '../../preload/ipc-api'

// Make the preload's secure bridge visible to the renderer as a typed global.
declare global {
  interface Window {
    api: Api
  }
}
