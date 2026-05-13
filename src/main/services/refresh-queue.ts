import { fetchFeed } from './feed-fetcher'
import { notifyFeedsUpdated, notifyArticlesUpdated, notifyRefreshDone, broadcast } from '../ipc/feeds'

const MAX_CONCURRENCY = 6

interface QueueItem {
  feedId: number
  url: string
}

let queue: QueueItem[] = []
let active = 0
let total = 0
let completed = 0
let batchActive = false
let batchResolve: (() => void) | null = null

export function enqueue(
  feeds: Array<{ id: number; url: string }>
): Promise<void> {
  return new Promise((resolve) => {
    if (feeds.length === 0 || batchActive) {
      resolve()
      return
    }

    batchActive = true
    total = feeds.length
    completed = 0
    active = 0
    queue = feeds.map(f => ({ feedId: f.id, url: f.url }))
    batchResolve = resolve

    drain()
  })
}

function broadcastProgress(current: number, total: number) {
  broadcast('feeds:refreshProgress', { current, total })
}

function drain() {
  while (active < MAX_CONCURRENCY && queue.length > 0) {
    const item = queue.shift()!
    active++
    fetchFeed(item.feedId, item.url)
      .catch((err) => {
        console.warn(`Failed to fetch feed ${item.feedId} (${item.url}):`, err?.message ?? err)
      })
      .finally(() => {
        active--
        completed++
        broadcastProgress(completed, total)
        if (completed === total) {
          batchActive = false
          notifyFeedsUpdated()
          notifyArticlesUpdated()
          notifyRefreshDone()
          batchResolve?.()
          batchResolve = null
        } else {
          drain()
        }
      })
  }
}
