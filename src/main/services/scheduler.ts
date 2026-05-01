import { getDb } from '../db'
import { fetchFeed } from './feed-fetcher'
import { BrowserWindow } from 'electron'

interface ScheduledFeed {
  id: number
  url: string
  refresh_interval: number
}

const timers = new Map<number, NodeJS.Timeout>()
let running = false

export function startScheduler(): void {
  if (running) return
  running = true
  scheduleAllFeeds()
}

export function stopScheduler(): void {
  running = false
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }
  timers.clear()
}

function scheduleAllFeeds(): void {
  const feeds = getDb().prepare('SELECT id, url, refresh_interval FROM feeds').all() as ScheduledFeed[]
  for (const feed of feeds) {
    scheduleFeed(feed)
  }
}

function scheduleFeed(feed: ScheduledFeed): void {
  if (!running) return
  const intervalMs = (feed.refresh_interval || 30) * 60 * 1000
  const timer = setTimeout(async () => {
    const result = await fetchFeed(feed.id, feed.url)
    notifyWindows()
    if (running) {
      const updated = getDb().prepare('SELECT id, url, refresh_interval FROM feeds WHERE id = ?').get(feed.id) as ScheduledFeed | undefined
      if (updated) scheduleFeed(updated)
    }
  }, intervalMs)
  timers.set(feed.id, timer)
}

export function rescheduleFeed(feedId: number): void {
  const existing = timers.get(feedId)
  if (existing) clearTimeout(existing)
  const feed = getDb().prepare('SELECT id, url, refresh_interval FROM feeds WHERE id = ?').get(feedId) as ScheduledFeed | undefined
  if (feed && running) scheduleFeed(feed)
}

function notifyWindows(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('feeds:updated')
    win.webContents.send('articles:updated')
  }
}
