import { useEffect, useRef } from 'react'
import { useTranslationSettings } from './useTranslationSettings'
import { WEBVIEW_SUMMARY_CSS } from '../styles/webview-summary.css'

const SUMMARY_ELEMENT_ID = '__feedwell-summary'

const EXTRACT_TEXT_JS = `document.body.innerText.slice(0, 8000)`

const CLEANUP_JS = `
  try {
    const el = document.getElementById('${SUMMARY_ELEMENT_ID}');
    if (el) {
      el.remove();
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
`

const SUMMARY_CREATION_JS = `
  (() => {
    let card = document.getElementById('${SUMMARY_ELEMENT_ID}');
    console.log('Found summary element:', card);
    if (!card) {
      card = document.createElement('div');
      card.id = '${SUMMARY_ELEMENT_ID}';
      card.className = 'article-summary-card loading';
      card.textContent = 'Summarizing...';

      let header = document.querySelector('header');
      if (header) {
        if (getComputedStyle(header).position === 'fixed') {
          card.style.marginTop = header.offsetHeight + 'px';
        }
        header.parentNode.insertBefore(card, header.nextSibling);
      } else {
        document.body.insertBefore(card, document.body.firstChild);
      }
    }
  })()
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

  useEffect(() => {
    if (!articleId || !title || !domReady || settings.provider !== 'ai' || !settings.aiApiKey) return

    const wv = webviewRef.current
    if (!wv) return

    if (!enabled) {
      console.log('Summary disabled, cleaning up...')
      wv.executeJavaScript(CLEANUP_JS).then(() => {
        console.log('Cleanup JS executed successfully')
      }).catch((err) => {
        console.error('Cleanup JS failed:', err)
      })
      return
    }

    const requestId = ++requestIdRef.current

    const doSummarize = async () => {
      try {
        const rawText = await wv.executeJavaScript(EXTRACT_TEXT_JS)

        console.log('Extracted raw text for summarization:')

        if (requestIdRef.current !== requestId) return

        console.log('Inserting summary card into webview...')

        await wv.executeJavaScript(SUMMARY_CREATION_JS)

        if (requestIdRef.current !== requestId) return

        const summary = await window.api.summary.summarize(articleId, title, rawText)

        if (requestIdRef.current !== requestId) return

        await wv.executeJavaScript(`
          (() => {
            const card = document.getElementById('${SUMMARY_ELEMENT_ID}');
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
          const card = document.getElementById('${SUMMARY_ELEMENT_ID}');
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
