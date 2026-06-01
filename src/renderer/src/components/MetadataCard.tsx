import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useI18n } from '../i18n/I18nContext'
import { displayQuality } from '../lib/quality'
import { cn, ui } from '../lib/ui'
import type { VideoMetadata } from '../../../preload/ipc-api'

interface Props {
  metadata: VideoMetadata
  onSelect: (engineLabel: string) => void
}

/** State B — glass card over a blurred thumbnail, with quality pills. */
export function MetadataCard({ metadata, onSelect }: Props): React.JSX.Element {
  const { t } = useI18n()
  const root = useRef<HTMLDivElement>(null)

  // Organic entrance as the layout expands from State A → State B.
  useGSAP(
    () => {
      gsap.from(root.current, { opacity: 0, y: 16, scale: 0.98, duration: 0.55, ease: 'power3.out' })
    },
    { scope: root }
  )

  return (
    <div ref={root} className={cn(ui.card, 'relative w-full overflow-hidden')}>
      {metadata.thumbnail && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <img
            src={metadata.thumbnail}
            alt=""
            className="h-full w-full scale-125 object-cover opacity-20 blur-2xl"
          />
          <div className="absolute inset-0 bg-white/50 dark:bg-zinc-950/40" />
        </div>
      )}

      <div className="space-y-4 p-5">
        <div className="space-y-1">
          {metadata.extractor && (
            <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
              {metadata.extractor}
            </p>
          )}
          <h2 className={cn(ui.heading, 'line-clamp-2 text-base font-medium leading-snug')}>
            {metadata.title}
          </h2>
          {(metadata.uploader || metadata.duration) && (
            <p className="text-xs text-zinc-500">
              {[metadata.uploader, metadata.duration].filter(Boolean).join('  ·  ')}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className={cn('text-[11px]', ui.subtle)}>{t.qualitiesHint}</p>
          <div className="flex flex-wrap gap-2">
            {metadata.qualities.map((quality) => (
              <button
                key={quality}
                type="button"
                onClick={() => onSelect(quality)}
                className={cn(ui.chip, 'px-3 py-1.5 text-xs')}
              >
                {displayQuality(quality, t)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
