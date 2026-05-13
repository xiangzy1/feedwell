import { useState, useEffect, useCallback } from 'react'

export interface Feed {
  id: number
  title: string
  url: string
  folder_id: number | null
  folder_name: string | null
  unread_count: number
  open_in_browser: boolean
  refresh_interval: number
  favicon_url: string | null
  favicon_cached: string | null
  webview_max_width: number | null
}

export function useFeeds() {
  const [feeds, setFeeds] = useState<Feed[]>([])

  const loadFeeds = useCallback(async () => {
    const result = await window.api.feeds.list()
    setFeeds(result)
  }, [])

  useEffect(() => {
    loadFeeds()
    return window.api.onFeedsUpdated(loadFeeds)
  }, [loadFeeds])

  useEffect(() => {
    return window.api.onArticleStateChanged(({ feedId, readDelta }) => {
      if (readDelta === 0) return
      setFeeds(prev => prev.map(f => f.id === feedId ? { ...f, unread_count: Math.max(0, f.unread_count + readDelta) } : f))
    })
  }, [])

  useEffect(() => {
    return window.api.onAllRead((data) => {
      if (data.feeds) {
        const byId = new Map(data.feeds.map(f => [f.id, f.unread_count]))
        setFeeds(prev => prev.map(f => {
          const unread_count = byId.get(f.id)
          return unread_count !== undefined ? { ...f, unread_count } : f
        }))
      } else if (data.feedId) {
        setFeeds(prev => prev.map(f => f.id === data.feedId ? { ...f, unread_count: 0 } : f))
      }
    })
  }, [])

  return { feeds, reload: loadFeeds }
}
