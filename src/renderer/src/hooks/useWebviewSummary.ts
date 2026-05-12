import { useEffect, useRef, useState } from 'react'
import { useTranslationSettings } from './useTranslationSettings'

const EXTRACT_TEXT_JS = `document.body.innerText.slice(0, 8000)`

interface WebviewSummaryState {
  summary: string | null
  loading: boolean
  error: string | null
}

export function useWebviewSummary(
  webviewRef: React.RefObject<Electron.WebviewTag | null>,
  articleId: number | undefined,
  title: string | undefined,
  enabled: boolean,
  domReady: boolean
): WebviewSummaryState {
  const { settings } = useTranslationSettings()
  const requestIdRef = useRef(0)
  const [state, setState] = useState<WebviewSummaryState>({ summary: null, loading: false, error: null })

  useEffect(() => {
    if (!articleId || !title || !domReady || settings.provider !== 'ai' || !settings.aiApiKey) {
      setState({ summary: null, loading: false, error: null })
      return
    }

    const wv = webviewRef.current
    if (!wv) return

    if (!enabled) {
      setState({ summary: null, loading: false, error: null })
      return
    }

    const requestId = ++requestIdRef.current
    setState({ summary: null, loading: true, error: null })

    const doSummarize = async () => {
      try {
        const rawText = await wv.executeJavaScript(EXTRACT_TEXT_JS)
        if (requestIdRef.current !== requestId) return

        const summary = await window.api.summary.summarize(articleId, title, rawText)
        if (requestIdRef.current !== requestId) return

        setState({ summary, loading: false, error: null })
      } catch (err) {
        if (requestIdRef.current !== requestId) return
        const msg = err instanceof Error ? err.message : 'Summarization failed'
        setState({ summary: null, loading: false, error: msg })
      }
    }

    doSummarize()

    return () => {
      if (requestIdRef.current === requestId) {
        requestIdRef.current++
      }
    }
  }, [enabled, articleId, title, domReady, webviewRef, settings.provider, settings.aiApiKey, settings.targetLang])

  return state
}
