import { useI18n } from '../i18n/I18nContext'
import { cn, ui } from '../lib/ui'
import { ArrowIcon, Spinner } from './icons'

interface Props {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  isFetching: boolean
}

/** State A — the sleek, centered URL field. */
export function UrlInput({ value, onChange, onSubmit, isFetching }: Props): React.JSX.Element {
  const { t } = useI18n()

  return (
    <div className={cn(ui.field, 'flex items-center gap-2 px-4 py-3')}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit()
        }}
        placeholder={t.placeholder}
        spellCheck={false}
        autoFocus
        className="min-w-0 flex-1 select-text bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none dark:text-zinc-100 dark:placeholder-zinc-600"
      />
      <button
        type="button"
        aria-label={t.fetch}
        onClick={onSubmit}
        disabled={isFetching || value.trim() === ''}
        className={cn(ui.btnPrimary, 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg')}
      >
        {isFetching ? <Spinner /> : <ArrowIcon />}
      </button>
    </div>
  )
}
