import { useRef, useState, useCallback, useEffect, useReducer } from 'react'
import DOMPurify from 'dompurify'
import ArticleHeader from './ArticleHeader'
import ArticleViewTitlebar from './ArticleViewTitlebar'
import { Article } from '../../hooks/useArticles'
import { Feed } from '../../hooks/useFeeds'
import { useTranslation } from '../../hooks/useTranslation'
import { useWebviewTranslation, injectTranslationCss } from '../../hooks/useWebviewTranslation'
import { useSummary } from '../../hooks/useSummary'
import { useWebviewSummary } from '../../hooks/useWebviewSummary'
import { useTranslationSettings } from '../../hooks/useTranslationSettings'
import { hljs } from '../../utils/highlight'
import '../../styles/article-view.css'

interface Props {
  article: Article | null
  onToggleStar: (id: number, starred: boolean) => void
  onToggleRead: (id: number, read: boolean) => void
  feeds: Feed[]
}

export default function ArticleView({ article, onToggleStar, onToggleRead, feeds }: Props) {
  const feed = article ? feeds.find(f => f.id === article.feed_id) : undefined
  const useWebview = feed?.open_in_browser && article?.url
  const contentRef = useRef<HTMLDivElement>(null)
  const [contentVersion, setContentVersion] = useState(0)
  const [translationEnabled, setTranslationEnabled] = useState(false)
  const [summaryEnabled, setSummaryEnabled] = useState(false)
  const { settings: tSettings } = useTranslationSettings()
  const { isTranslating } = useTranslation(contentRef, article?.id, translationEnabled, contentVersion)
  const canSummarize = tSettings.provider === 'ai' && !!tSettings.aiApiKey
  const { summary, loading: summaryLoading, error: summaryError } = useSummary(
    article?.id, article?.title, article?.content ?? undefined, summaryEnabled && !useWebview
  )
  const [wvSummaryState, setWvSummaryState] = useState<{ summary: string | null; loading: boolean; error: string | null }>({ summary: null, loading: false, error: null })

  const summaryData = summaryEnabled
    ? useWebview
      ? wvSummaryState
      : { loading: summaryLoading, summary, error: summaryError }
    : null
  const summaryPopup = summaryData && (summaryData.loading || summaryData.summary || summaryData.error)
    ? <SummaryPopup {...summaryData} />
    : null

  // Reset translation on article change
  useEffect(() => {
    setTranslationEnabled(false)
    setSummaryEnabled(false)
  }, [article?.id])

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
  }, [article?.id])

  useEffect(() => {
    const raw = article?.content || article?.summary || ''
    const el = contentRef.current
    if (!raw || !el) {
      if (el) el.innerHTML = ''
      return
    }

    const sanitized = DOMPurify.sanitize(raw)
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    processMermaidInHtml(sanitized, isDark).then(html => {
      if (!contentRef.current) return
      contentRef.current.innerHTML = html
      contentRef.current.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
        hljs.highlightElement(block as HTMLElement)
      })
      setContentVersion(k => k + 1)
    })
  }, [article?.id, article?.content])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (anchor?.href) {
        e.preventDefault()
        window.api.openExternal(anchor.href)
      }
    }
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [article?.id])

  const titlebar = (
    <ArticleViewTitlebar
      article={article}
      onToggleRead={article ? () => onToggleRead(article.id, !article.read) : () => {}}
      onToggleStar={article ? () => onToggleStar(article.id, !article.starred) : () => {}}
      onOpenExternal={article && article.url ? () => window.api.openExternal(article.url!) : () => {}}
      translationEnabled={translationEnabled}
      onToggleTranslation={() => setTranslationEnabled(prev => !prev)}
      summaryEnabled={summaryEnabled}
      onToggleSummary={() => setSummaryEnabled(prev => !prev)}
      canSummarize={canSummarize}
      isWebview={!!useWebview}
    />
  )

  if (!article) {
    return (
      <div className="article-view empty">
        {titlebar}
        <p>Select an article to read</p>
      </div>
    )
  }

  if (useWebview) {
    return (
      <div className="article-view webview-container">
        {titlebar}
        <WebviewView
          url={article.url!}
          webviewMaxWidth={feed!.webview_max_width ?? null}
          articleId={article.id}
          translationEnabled={translationEnabled}
          summaryEnabled={summaryEnabled}
          articleTitle={article.title}
          onSummaryChange={setWvSummaryState}
        />
        {summaryPopup}
      </div>
    )
  }

  return (
    <div className="article-view">
      {titlebar}
      <ArticleHeader article={article} />
      <div
        ref={contentRef}
        className="article-content"
        data-cv={contentVersion}
      />
      {summaryPopup}
    </div>
  )
}

async function processMermaidInHtml(html: string, isDark: boolean): Promise<string> {
  const mermaidBlocks: { fullMatch: string; code: string }[] = []

  const replaced = html.replace(
    /<pre[^>]*><code[^>]*class="[^"]*language-mermaid[^"]*"[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (fullMatch, encodedContent) => {
      const placeholder = `<!--MERMAID_PLACEHOLDER_${mermaidBlocks.length}-->`
      const textContent = decodeHtmlEntities(encodedContent)
      mermaidBlocks.push({ fullMatch, code: textContent })
      return placeholder
    }
  )

  if (mermaidBlocks.length === 0) return html

  const mermaid = await import('mermaid')
  mermaid.default.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default' })

  const results = await Promise.all(
    mermaidBlocks.map(async ({ code }, i) => {
      const placeholder = `<!--MERMAID_PLACEHOLDER_${i}-->`
      try {
        const { svg } = await mermaid.default.render(`mermaid-${i}-${Date.now()}`, code)
        return { placeholder, html: `<div class="mermaid-diagram">${svg}</div>` }
      } catch {
        return { placeholder, html: `<pre class="mermaid-error"><code>${escapeHtml(code)}</code></pre>` }
      }
    })
  )

  let result = replaced
  for (const { placeholder, html: svgHtml } of results) {
    result = result.replace(placeholder, svgHtml)
  }

  return result
}

function decodeHtmlEntities(str: string): string {
  const ta = document.createElement('textarea')
  ta.innerHTML = str
  return ta.value
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const SCROLL_MSG_PREFIX = '__SCROLL__'

type WebviewState = {
  loading: boolean
  error: { code: number; desc: string } | null
  scrollInfo: { top: number; height: number; viewH: number }
  domReady: boolean
}

const initialWebviewState: WebviewState = {
  loading: true,
  error: null,
  scrollInfo: { top: 0, height: 1, viewH: 1 },
  domReady: false,
}

function WebviewView({ url, webviewMaxWidth, articleId, translationEnabled, summaryEnabled, articleTitle, onSummaryChange }: { url: string; webviewMaxWidth: number | null; articleId: number; translationEnabled: boolean; summaryEnabled: boolean; articleTitle: string; onSummaryChange: (state: { summary: string | null; loading: boolean; error: string | null }) => void }) {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const initialLoadDone = useRef(false)
  const [wv, dispatch] = useReducer(
    (prev: WebviewState, next: Partial<WebviewState>) => ({ ...prev, ...next }),
    initialWebviewState
  )

  useWebviewTranslation(webviewRef, articleId, translationEnabled, wv.domReady)
  const wvSummary = useWebviewSummary(webviewRef, articleId, articleTitle, summaryEnabled, wv.domReady)

  useEffect(() => {
    onSummaryChange(wvSummary)
  }, [wvSummary, onSummaryChange])

  const refCallback = useCallback((el: Electron.WebviewTag | null) => {
    webviewRef.current = el
    if (!el) return

    const onStart = () => {
      if (initialLoadDone.current) return
      dispatch({ loading: true, error: null })
    }
    const onStop = () => {
      initialLoadDone.current = true
      dispatch({ loading: false })
    }
    const onFail = (e: Electron.DidFailLoadEvent) => {
      if (e.errorCode === -3) return
      dispatch({ loading: false, error: { code: e.errorCode, desc: e.errorDescription } })
    }
    const onConsoleMsg = (e: Electron.ConsoleMessageEvent) => {
      if (typeof e.message === 'string' && e.message.startsWith(SCROLL_MSG_PREFIX)) {
        try {
          const i = JSON.parse(e.message.slice(SCROLL_MSG_PREFIX.length))
          dispatch({ scrollInfo: { top: i.t, height: i.h, viewH: i.v } })
        } catch { /* ignore malformed scroll messages */ }
      }
    }
    const onDomReady = () => {
      dispatch({ domReady: true })
      injectTranslationCss(el)
      // Intercept target="_blank" link clicks via window.open()
      // to trigger setWindowOpenHandler in main process
      el.executeJavaScript(`
        document.addEventListener('click', (e) => {
          const a = e.target.closest('a');
          if (a && a.href && a.target === '_blank') {
            e.preventDefault();
            window.open(a.href);
          }
        }, true);
      `)
      if (webviewMaxWidth) {
        el.insertCSS(`
          html::-webkit-scrollbar { display: none !important; }
          html { scrollbar-width: none !important; }
        `).catch(() => {})
        el.executeJavaScript(`
          let __sraf = 0;
          const __sendScroll = () => {
            console.log('${SCROLL_MSG_PREFIX}' + JSON.stringify({
              t: document.documentElement.scrollTop || document.body.scrollTop,
              h: document.documentElement.scrollHeight,
              v: document.documentElement.clientHeight
            }));
          };
          window.addEventListener('scroll', () => {
            if (__sraf) return;
            __sraf = requestAnimationFrame(() => { __sraf = 0; __sendScroll(); });
          }, { passive: true });
          window.addEventListener('resize', () => { __sendScroll(); }, { passive: true });
          __sendScroll();
        `).catch(() => {})
      }
    }

    el.addEventListener('did-start-loading', onStart)
    el.addEventListener('did-stop-loading', onStop)
    el.addEventListener('did-fail-load', onFail)
    el.addEventListener('console-message', onConsoleMsg)
    el.addEventListener('dom-ready', onDomReady)

    return () => {
      el.removeEventListener('did-start-loading', onStart)
      el.removeEventListener('did-stop-loading', onStop)
      el.removeEventListener('did-fail-load', onFail)
      el.removeEventListener('console-message', onConsoleMsg)
      el.removeEventListener('dom-ready', onDomReady)
    }
  }, [webviewMaxWidth])

  useEffect(() => {
    initialLoadDone.current = false
    dispatch({ ...initialWebviewState })
  }, [url])

  /* eslint-disable react/no-unknown-property */
  const webviewEl = <webview ref={refCallback} src={url} className="article-webview" allowpopups="" />
  /* eslint-enable react/no-unknown-property */

  return (
    <>
      {webviewMaxWidth ? (
        <div className="webview-scroll-area">
          <div className="webview-width-constraint" style={{ maxWidth: webviewMaxWidth }}>{webviewEl}</div>
          <WebviewScrollbar webviewRef={webviewRef} scrollInfo={wv.scrollInfo} />
        </div>
      ) : webviewEl}
      {wv.loading && (
        <div className="webview-overlay webview-loading">
          <div className="webview-spinner" />
          <p>Loading…</p>
        </div>
      )}
      {wv.error && (
        <div className="webview-overlay webview-error">
          <div className="webview-error-icon">!</div>
          <p className="webview-error-msg">Failed to load page</p>
          <p className="webview-error-detail">{wv.error.desc} ({wv.error.code})</p>
          <button className="webview-retry-btn" onClick={() => {
            initialLoadDone.current = false
            dispatch({ ...initialWebviewState })
            webviewRef.current?.loadURL(url)
          }}>Retry</button>
        </div>
      )}
    </>
  )
}

function WebviewScrollbar({ webviewRef, scrollInfo }: {
  webviewRef: React.RefObject<Electron.WebviewTag | null>
  scrollInfo: { top: number; height: number; viewH: number }
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartTop = useRef(0)
  const dragCleanup = useRef<(() => void) | null>(null)

  // Use a ref to access scroll values in callbacks without recreating them
  const scrollInfoRef = useRef(scrollInfo)
  scrollInfoRef.current = scrollInfo

  const scrollTo = useCallback((y: number) => {
    webviewRef.current?.executeJavaScript(`window.scrollTo(0,${Math.round(y)})`).catch(() => {})
  }, [])

  useEffect(() => {
    return () => { dragCleanup.current?.() }
  }, [])

  const canScroll = scrollInfo.height > scrollInfo.viewH
  const maxScroll = scrollInfo.height - scrollInfo.viewH
  const thumbRatio = canScroll ? scrollInfo.viewH / scrollInfo.height : 1
  const thumbPct = Math.max(10, thumbRatio * 100)
  const trackUsable = 100 - thumbPct
  const thumbTopPct = maxScroll > 0 ? (scrollInfo.top / maxScroll) * trackUsable : 0

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const si = scrollInfoRef.current
    const ms = si.height - si.viewH
    scrollTo(Math.max(0, Math.min(ms, si.top + e.deltaY)))
  }, [scrollTo])

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (!trackRef.current || e.target !== trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const pct = (e.clientY - rect.top) / rect.height
    scrollTo(pct * scrollInfoRef.current.height)
  }, [scrollTo])

  const handleThumbDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const si = scrollInfoRef.current
    const ms = si.height - si.viewH
    const tr = si.height > si.viewH ? si.viewH / si.height : 1
    const tp = Math.max(10, tr * 100)

    dragging.current = true
    dragStartY.current = e.clientY
    dragStartTop.current = si.top
    dragCleanup.current?.()

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const trackH = rect.height
      const thumbH = (tp / 100) * trackH
      const delta = ev.clientY - dragStartY.current
      const scrollDelta = (delta / (trackH - thumbH)) * ms
      scrollTo(Math.max(0, Math.min(ms, dragStartTop.current + scrollDelta)))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      dragCleanup.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    dragCleanup.current = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [scrollTo])

  return (
    <div
      ref={trackRef}
      className="webview-scrollbar-track"
      role="none"
      onClick={handleTrackClick}
      onWheel={handleWheel}
    >
      {canScroll && (
        <div
          className="webview-scrollbar-thumb"
          role="none"
          style={{ height: `${thumbPct}%`, top: `${thumbTopPct}%` }}
          onMouseDown={handleThumbDown}
        />
      )}
    </div>
  )
}

function SummaryPopup({ loading, summary, error }: { loading: boolean; summary: string | null; error: string | null }) {
  if (error) return <div className="article-summary-popup error">{error}</div>
  if (summary) return <div className={`article-summary-popup${loading ? ' streaming' : ''}`}>{summary}</div>
  return <div className="article-summary-popup loading">Summarizing...</div>
}
