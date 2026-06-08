import { useRef } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { cn, ui } from '../lib/ui'
import { ArrowIcon, ClearIcon, ClipboardIcon, Spinner } from './icons'

interface Props {
  value: string
  onChange: (value: string) => void
  onSubmit: (override?: string) => void
  isFetching: boolean
}

/** State A — the sleek, centered URL field. */
export function UrlInput({ value, onChange, onSubmit, isFetching }: Props): React.JSX.Element {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)

  const hasText = value.length > 0

  // One button, two jobs: when the field has text it clears it; when it's empty
  // it pastes the clipboard URL and immediately kicks off the fetch (passing the
  // value directly, since the `onChange` state update hasn't flushed yet).
  const handleAux = (): void => {
    if (hasText) {
      onChange('')
      inputRef.current?.focus()
      return
    }
    const text = window.api.readClipboard().trim()
    if (!text) {
      inputRef.current?.focus()
      return
    }
    onChange(text)
    onSubmit(text)
  }

  return (
    <div className={cn(ui.field, 'flex items-center gap-2 px-4 py-3')}>
      <input
        ref={inputRef}
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
        aria-label={hasText ? t.clear : t.paste}
        title={hasText ? t.clear : t.paste}
        onClick={handleAux}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-200"
      >
        {hasText ? <ClearIcon size={15} /> : <ClipboardIcon size={15} />}
      </button>
      <button
        type="button"
        aria-label={t.fetch}
        onClick={() => onSubmit()}
        disabled={isFetching || value.trim() === ''}
        className={cn(ui.btnPrimary, 'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg')}
      >
        {isFetching ? <Spinner /> : <ArrowIcon />}
      </button>
    </div>
  )
}
