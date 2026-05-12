import { useEffect, useRef } from 'react'
import { useTranslationSettings } from './useTranslationSettings'
import { WEBVIEW_SUMMARY_CSS } from '../styles/webview-summary.css'

const CLEANUP_JS = `
  const el = document.getElementById('__feedwell-summary');
  if (el) el.remove();
`

export function useWebviewSummary(
  webviewRef: React.RefObject<Electron.WebviewTag | null>,
  articleId: number | undefined,
  title: string | undefined,
  enabled: boolean,
  domReady: boolean
): void {
  const { settings } = useTranslationSettings()
  const requestIdRef = useRef(0)

  // Remove summary card on unmount
  useEffect(() => {
    return () => {
      const wv = webviewRef.current
      if (wv) wv.executeJavaScript(CLEANUP_JS).catch(() => {})
    }
  }, [webviewRef])

  // Remove summary card when toggled off
  useEffect(() => {
    if (enabled || !domReady) return
    const wv = webviewRef.current
    if (!wv) return
    wv.executeJavaScript(CLEANUP_JS).catch(() => {})
  }, [enabled, domReady, webviewRef])

  useEffect(() => {
    if (!enabled || !articleId || !title || !domReady || settings.provider !== 'ai' || !settings.aiApiKey) return

    const wv = webviewRef.current
    if (!wv) return

    const requestId = ++requestIdRef.current

    const doSummarize = async () => {
      try {
        const rawText = await wv.executeJavaScript(`
          document.body.innerText.slice(0, 8000)
        `)

        if (requestIdRef.current !== requestId) return

        await wv.executeJavaScript(`
          (() => {
            let card = document.getElementById('__feedwell-summary');
            if (!card) {
              card = document.createElement('div');
              card.id = '__feedwell-summary';
              card.className = 'article-summary-card loading';
              card.textContent = 'Summarizing...';
              document.body.insertBefore(card, document.body.firstChild);
            }
          })()
        `)

        if (requestIdRef.current !== requestId) return

        const summary = await window.api.summary.summarize(articleId, title, rawText)

        if (requestIdRef.current !== requestId) return

        await wv.executeJavaScript(`
          (() => {
            const card = document.getElementById('__feedwell-summary');
            if (card) {
              card.className = 'article-summary-card';
              card.textContent = ${JSON.stringify(summary)};
            }
          })()
        `)
      } catch (err) {
        if (requestIdRef.current !== requestId) return
        const msg = err instanceof Error ? err.message : 'Summarization failed'
        wv.executeJavaScript(`
          const card = document.getElementById('__feedwell-summary');
          if (card) {
            card.className = 'article-summary-card error';
            card.textContent = ${JSON.stringify(msg)};
          }
        `).catch(() => {})
      }
    }

    doSummarize()

    return () => {
      if (requestIdRef.current === requestId) {
        requestIdRef.current++
      }
    }
  }, [enabled, articleId, title, domReady, webviewRef, settings.provider, settings.aiApiKey, settings.targetLang])
}

export function injectSummaryCss(wv: Electron.WebviewTag): void {
  wv.insertCSS(WEBVIEW_SUMMARY_CSS).catch(() => {})
}
