'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Search } from 'lucide-react'
import { apiUrl } from '@/lib/api'
import { cn } from '@/lib/utils'
import type {
  GeneratedCodeFile,
  PreviewBuildResponse,
} from '@/lib/types'

const EMPTY_FILES: GeneratedCodeFile[] = []
const PREVIEW_HEIGHT = 620
const PREVIEW_ZOOM_OPTIONS = [
  { value: 1, label: '100%' },
  { value: 0.75, label: '75%' },
  { value: 0.5, label: '50%' },
] as const
type PreviewZoom = (typeof PREVIEW_ZOOM_OPTIONS)[number]['value']

function getPreviewZoom(value: string): PreviewZoom {
  return (
    PREVIEW_ZOOM_OPTIONS.find((option) => String(option.value) === value)
      ?.value ?? 1
  )
}

interface PreviewPaneProps {
  id: string
  code: string
  files?: GeneratedCodeFile[]
  entryFile?: string
  previewUrl?: string
  className?: string
}

export function PreviewPane({
  id,
  code,
  files,
  entryFile,
  previewUrl,
  className,
}: PreviewPaneProps) {
  const previewFiles = files ?? EMPTY_FILES
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState(previewUrl)
  const [error, setError] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>(1)

  useEffect(() => {
    setResolvedPreviewUrl(previewUrl)
    setError(null)

    if (previewUrl) {
      return
    }

    const controller = new AbortController()

    async function buildPreview() {
      setBuilding(true)

      try {
        const response = await fetch(apiUrl('/api/preview/build'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, code, files: previewFiles, entryFile }),
          signal: controller.signal,
        })
        const data = (await response.json()) as PreviewBuildResponse

        if (!response.ok || !data.success || !data.previewUrl) {
          throw new Error(
            data.error || `Preview build failed (${response.status})`
          )
        }

        setResolvedPreviewUrl(data.previewUrl)
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }

        setError(err instanceof Error ? err.message : 'Preview build failed')
      } finally {
        if (!controller.signal.aborted) {
          setBuilding(false)
        }
      }
    }

    buildPreview()

    return () => controller.abort()
  }, [code, entryFile, id, previewFiles, previewUrl])

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-card shadow-[0_18px_45px_rgba(15,23,42,0.12)]',
        className
      )}
    >
      {error ? (
        <div className="flex items-start gap-2 border-b bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {building && !resolvedPreviewUrl ? (
        <div className="preview-canvas flex h-[620px] items-center justify-center text-sm text-muted-foreground">
          <div className="rounded-lg border bg-white/90 px-5 py-4 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-primary" />
            <p className="font-medium text-foreground">Building preview...</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rendering generated UI artifact
            </p>
          </div>
        </div>
      ) : null}

      {resolvedPreviewUrl ? (
        <>
          <div className="flex items-center justify-between gap-3 border-b bg-[linear-gradient(135deg,#151826,#1f2937)] px-3 py-2 text-white">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5c7a]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
              <span className="ml-2 text-xs font-semibold text-slate-300">
                Live preview
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Search
                aria-hidden="true"
                className="h-4 w-4 text-slate-300"
              />
              <select
                aria-label="Preview zoom"
                value={String(previewZoom)}
                onChange={(event) =>
                  setPreviewZoom(getPreviewZoom(event.target.value))
                }
                className="h-8 rounded-md border border-white/15 bg-white/10 px-2 text-sm text-white ring-offset-[#151826] backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2"
              >
                {PREVIEW_ZOOM_OPTIONS.map((option) => (
                  <option key={option.value} value={String(option.value)}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="preview-canvas h-[620px] overflow-hidden">
            <iframe
              key={resolvedPreviewUrl}
              title="Generated UI preview"
              src={resolvedPreviewUrl}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              className="block border-0 bg-white shadow-sm"
              style={{
                width: `${100 / previewZoom}%`,
                height: `${PREVIEW_HEIGHT / previewZoom}px`,
                transform: `scale(${previewZoom})`,
                transformOrigin: 'top left',
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
