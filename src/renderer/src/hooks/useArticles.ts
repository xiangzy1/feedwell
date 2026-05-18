import { useState, useEffect, useCallback, useRef } from 'react'

export interface Article {
  id: number
  feed_id: number
  title: string
  url: string | null
  author: string | null
  content: string | null
  summary: string | null
  guid?: string
  read: boolean
  starred: boolean
  published_at: string | null
  fetched_at: string
  feed_title: string
  favicon_url: string | null
  favicon_cached: string | null
}

interface Props {
  feedId: number | null
  filter: string | null
  folderId?: number
  searchQuery?: string
}

export function useArticles({ feedId, filter, folderId, searchQuery }: Props) {
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const loadingContentRef = useRef<number | null>(null)

  const loadArticles = useCallback(async () => {
    const options: Record<string, unknown> = { limit: 200 }
    let fid = feedId

    if (folderId) options.folderId = folderId
    if (filter === 'unread') options.unreadOnly = true
    if (filter === 'starred') options.starredOnly = true
    if (searchQuery) options.search = searchQuery

    const result = await window.api.articles.list(fid || undefined, options)
    setArticles(result.articles)
  }, [feedId, filter, folderId, searchQuery])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  useEffect(() => {
    return window.api.onArticlesUpdated(loadArticles)
  }, [loadArticles])

  useEffect(() => {
    return window.api.onArticleStateChanged(({ id, read, starred }) => {
      setArticles(prev => prev.map(a => a.id === id ? { ...a, read, starred } : a))
      setSelectedArticle(prev => prev?.id === id ? { ...prev, read, starred } : prev)
    })
  }, [])

  const selectArticle = useCallback(async (article: Article) => {
    if (article.content !== undefined && article.content !== null) {
      setSelectedArticle(article)
      return
    }

    setSelectedArticle(article)

    loadingContentRef.current = article.id
    const full = await window.api.articles.get(article.id) as Article | undefined
    if (full && loadingContentRef.current === article.id) {
      setSelectedArticle(prev => prev?.id === article.id ? { ...prev, content: full.content } : prev)
      loadingContentRef.current = null
    }
  }, [])

  const markRead = useCallback(async (id: number, read?: boolean) => {
    await window.api.articles.markRead(id, read !== undefined ? read : true)
  }, [])

  const markStarred = useCallback(async (id: number, starred: boolean) => {
    await window.api.articles.markStarred(id, starred)
  }, [])

  const markAllRead = useCallback(async (feedId?: number, folderId?: number) => {
    await window.api.articles.markAllRead(feedId, folderId)
    setArticles(prev => {
      if (prev.every(a => a.read)) return prev
      return prev.map(a => a.read ? a : { ...a, read: true })
    })
  }, [])

  return { articles, selectedArticle, setSelectedArticle: selectArticle, markRead, markStarred, markAllRead }
}
