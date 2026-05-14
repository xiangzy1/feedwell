import { useEffect, useRef } from 'react'
import { WEBVIEW_TRANSLATION_CSS } from '../styles/webview-translation.css'

const CLEANUP_JS = `
  document.querySelectorAll('.translation-block[data-__tr-block]').forEach(b => b.remove());
  document.querySelectorAll('[data-__tr-idx]').forEach(el => delete el.dataset.__trIdx);
`

export function useWebviewTranslation(
  webviewRef: React.RefObject<Electron.WebviewTag | null>,
  articleId: number | undefined,
  enabled: boolean,
  domReady: boolean
): void {
  const requestIdRef = useRef(0)

  // Cleanup translation blocks when disabled
  useEffect(() => {
    if (enabled || !domReady) return
    const wv = webviewRef.current
    if (!wv) return
    wv.executeJavaScript(CLEANUP_JS).catch(() => {})
  }, [enabled, domReady, webviewRef])

  // Invalidate in-flight requests on article change
  // (No DOM cleanup needed — webview navigation replaces the DOM)
  useEffect(() => {
    requestIdRef.current++
  }, [articleId])

  // Main translation effect
  useEffect(() => {
    if (!enabled || !articleId || !domReady) return

    const wv = webviewRef.current
    if (!wv) return

    const requestId = ++requestIdRef.current

    const doTranslate = async () => {
      try {
        // Step 1: Extract translatable texts from webview DOM
        const raw = await wv.executeJavaScript(`
          (() => {
            const TAGS = new Set(['P','LI','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','TD','TH','FIGCAPTION','DD','DT']);
            const results = [];
            const walk = (node) => {
              if (TAGS.has(node.tagName)) {
                const text = node.textContent?.trim();
                if (text && text.length > 0) {
                  node.dataset.__trIdx = String(results.length);
                  results.push({ idx: results.length, text, tag: node.tagName.toLowerCase() });
                }
                return;
              }
              for (const child of node.children) walk(child);
            };
            walk(document.body);
            return JSON.stringify(results);
          })()
        `)

        if (requestIdRef.current !== requestId) return

        const items: { idx: number; text: string; tag: string }[] = JSON.parse(raw)
        if (items.length === 0) return

        // Step 2: Inject "Translating..." placeholders (appended inside the element)
        const itemsJson = JSON.stringify(items)
        await wv.executeJavaScript(`
          (() => {
            const items = ${itemsJson};
            for (const item of items) {
              const el = document.querySelector('[data-__tr-idx="' + item.idx + '"]');
              if (!el) continue;
              const br = document.createElement('br');
              br.dataset.__trBlock = '1';
              const span = document.createElement('span');
              span.className = 'translation-block translation-' + item.tag + ' translating';
              span.dataset.__trBlock = '1';
              span.textContent = 'Translating...';
              el.appendChild(br);
              el.appendChild(span);
            }
          })()
        `)

        if (requestIdRef.current !== requestId) return

        // Subscribe to streaming chunks
        const off = window.api.translation.onTranslationChunk(({ articleId: aid, index, translated }) => {
          if (aid !== articleId || requestIdRef.current !== requestId) return
          wv.executeJavaScript(`
            (() => {
              const el = document.querySelector('[data-__tr-idx="${items[index].idx}"]');
              if (!el) return;
              const block = el.querySelector('.translation-block[data-__tr-block]');
              if (block) {
                block.className = 'translation-block translation-${items[index].tag}';
                block.textContent = ${JSON.stringify(translated)};
              }
            })()
          `).catch(() => {})
        })

        try {
          const results = await window.api.translation.translate(
            articleId,
            items.map(t => t.text)
          )

          if (requestIdRef.current !== requestId) return

          // Final sweep for any remaining placeholders
          const resultsJson = JSON.stringify(results)
          await wv.executeJavaScript(`
            (() => {
              const results = ${resultsJson};
              const items = ${itemsJson};
              for (let i = 0; i < items.length; i++) {
                const el = document.querySelector('[data-__tr-idx="' + items[i].idx + '"]');
                if (!el) continue;
                const block = el.querySelector('.translation-block[data-__tr-block]');
                if (block) {
                  block.className = 'translation-block translation-' + items[i].tag;
                  block.textContent = results[i] || '';
                }
              }
            })()
          `)
        } finally {
          off()
        }
      } catch (err) {
        if (requestIdRef.current !== requestId) return
        const msg = err instanceof Error ? err.message : 'Translation failed'
        wv.executeJavaScript(`
          document.querySelectorAll('.translation-block.translating').forEach(block => {
            block.className = block.className.replace(' translating', ' error');
            block.textContent = ${JSON.stringify(msg)};
          });
        `).catch(() => {})
      }
    }

    doTranslate()

    return () => {
      if (requestIdRef.current === requestId) {
        requestIdRef.current++
      }
    }
  }, [enabled, articleId, domReady, webviewRef])
}

/** Call this in the webview's dom-ready handler to inject translation CSS. */
export function injectTranslationCss(wv: Electron.WebviewTag): void {
  wv.insertCSS(WEBVIEW_TRANSLATION_CSS).catch(() => {})
}
