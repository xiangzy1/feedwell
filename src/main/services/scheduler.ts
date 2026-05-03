import { getDb } from '../db'
import { enqueue } from './refresh-queue'

const REFRESH_INTERVAL = 30 * 60 * 1000

let globalTimer: NodeJS.Timeout | null = null
let running = false

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

function scheduleNext(): void {
  if (!running) return
  globalTimer = setTimeout(async () => {
    if (!running) return
    const feeds = getDb().prepare('SELECT id, url FROM feeds').all() as Array<{ id: number; url: string }>
    if (feeds.length > 0) {
      await enqueue(feeds)
    }
    if (running) scheduleNext()
  }, REFRESH_INTERVAL)
}
