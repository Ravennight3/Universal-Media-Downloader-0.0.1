import { useI18n } from '../i18n/I18nContext'
import { displayQuality } from '../lib/quality'
import { cn, ui } from '../lib/ui'
import type { HistoryItem } from '../lib/history'
import { FolderIcon } from './icons'

interface Props {
  items: HistoryItem[]
  onClear: () => void
  onOpenFolder: (filepath: string) => void
}

/** Downloads history — persisted list with per-item "Open Folder". */
export function HistoryPage({ items, onClear, onOpenFolder }: Props): React.JSX.Element {
  const { t, lang } = useI18n()

  const formatDate = (ts: number): string =>
    new Date(ts).toLocaleString(lang === 'ar' ? 'ar' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mx-auto w-full max-w-lg space-y-3">
        <div className="flex items-center justify-between">
          <h1 className={cn(ui.heading, 'text-sm font-medium')}>{t.historyTitle}</h1>
          {items.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className={cn(ui.iconBtn, 'px-2 py-1 text-[11px] font-medium')}
            >
              {t.clear}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="py-20 text-center text-sm text-zinc-500">{t.historyEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className={cn(ui.row, 'flex items-center gap-3 p-3')}>
                <div className="min-w-0 flex-1">
                  <p className={cn(ui.heading, 'truncate text-sm')} title={item.title}>
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                    {displayQuality(item.format, t)} · {formatDate(item.timestamp)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t.openFolder}
                  onClick={() => onOpenFolder(item.filepath)}
                  className={cn(
                    ui.btnSecondary,
                    'flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium'
                  )}
                >
                  <FolderIcon size={13} />
                  {t.openFolder}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
