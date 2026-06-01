import type { ReactNode } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { useSettings } from '../settings/SettingsContext'
import { cn, ui } from '../lib/ui'
import type { Lang } from '../i18n/translations'
import type { Theme } from '../settings/SettingsContext'
import { FolderIcon, MoonIcon, SunIcon } from './icons'

interface Option<T extends string> {
  value: T
  label: ReactNode
}

function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: Array<Option<T>>
  onChange: (value: T) => void
}): React.JSX.Element {
  return (
    <div className={ui.segTrack}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(ui.segBase, value === opt.value ? ui.segActive : ui.segIdle)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: ReactNode }): React.JSX.Element {
  return (
    <div className={cn(ui.row, 'flex flex-wrap items-center justify-between gap-3 p-4')}>
      <span className={cn(ui.heading, 'text-sm')}>{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

/** Settings — language, appearance (theme), and download location. */
export function SettingsPage(): React.JSX.Element {
  const { t, lang, setLang } = useI18n()
  const { theme, setTheme, downloadDir, changeDownloadDir } = useSettings()

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <h1 className={cn(ui.heading, 'text-sm font-medium')}>{t.settingsTitle}</h1>

        <SettingRow label={t.language}>
          <Segmented<Lang>
            value={lang}
            onChange={setLang}
            options={[
              { value: 'en', label: 'English' },
              { value: 'ar', label: 'العربية' }
            ]}
          />
        </SettingRow>

        <SettingRow label={t.appearance}>
          <Segmented<Theme>
            value={theme}
            onChange={setTheme}
            options={[
              {
                value: 'light',
                label: (
                  <span className="flex items-center gap-1.5">
                    <SunIcon size={13} />
                    {t.themeLight}
                  </span>
                )
              },
              {
                value: 'dark',
                label: (
                  <span className="flex items-center gap-1.5">
                    <MoonIcon size={13} />
                    {t.themeDark}
                  </span>
                )
              }
            ]}
          />
        </SettingRow>

        <div className={cn(ui.row, 'space-y-3 p-4')}>
          <span className={cn(ui.heading, 'text-sm')}>{t.downloadLocation}</span>
          <div className="flex items-center gap-2">
            <code
              dir="ltr"
              title={downloadDir}
              className="min-w-0 flex-1 select-text truncate rounded-md bg-zinc-100 px-2.5 py-1.5 text-start text-[11px] text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400"
            >
              {downloadDir || '—'}
            </code>
            <button
              type="button"
              onClick={changeDownloadDir}
              className={cn(
                ui.btnSecondary,
                'flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-medium'
              )}
            >
              <FolderIcon size={13} />
              {t.changePath}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
