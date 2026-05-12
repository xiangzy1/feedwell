import { useReducer, useCallback, useEffect } from 'react'

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

const EMPTY_OVERVIEW: Overview = { total_feeds: 0, articles_this_month: 0, active_feeds: 0, failed_feeds: 0 }

interface StatsState {
  monthly: MonthlyData[]
  health: FeedHealth[]
  overview: Overview
}

type StatsAction = { monthly: MonthlyData[] } | { health: FeedHealth[] } | { overview: Overview } | { all: { monthly: MonthlyData[]; health: FeedHealth[]; overview: Overview } }

function statsReducer(state: StatsState, action: StatsAction): StatsState {
  if ('all' in action) {
    return { monthly: action.all.monthly, health: action.all.health, overview: action.all.overview }
  }
  return { ...state, ...action }
}

export function useStats() {
  const [state, dispatch] = useReducer(statsReducer, {
    monthly: [],
    health: [],
    overview: EMPTY_OVERVIEW,
  })

  const load = useCallback(async () => {
    const [m, h] = await Promise.all([
      window.api.stats.getMonthly(undefined, 12),
      window.api.stats.getFeedHealth()
    ])
    dispatch({ all: { monthly: m ?? [], health: h?.feeds ?? [], overview: h?.overview ?? EMPTY_OVERVIEW } })
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [m, h] = await Promise.all([
        window.api.stats.getMonthly(undefined, 12),
        window.api.stats.getFeedHealth()
      ])
      if (cancelled) return
      dispatch({ all: { monthly: m ?? [], health: h?.feeds ?? [], overview: h?.overview ?? EMPTY_OVERVIEW } })
    })()
    return () => { cancelled = true }
  }, [])

  return { ...state, reload: load }
}
