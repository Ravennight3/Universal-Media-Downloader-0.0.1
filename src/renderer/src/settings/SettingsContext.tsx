import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Theme = 'dark' | 'light'

interface SettingsValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  /** Effective download directory (custom override, or the OS default). */
  downloadDir: string
  /** Open the native picker and persist the chosen folder. */
  changeDownloadDir: () => Promise<void>
}

const SettingsContext = createContext<SettingsValue | null>(null)

const THEME_KEY = 'umd.theme'
const DIR_KEY = 'umd.downloadDir'

function initialTheme(): Theme {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null
  return saved === 'light' ? 'light' : 'dark' // premium dark is the default
}

export function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [defaultDir, setDefaultDir] = useState('')
  const [customDir, setCustomDir] = useState<string | null>(
    () => (typeof localStorage !== 'undefined' ? localStorage.getItem(DIR_KEY) : null)
  )

  // Apply the theme by toggling the `dark` class on <html> (Tailwind variant).
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  // Learn the OS default downloads folder so we can display it.
  useEffect(() => {
    window.api.getDownloadsPath().then(setDefaultDir).catch(() => setDefaultDir(''))
  }, [])

  const setTheme = useCallback((next: Theme) => setThemeState(next), [])

  const changeDownloadDir = useCallback(async () => {
    const chosen = await window.api.chooseFolder()
    if (chosen) {
      setCustomDir(chosen)
      try {
        localStorage.setItem(DIR_KEY, chosen)
      } catch {
        /* ignore */
      }
    }
  }, [])

  const downloadDir = customDir || defaultDir

  const value = useMemo<SettingsValue>(
    () => ({ theme, setTheme, downloadDir, changeDownloadDir }),
    [theme, setTheme, downloadDir, changeDownloadDir]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
