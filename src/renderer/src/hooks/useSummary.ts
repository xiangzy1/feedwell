import { useState, useEffect, useRef } from 'react'
import { useTranslationSettings } from './useTranslationSettings'

export function useSummary(
  articleId: number | undefined,
  title: string | undefined,
  content: string | undefined,
  enabled: boolean
): { summary: string | null; loading: boolean; error: string | null } {
  const { settings } = useTranslationSettings()
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    setSummary(null)
    setError(null)
    setLoading(false)

    if (!enabled || !articleId || !title || settings.provider !== 'ai' || !settings.aiApiKey) {
      return
    }

    const requestId = ++requestIdRef.current
    setLoading(true)

    const doSummarize = async () => {
      try {
        const result = await window.api.summary.summarize(articleId, title, content || '')
        if (requestIdRef.current !== requestId) return
        setSummary(result)
        setLoading(false)
      } catch (err) {
        if (requestIdRef.current !== requestId) return
        setError(err instanceof Error ? err.message : 'Summarization failed')
        setLoading(false)
      }
    }

    doSummarize()

    return () => {
      if (requestIdRef.current === requestId) {
        requestIdRef.current++
      }
    }
  }, [enabled, articleId, title, content, settings.provider, settings.aiApiKey, settings.targetLang])

  return { summary, loading, error }
}
