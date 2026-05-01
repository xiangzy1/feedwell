import { getDb } from '../db'
import FeedParser from 'feedparser'
import { request } from 'node:http'
import { request as httpsRequest } from 'https'
import { parse as parseUrl } from 'url'

export interface FetchResult {
  status: 'success' | 'error'
  articlesCount: number
  responseTime: number
  errorMsg?: string
  feedTitle?: string
  feedSiteUrl?: string
}

export async function fetchFeed(feedId: number, feedUrl: string): Promise<FetchResult> {
  const start = Date.now()
  try {
    const { articles, meta } = await parseFeed(feedUrl)
    const responseTime = Date.now() - start

    let articlesCount = 0
    if (feedId > 0) {
      articlesCount = saveArticles(feedId, articles)
      getDb().prepare(
        "UPDATE feeds SET title = ?, site_url = COALESCE(?, site_url), last_fetched_at = datetime('now') WHERE id = ?"
      ).run(meta.title || '', meta.link || '', feedId)
      logFetch(feedId, 'success', null, articlesCount, responseTime)
    }
    return { status: 'success', articlesCount, responseTime, feedTitle: meta.title, feedSiteUrl: meta.link }
  } catch (err: any) {
    const responseTime = Date.now() - start
    const errorMsg = err.message || String(err)
    if (feedId > 0) logFetch(feedId, 'error', errorMsg, 0, responseTime)
    return { status: 'error', articlesCount: 0, responseTime, errorMsg }
  }
}

export async function discoverFeed(url: string): Promise<{ feedUrl: string; title?: string } | null> {
  try {
    const html = await httpGet(url)
    const match = html.match(/<link[^>]+type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]+href=["']([^"']+)["'][^>]*>/i)
      || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["'](application\/rss\+xml|application\/atom\+xml)["'][^>]*>/i)
    if (match) {
      let feedUrl = match[2] || match[1]
      if (feedUrl.startsWith('/')) {
        const parsed = parseUrl(url)
        feedUrl = `${parsed.protocol}//${parsed.host}${feedUrl}`
      } else if (!feedUrl.startsWith('http')) {
        feedUrl = new URL(feedUrl, url).href
      }
      return { feedUrl }
    }
    return null
  } catch {
    return null
  }
}

function parseFeed(feedUrl: string): Promise<{ articles: FeedParser.Item[]; meta: FeedParser.Meta }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'))
    }, 15000)

    httpGetRaw(feedUrl, (err, res) => {
      if (err) {
        clearTimeout(timeout)
        return reject(err)
      }

      const feedparser = new FeedParser({})
      const articles: FeedParser.Item[] = []
      let meta: any

      res.pipe(feedparser)

      feedparser.on('error', (e: Error) => {
        clearTimeout(timeout)
        reject(e)
      })
      feedparser.on('readable', function () {
        meta = this.meta
        let item
        while ((item = this.read())) {
          articles.push(item)
        }
      })
      feedparser.on('end', () => {
        clearTimeout(timeout)
        if (!meta) {
          reject(new Error('Failed to parse feed'))
          return
        }
        resolve({ articles, meta })
      })
    })
  })
}

function saveArticles(feedId: number, articles: FeedParser.Item[]): number {
  const stmt = getDb().prepare(
    `INSERT OR IGNORE INTO articles (feed_id, title, url, author, content, summary, guid, read, starred, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
  )
  let count = 0
  for (const article of articles) {
    const info = stmt.run(
      feedId,
      article.title || 'Untitled',
      article.link || null,
      article.author || null,
      article.description || article.summary || null,
      article.summary || null,
      article.guid || article.link || article.title,
      article.pubdate ? new Date(article.pubdate).toISOString() : null
    )
    if (info.changes > 0) count++
  }
  return count
}

function logFetch(feedId: number, status: string, errorMsg: string | null, articlesCount: number, responseTime: number): void {
  getDb().prepare(
    "INSERT INTO fetch_logs (feed_id, status, error_msg, articles_count, response_time) VALUES (?, ?, ?, ?, ?)"
  ).run(feedId, status, errorMsg, articlesCount, responseTime)
}

function httpGet(url: string, maxRedirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    httpGetRaw(url, (err, res) => {
      if (err) return reject(err)

      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) return reject(new Error('Too many redirects'))
        let redirectUrl = res.headers.location
        if (redirectUrl.startsWith('/')) {
          const parsed = parseUrl(url)
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`
        }
        res.resume()
        resolve(httpGet(redirectUrl, maxRedirects - 1))
        return
      }

      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => resolve(data))
    })
  })
}

function httpGetRaw(url: string, callback: (err: Error | null, res: any) => void): void {
  const parsed = parseUrl(url)
  const isHttps = parsed.protocol === 'https:'
  const reqFn = isHttps ? httpsRequest : request
  const req = reqFn(url, (res: any) => callback(null, res))
  req.on('error', (err: Error) => callback(err, null as any))
  req.setTimeout(15000, () => { req.destroy(); callback(new Error('Request timeout'), null as any) })
  req.end()
}
