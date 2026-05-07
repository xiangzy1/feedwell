import { getDb } from '../db'
import { enqueue } from './refresh-queue'

const REFRESH_INTERVAL = 30 * 60 * 1000

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

/** Called on system wake — refresh immediately if enough time has elapsed. */
export function onResume(): void {
  if (!running) return
  if (Date.now() - lastRefreshAt < REFRESH_INTERVAL) return

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
  globalTimer = setTimeout(() => {
    if (!running) return
    doRefresh()
  }, REFRESH_INTERVAL)
}
