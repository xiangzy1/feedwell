import { getDb } from '../db'
import { enqueue } from './refresh-queue'

type RefreshInterval = 0 | 30 | 60 | 120 | 240 | 480

const DEFAULT_INTERVAL: RefreshInterval = 30

function getIntervalMinutes(): RefreshInterval {
  try {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = 'feedwell-refresh-settings'").get() as { value: string } | undefined
    if (!row) return DEFAULT_INTERVAL
    const parsed = JSON.parse(row.value)
    const val = parsed?.interval
    if ([0, 30, 60, 120, 240, 480].includes(val)) return val
    return DEFAULT_INTERVAL
  } catch {
    return DEFAULT_INTERVAL
  }
}

let globalTimer: NodeJS.Timeout | null = null
let running = false
let lastRefreshAt = 0

export function startScheduler(): void {
  if (running) return
  running = true
  scheduleNext()
}

export function stopScheduler(): void {
  running = false
  if (globalTimer) {
    clearTimeout(globalTimer)
    globalTimer = null
  }
}

export function isRunning(): boolean {
  return running
}

export function rescheduleScheduler(): void {
  if (globalTimer) {
    clearTimeout(globalTimer)
    globalTimer = null
  }
  if (running) scheduleNext()
}

/** Called on system wake — refresh immediately if enough time has elapsed. */
export function onResume(): void {
  if (!running) return
  const intervalMs = getIntervalMinutes() * 60 * 1000
  if (intervalMs === 0) return
  if (Date.now() - lastRefreshAt < intervalMs) return

  if (globalTimer) {
    clearTimeout(globalTimer)
    globalTimer = null
  }

  doRefresh()
}

function doRefresh(): void {
  lastRefreshAt = Date.now()
  const feeds = getDb().prepare('SELECT id, url FROM feeds').all() as Array<{ id: number; url: string }>
  if (feeds.length > 0) {
    enqueue(feeds).finally(() => {
      if (running) scheduleNext()
    })
  } else if (running) {
    scheduleNext()
  }
}

function scheduleNext(): void {
  if (!running) return
  const intervalMs = getIntervalMinutes() * 60 * 1000
  if (intervalMs === 0) return
  globalTimer = setTimeout(() => {
    if (!running) return
    doRefresh()
  }, intervalMs)
}
