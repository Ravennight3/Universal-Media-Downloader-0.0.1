import { useI18n } from '../i18n/I18nContext'
import { UrlInput } from './UrlInput'
import { MetadataCard } from './MetadataCard'
import { ProgressPanel } from './ProgressPanel'
import type { DownloadProgress, VideoMetadata } from '../../../preload/ipc-api'

interface Props {
  url: string
  onChange: (value: string) => void
  onSubmit: () => void
  isFetching: boolean
  metaError: string | null
  metadata: VideoMetadata | null
  progress: DownloadProgress | null
  onSelect: (engineLabel: string) => void
  onOpenFolder: () => void
}

/** The main downloader (States A → B → C), centered. */
export function MainView({
  url,
  onChange,
  onSubmit,
  isFetching,
  metaError,
  metadata,
  progress,
  onSelect,
  onOpenFolder
}: Props): React.JSX.Element {
  const { t } = useI18n()

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto px-6 py-4">
      <div className="w-full max-w-md space-y-4">
        <UrlInput value={url} onChange={onChange} onSubmit={onSubmit} isFetching={isFetching} />

        {isFetching && <p className="text-center text-xs text-zinc-500">{t.extracting}</p>}

        {metaError && !progress && (
          <p className="break-words text-center text-sm text-red-500 dark:text-red-400/90">
            {metaError}
          </p>
        )}

        {progress ? (
          <ProgressPanel progress={progress} title={metadata?.title} onOpenFolder={onOpenFolder} />
        ) : (
          metadata && <MetadataCard metadata={metadata} onSelect={onSelect} />
        )}
      </div>
    </div>
  )
}
