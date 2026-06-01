import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useI18n } from '../i18n/I18nContext'
import { cn, ui } from '../lib/ui'
import type { DownloadProgress } from '../../../preload/ipc-api'

interface Props {
  progress: DownloadProgress
  title?: string | null
  onOpenFolder: () => void
}

/** State C — thin progress bar with monospace, non-jittering figures. */
export function ProgressPanel({ progress, title, onOpenFolder }: Props): React.JSX.Element {
  const { t } = useI18n()
  const bar = useRef<HTMLDivElement>(null)
  const pct = Math.max(0, Math.min(100, progress.progress || 0))

  // Smoothly ease the fill toward each incoming onProgress tick.
  useGSAP(
    () => {
      gsap.to(bar.current, { width: `${pct}%`, duration: 0.4, ease: 'power2.out' })
    },
    { dependencies: [pct], scope: bar }
  )

  const isError = progress.status === 'error'
  const isDone = progress.status === 'finished'
  const isProcessing = progress.status === 'processing'

  return (
    <div className={cn(ui.card, 'w-full space-y-4 p-5')}>
      {title && <p className={cn(ui.heading, 'line-clamp-1 text-sm font-medium')}>{title}</p>}

      {isError ? (
        <p className="break-words text-sm text-red-500 dark:text-red-400/90">
          {t.downloadFailed}
          {progress.error ? `: ${progress.error}` : ''}
        </p>
      ) : (
        <>
          <div className={ui.track}>
            <div ref={bar} className={ui.fill} style={{ width: 0 }} />
          </div>
          <div className="flex items-center justify-between font-mono text-xs tabular-nums text-zinc-500">
            <span>{isDone ? t.saved : isProcessing ? t.processing : `${pct.toFixed(1)}%`}</span>
            <span className={ui.subtle}>{progress.speed ?? ''}</span>
          </div>
        </>
      )}

      {isDone && (
        <button
          type="button"
          onClick={onOpenFolder}
          className={cn(ui.btnSecondary, 'w-full px-3 py-2 text-xs font-medium')}
        >
          {t.openFolder}
        </button>
      )}
    </div>
  )
}
