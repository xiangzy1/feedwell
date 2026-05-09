import { useRef, useState, useCallback, useEffect } from 'react'
import ArticleHeader from './ArticleHeader'
import ArticleViewTitlebar from './ArticleViewTitlebar'
import { Article } from '../../hooks/useArticles'
import { Feed } from '../../hooks/useFeeds'
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
  const [processedHtml, setProcessedHtml] = useState('')

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
  }, [article?.id])

  useEffect(() => {
    const raw = article?.content || article?.summary || ''
    if (!raw) {
      setProcessedHtml('')
      return
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    processMermaidInHtml(raw, isDark).then(setProcessedHtml)
  }, [article?.id, article?.content])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
      hljs.highlightElement(block as HTMLElement)
    })
  }, [processedHtml])

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
  }, [processedHtml])

  const titlebar = (
    <ArticleViewTitlebar
      article={article}
      onToggleRead={article ? () => onToggleRead(article.id, !article.read) : () => {}}
      onToggleStar={article ? () => onToggleStar(article.id, !article.starred) : () => {}}
      onOpenExternal={article && article.url ? () => window.api.openExternal(article.url) : () => {}}
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
        <WebviewView url={article.url!} />
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
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />
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

  let result = replaced
  for (let i = 0; i < mermaidBlocks.length; i++) {
    const { code } = mermaidBlocks[i]
    const placeholder = `<!--MERMAID_PLACEHOLDER_${i}-->`
    try {
      const { svg } = await mermaid.default.render(`mermaid-${i}-${Date.now()}`, code)
      result = result.replace(placeholder, `<div class="mermaid-diagram">${svg}</div>`)
    } catch {
      result = result.replace(placeholder, `<pre class="mermaid-error"><code>${escapeHtml(code)}</code></pre>`)
    }
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

function WebviewView({ url }: { url: string }) {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const initialLoadDone = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ code: number; desc: string } | null>(null)

  const refCallback = useCallback((el: Electron.WebviewTag | null) => {
    webviewRef.current = el
    if (!el) return

    const onStart = () => {
      if (initialLoadDone.current) return
      setLoading(true)
      setError(null)
    }
    const onStop = () => {
      initialLoadDone.current = true
      setLoading(false)
    }
    const onFail = (e: Electron.DidFailLoadEvent) => {
      if (e.errorCode === -3) return
      setLoading(false)
      setError({ code: e.errorCode, desc: e.errorDescription })
    }

    el.addEventListener('did-start-loading', onStart)
    el.addEventListener('did-stop-loading', onStop)
    el.addEventListener('did-fail-load', onFail)

    return () => {
      el.removeEventListener('did-start-loading', onStart)
      el.removeEventListener('did-stop-loading', onStop)
      el.removeEventListener('did-fail-load', onFail)
    }
  }, [])

  useEffect(() => {
    initialLoadDone.current = false
    setLoading(true)
    setError(null)
  }, [url])

  return (
    <>
      <webview ref={refCallback} src={url} className="article-webview" />
      {loading && (
        <div className="webview-overlay webview-loading">
          <div className="webview-spinner" />
          <p>Loading…</p>
        </div>
      )}
      {error && (
        <div className="webview-overlay webview-error">
          <div className="webview-error-icon">!</div>
          <p className="webview-error-msg">Failed to load page</p>
          <p className="webview-error-detail">{error.desc} ({error.code})</p>
          <button className="webview-retry-btn" onClick={() => {
            initialLoadDone.current = false
            setError(null)
            setLoading(true)
            webviewRef.current?.loadURL(url)
          }}>Retry</button>
        </div>
      )}
    </>
  )
}
