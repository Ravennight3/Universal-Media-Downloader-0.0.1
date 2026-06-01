import { useI18n } from '../i18n/I18nContext'

/** Minimal grounding footer (language + navigation now live in the header). */
export function StatusBar(): React.JSX.Element {
  const { t } = useI18n()

  return (
    <footer className="flex h-9 shrink-0 items-center px-4 text-[11px] text-zinc-400 dark:text-zinc-600">
      <span className="truncate">{t.appName}</span>
    </footer>
  )
}
