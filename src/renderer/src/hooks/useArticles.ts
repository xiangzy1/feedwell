import { useState, useEffect, useCallback } from 'react'

export interface Article {
  id: number
  feed_id: number
  title: string
  url: string | null
  author: string | null
  content: string | null
  summary: string | null
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
}

export function useArticles({ feedId, filter }: Props) {
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const loadArticles = useCallback(async () => {
    const options: Record<string, unknown> = { limit: 200 }
    let fid = feedId

    if (filter === 'unread') options.unreadOnly = true
    if (filter === 'starred') options.starredOnly = true

    const result = await window.api.articles.list(fid || undefined, options)
    setArticles(result.articles)
  }, [feedId, filter])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  useEffect(() => {
    return window.api.onArticlesUpdated(loadArticles)
  }, [loadArticles])

  const markRead = useCallback(async (id: number, read?: boolean) => {
    const newRead = read !== undefined ? read : true
    await window.api.articles.markRead(id, newRead)
    setArticles(prev => prev.map(a => a.id === id ? { ...a, read: newRead } : a))
  }, [])

  const markStarred = useCallback(async (id: number, starred: boolean) => {
    await window.api.articles.markStarred(id, starred)
    setArticles(prev => prev.map(a => a.id === id ? { ...a, starred } : a))
  }, [])

  const markAllRead = useCallback(async (feedId?: number) => {
    await window.api.articles.markAllRead(feedId)
    setArticles(prev => {
      if (prev.every(a => a.read)) return prev
      return prev.map(a => a.read ? a : { ...a, read: true })
    })
  }, [])

  return { articles, selectedId, setSelectedId, markRead, markStarred, markAllRead }
}
