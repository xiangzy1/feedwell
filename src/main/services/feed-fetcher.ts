import { getDb } from '../db'
import FeedParser from 'feedparser'
import { request } from 'node:http'
import { request as httpsRequest } from 'https'
import { createGunzip } from 'node:zlib'
import { discoverFavicon, downloadAndCacheIcon, findCachedFile } from './favicon'

const USER_AGENT = 'Mozilla/5.0'

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
    let feed: { last_etag: string | null; last_modified: string | null; favicon_url: string | null; site_url: string | null } | undefined
    if (feedId > 0) {
      feed = getDb().prepare('SELECT last_etag, last_modified, favicon_url, site_url FROM feeds WHERE id = ?').get(feedId) as typeof feed
    }

    const result = await parseFeed(feedUrl, { etag: feed?.last_etag, lastModified: feed?.last_modified })
    const responseTime = Date.now() - start

    if (result.notModified) {
      if (feedId > 0) {
        getDb().prepare("UPDATE feeds SET last_fetched_at = datetime('now') WHERE id = ?").run(feedId)
        logFetch(feedId, 'success', null, 0, responseTime)
      }
      return { status: 'success', articlesCount: 0, responseTime }
    }

    const { articles, meta, responseHeaders } = result
    let articlesCount = 0
    if (feedId > 0) {
      articlesCount = saveArticles(feedId, articles)

      const rawFavicon = meta.favicon || (meta.image && meta.image.url) || null
      let faviconUrl: string | null = rawFavicon && /^https?:\/\//.test(rawFavicon) ? rawFavicon : null

      let faviconCached: string | null = findCachedFile(feedId)

      if (faviconUrl && !faviconCached) {
        faviconCached = await downloadAndCacheIcon(faviconUrl, feedId)
      }
      if (!faviconUrl && feed?.favicon_url && !faviconCached) {
        faviconCached = await downloadAndCacheIcon(feed.favicon_url, feedId)
      }

      if (!faviconCached) {
        const siteUrl = meta.link || feed?.site_url
        if (siteUrl) {
          faviconUrl = await discoverFavicon(siteUrl)
          if (faviconUrl) {
            faviconCached = await downloadAndCacheIcon(faviconUrl, feedId)
          }
        }
      }

      const newEtag = responseHeaders?.etag ?? null
      const newLastModified = responseHeaders?.['last-modified'] ?? null

      getDb().prepare(
        "UPDATE feeds SET title = ?, site_url = COALESCE(?, site_url), favicon_url = COALESCE(?, favicon_url), favicon_cached = COALESCE(?, favicon_cached), last_etag = ?, last_modified = ?, last_fetched_at = datetime('now') WHERE id = ?"
      ).run(meta.title || '', meta.link || '', faviconUrl, faviconCached, newEtag, newLastModified, feedId)
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

    const feedTypes = new Set([
      'application/rss+xml',
      'application/atom+xml',
      'application/json',
      'application/feed+json',
      'text/xml',
      'application/xml',
    ])

    const linkRegex = /<link\s[^>]*>/gi
    let bestMatch: { feedUrl: string; title?: string } | null = null
    let linkMatch: RegExpExecArray | null

    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const tag = linkMatch[0]
      const rel = tag.match(/rel=["']([^"']+)["']/i)?.[1]
      if (!rel || !/\balternate\b/i.test(rel)) continue

      const type = tag.match(/type=["']([^"']+)["']/i)?.[1]?.toLowerCase()
      if (!type || !feedTypes.has(type)) continue

      const href = tag.match(/href=["']([^"']+)["']/i)?.[1]
      if (!href) continue

      const title = tag.match(/title=["']([^"']+)["']/i)?.[1]
      const resolvedUrl = resolveUrl(href, url)
      if (resolvedUrl) {
        bestMatch = { feedUrl: resolvedUrl, title }
        break
      }
    }

    return bestMatch
  } catch {
    return null
  }
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    if (href.startsWith('http')) return href
    return new URL(href, baseUrl).href
  } catch {
    return null
  }
}

function parseFeed(feedUrl: string, conditionalHeaders?: { etag?: string | null; lastModified?: string | null }): Promise<
  { notModified: true } |
  { notModified: false; articles: FeedParser.Item[]; meta: FeedParser.Meta; responseHeaders: Record<string, string | string[] | undefined> }
> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'))
    }, 15000)

    const extraHeaders: Record<string, string> = {}
    if (conditionalHeaders?.etag) extraHeaders['If-None-Match'] = conditionalHeaders.etag
    if (conditionalHeaders?.lastModified) extraHeaders['If-Modified-Since'] = conditionalHeaders.lastModified

    httpGetRaw(feedUrl, (err, res) => {
      if (err) {
        clearTimeout(timeout)
        return reject(err)
      }

      if (res.statusCode === 304) {
        clearTimeout(timeout)
        res.resume()
        resolve({ notModified: true })
        return
      }

      const responseHeaders = res.headers as Record<string, string | string[] | undefined>
      const feedparser = new FeedParser({})
      const articles: FeedParser.Item[] = []
      let meta: any

      if (res.headers['content-type']?.includes('text/html')) {
        res.headers['content-type'] = 'application/xml; charset=UTF-8'
      }

      const isGzip = res.headers['content-encoding'] === 'gzip'
      if (isGzip) {
        res.pipe(createGunzip()).pipe(feedparser)
      } else {
        res.pipe(feedparser)
      }

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
        resolve({ notModified: false, articles, meta, responseHeaders })
      })
    }, 5, feedUrl, extraHeaders)
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

function logFetch(feedId: number, status: 'success' | 'error', errorMsg: string | null, articlesCount: number, responseTime: number): void {
  getDb().prepare(
    "INSERT INTO fetch_logs (feed_id, status, error_msg, articles_count, response_time) VALUES (?, ?, ?, ?, ?)"
  ).run(feedId, status, errorMsg, articlesCount, responseTime)
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    httpGetRaw(url, (err, res) => {
      if (err) return reject(err)
      const stream = res.headers['content-encoding'] === 'gzip' ? res.pipe(createGunzip()) : res
      let data = ''
      stream.on('data', (chunk: Buffer) => { data += chunk.toString() })
      stream.on('end', () => resolve(data))
    })
  })
}

function httpGetRaw(url: string, callback: (err: Error | null, res: any) => void, maxRedirects = 5, originUrl = url, extraHeaders?: Record<string, string>): void {
  const parsedUrl = new URL(url)
  const isHttps = parsedUrl.protocol === 'https:'
  const reqFn = isHttps ? httpsRequest : request
  const options = {
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*', ...extraHeaders }
  }
  const req = reqFn(options, (res: any) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      if (maxRedirects <= 0) {
        return callback(new Error('Too many redirects'), null as any)
      }
      let redirectUrl = res.headers.location as string
      if (redirectUrl.startsWith('/')) {
        redirectUrl = `${parsedUrl.protocol}//${parsedUrl.host}${redirectUrl}`
      } else if (!redirectUrl.startsWith('http')) {
        redirectUrl = new URL(redirectUrl, url).href
      }
      res.resume() // drain the response body
      return httpGetRaw(redirectUrl, callback, maxRedirects - 1, originUrl, extraHeaders)
    }
    callback(null, res)
  })
  req.on('error', (err: Error) => {
    callback(err, null as any)
  })
  req.setTimeout(15000, () => { req.destroy(); callback(new Error('Request timeout'), null as any) })
  req.end()
}
