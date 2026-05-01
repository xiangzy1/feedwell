import { useRef, useState, useCallback, useEffect } from 'react'
import ArticleHeader from './ArticleHeader'
import ArticleViewTitlebar from './ArticleViewTitlebar'
import { Article } from '../../hooks/useArticles'
import { Feed } from '../../hooks/useFeeds'
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

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
  }, [article?.id])

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
        dangerouslySetInnerHTML={{ __html: article.content || article.summary || '' }}
      />
    </div>
  )
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
