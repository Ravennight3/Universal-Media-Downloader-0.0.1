import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { translations, type Dir, type Lang, type Strings } from './translations'

interface I18nValue {
  lang: Lang
  dir: Dir
  t: Strings
  setLang: (lang: Lang) => void
  toggle: () => void
}

const I18nContext = createContext<I18nValue | null>(null)

const STORAGE_KEY = 'umd.lang'

function initialLang(): Lang {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  return saved === 'ar' || saved === 'en' ? saved : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr'

  // Reflect the language onto <html> so dir/lang apply globally (scrollbars,
  // logical properties, fonts) and persist the choice across launches.
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore storage failures */
    }
  }, [lang, dir])

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const toggle = useCallback(() => setLangState((l) => (l === 'en' ? 'ar' : 'en')), [])

  const value = useMemo<I18nValue>(
    () => ({ lang, dir, t: translations[lang], setLang, toggle }),
    [lang, dir, setLang, toggle]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}
