import { useI18n } from '../i18n/I18nContext'
import { cn, ui } from '../lib/ui'
import { CloseIcon, HistoryIcon, MinimizeIcon, SettingsIcon } from './icons'

export type View = 'main' | 'history' | 'settings'

interface Props {
  view: View
  onNavigate: (view: View) => void
}

/**
 * Frameless top header: navigation (History / Settings) + the quick language
 * toggle on the leading side, native window controls on the trailing side. The
 * whole bar is a drag region; interactive controls opt out via `app-no-drag`.
 * Everything mirrors automatically in RTL via flexbox logical alignment.
 */
export function Header({ view, onNavigate }: Props): React.JSX.Element {
  const { t, toggle } = useI18n()

  const go = (target: View): void => onNavigate(view === target ? 'main' : target)

  return (
    <header className="app-drag flex h-11 shrink-0 items-center justify-between px-2">
      <div className="app-no-drag flex items-center gap-1">
        <button
          type="button"
          aria-label={t.navHistory}
          title={t.navHistory}
          onClick={() => go('history')}
          className={cn(ui.iconBtn, 'h-7 w-7', view === 'history' && ui.iconBtnActive)}
        >
          <HistoryIcon />
        </button>
        <button
          type="button"
          aria-label={t.navSettings}
          title={t.navSettings}
          onClick={() => go('settings')}
          className={cn(ui.iconBtn, 'h-7 w-7', view === 'settings' && ui.iconBtnActive)}
        >
          <SettingsIcon />
        </button>
        <button
          type="button"
          onClick={toggle}
          className={cn(ui.iconBtn, 'h-7 px-2 text-[11px] font-medium')}
        >
          {t.switchLang}
        </button>
      </div>

      <div className="app-no-drag flex items-center gap-1">
        <button
          type="button"
          aria-label="Minimize"
          onClick={() => window.api.minimizeWindow()}
          className={cn(ui.iconBtn, 'h-7 w-7')}
        >
          <MinimizeIcon />
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={() => window.api.closeWindow()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-500/80 hover:text-white"
        >
          <CloseIcon />
        </button>
      </div>
    </header>
  )
}
