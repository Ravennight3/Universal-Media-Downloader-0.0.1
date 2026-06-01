import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useI18n } from './i18n/I18nContext'
import { useSettings } from './settings/SettingsContext'
import { Header, type View } from './components/Header'
import { StatusBar } from './components/StatusBar'
import { MainView } from './components/MainView'
import { HistoryPage } from './components/HistoryPage'
import { SettingsPage } from './components/SettingsPage'
import { addHistoryItem, clearHistory, loadHistory, type HistoryItem } from './lib/history'
import type { DownloadProgress, VideoMetadata } from '../../preload/ipc-api'

function App(): React.JSX.Element {
  const { dir, lang } = useI18n()
  const { downloadDir } = useSettings()

  const [view, setView] = useState<View>('main')
  const [url, setUrl] = useState('')
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())

  // Context for the in-flight download, used to record history on completion.
  const activeDownload = useRef<{ url: string; title: string; format: string } | null>(null)
  const viewRef = useRef<HTMLDivElement>(null)

  // Subscribe once to the engine's metadata + progress channels.
  useEffect(() => {
    window.api.onMetadata((result) => {
      setIsFetching(false)
      if (result.status === 'ok') {
        setMetadata(result.data)
        setMetaError(null)
      } else {
        setMetadata(null)
        setMetaError(result.error)
      }
    })
    window.api.onProgress((p) => {
      setProgress(p)
      if (p.status === 'finished' && p.filename && activeDownload.current) {
        setHistory(
          addHistoryItem({
            title: activeDownload.current.title,
            url: activeDownload.current.url,
            format: activeDownload.current.format,
            filepath: p.filename,
            timestamp: Date.now()
          })
        )
        activeDownload.current = null
      }
    })
  }, [])

  // Refined opacity + scale transition when switching views or flipping language.
  useGSAP(
    () => {
      gsap.fromTo(
        viewRef.current,
        { opacity: 0, scale: 0.985 },
        { opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' }
      )
    },
    { dependencies: [view, lang], scope: viewRef }
  )

  const handleFetch = (): void => {
    const trimmed = url.trim()
    if (!trimmed || isFetching) return
    setMetadata(null)
    setMetaError(null)
    setProgress(null)
    setIsFetching(true)
    window.api.sendUrl(trimmed)
  }

  const handleSelect = (engineLabel: string): void => {
    const trimmed = url.trim()
    if (!trimmed) return
    activeDownload.current = { url: trimmed, title: metadata?.title ?? trimmed, format: engineLabel }
    setProgress({ status: 'downloading', progress: 0 })
    window.api.startDownload(trimmed, engineLabel, downloadDir || undefined)
  }

  const openFolder = (filepath?: string | null): void => {
    const target = filepath ?? progress?.filename
    if (target) window.api.openFolder(target)
  }

  return (
    <div
      dir={dir}
      className="flex h-screen flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <Header view={view} onNavigate={setView} />

      <main className="relative flex-1 overflow-hidden">
        <div ref={viewRef} className="h-full">
          {view === 'main' && (
            <MainView
              url={url}
              onChange={setUrl}
              onSubmit={handleFetch}
              isFetching={isFetching}
              metaError={metaError}
              metadata={metadata}
              progress={progress}
              onSelect={handleSelect}
              onOpenFolder={() => openFolder()}
            />
          )}
          {view === 'history' && (
            <HistoryPage
              items={history}
              onClear={() => setHistory(clearHistory())}
              onOpenFolder={(fp) => openFolder(fp)}
            />
          )}
          {view === 'settings' && <SettingsPage />}
        </div>
      </main>

      <StatusBar />
    </div>
  )
}

export default App
