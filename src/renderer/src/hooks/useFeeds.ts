import { useState, useEffect, useCallback } from 'react'

export interface Feed {
  id: number
  title: string
  url: string
  folder_id: number | null
  unread_count: number
  open_in_browser: boolean
  refresh_interval: number
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

  return { feeds, reload: loadFeeds }
}
