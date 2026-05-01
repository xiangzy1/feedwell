import { useState, useEffect } from 'react'

export interface MonthlyData {
  month: string
  total_fetches: number
  success_count: number
  error_count: number
  articles_count: number
  avg_response_time: number
}

export interface FeedHealth {
  id: number
  title: string
  url: string
  total_fetches: number
  success_count: number
  error_count: number
  avg_response_time: number
  last_error: string | null
  articles_last_30_days: number
  health_status: 'healthy' | 'failed' | 'inactive'
}

export interface Overview {
  total_feeds: number
  articles_this_month: number
  active_feeds: number
  failed_feeds: number
}

export function useStats() {
  const [monthly, setMonthly] = useState<MonthlyData[]>([])
  const [health, setHealth] = useState<FeedHealth[]>([])
  const [overview, setOverview] = useState<Overview>({ total_feeds: 0, articles_this_month: 0, active_feeds: 0, failed_feeds: 0 })

  useEffect(() => {
    async function load() {
      const [m, h] = await Promise.all([
        window.api.stats.getMonthly(undefined, 12),
        window.api.stats.getFeedHealth()
      ])
      setMonthly(m)
      setHealth(h.feeds)
      setOverview(h.overview)
    }
    load()
  }, [])

  return { monthly, health, overview }
}
