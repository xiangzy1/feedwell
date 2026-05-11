import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'fs'
import { request } from 'node:http'
import { request as httpsRequest } from 'https'
import { createGunzip } from 'node:zlib'

const USER_AGENT = 'Mozilla/5.0'

function getIconsDir(): string {
  return join(app.getPath('userData'), 'icons')
}

export function ensureIconsDir(): void {
  const dir = getIconsDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export async function discoverFavicon(homePageUrl: string): Promise<string | null> {
  try {
    const html = await httpGet(homePageUrl)
    const urls = extractFaviconUrls(html, homePageUrl)
    for (const url of urls) {
      const reachable = await checkUrlReachable(url)
      if (reachable) return url
    }
  } catch (e: any) {
  }
  return null
}

export async function downloadAndCacheIcon(faviconUrl: string, feedId: number): Promise<string | null> {
  try {
    const existing = findCachedFile(feedId)
    if (existing) {
      return existing
    }

    const { data, contentType } = await httpGetBuffer(faviconUrl)
    if (!data || data.length < 10) return null

    const ext = extensionFromContentType(contentType) || extensionFromUrl(faviconUrl) || 'png'
    const filename = `${feedId}.${ext}`
    const filePath = join(getIconsDir(), filename)
    writeFileSync(filePath, data)
    return filename
  } catch (e: any) {
    return null
  }
}

export function deleteCachedIcon(feedId: number): void {
  const dir = getIconsDir()
  if (!existsSync(dir)) return
  for (const file of readdirSync(dir)) {
    const base = file.replace(/\.[^.]+$/, '')
    if (Number(base) === feedId) {
      rmSync(join(dir, file))
    }
  }
}

export function findCachedFile(feedId: number): string | null {
  const dir = getIconsDir()
  if (!existsSync(dir)) return null
  for (const file of readdirSync(dir)) {
    const base = file.replace(/\.[^.]+$/, '')
    if (Number(base) === feedId) {
      const filePath = join(dir, file)
      if (!isValidImage(filePath)) {
        rmSync(filePath)
        return null
      }
      return file
    }
  }
  return null
}

function isValidImage(filePath: string): boolean {
  try {
    const buf = readFileSync(filePath).slice(0, 12)
    // PNG: 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true
    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true
    // GIF: 47 49 46 38
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true
    // ICO: 00 00 01 00
    if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) return true
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return true
    // SVG: starts with <svg or <?xml
    const str = buf.toString('utf8').trimStart().toLowerCase()
    if (str.startsWith('<svg') || str.startsWith('<?xml')) return true
    return false
  } catch {
    return false
  }
}

function extractFaviconUrls(html: string, baseUrl: string): string[] {
  const results: string[] = []
  const linkRe = /<link\s[^>]*>/gi
  const relIconRe = /rel\s*=\s*["']([^"']*icon[^"']*)["']/i
  const hrefRe = /href\s*=\s*["']([^"']+)["']/i

  let match: RegExpExecArray | null
  while ((match = linkRe.exec(html)) !== null) {
    const tag = match[0]
    if (!relIconRe.test(tag)) continue
    const hrefMatch = hrefRe.exec(tag)
    if (!hrefMatch) continue
    try {
      const resolved = new URL(hrefMatch[1], baseUrl).href
      results.push(resolved)
    } catch { /* skip invalid URLs */ }
  }

  // Fallback to /favicon.ico
  try {
    const fallback = new URL('/favicon.ico', baseUrl).href
    if (!results.includes(fallback)) results.push(fallback)
  } catch { /* skip */ }

  return results
}

function extensionFromContentType(ct: string | undefined): string | null {
  if (!ct) return null
  if (ct.includes('svg')) return 'svg'
  if (ct.includes('png')) return 'png'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  if (ct.includes('gif')) return 'gif'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('ico') || ct.includes('x-icon')) return 'ico'
  return null
}

function extensionFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname
    const ext = pathname.split('.').pop()?.toLowerCase()
    if (ext && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext
    }
  } catch { /* skip */ }
  return null
}

function checkUrlReachable(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    httpGetRawRedirect(url, (err, res) => {
      if (err || !res) return resolve(false)
      res.resume()
      resolve(res.statusCode >= 200 && res.statusCode < 400)
    })
  })
}

function httpGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    httpGetRawRedirect(url, (err, res) => {
      if (err) return reject(err)
      const stream = res.headers['content-encoding'] === 'gzip' ? res.pipe(createGunzip()) : res
      let data = ''
      stream.on('data', (chunk: Buffer) => { data += chunk.toString() })
      stream.on('end', () => resolve(data))
    })
  })
}

function httpGetBuffer(url: string): Promise<{ data: Buffer; contentType: string | undefined }> {
  return new Promise((resolve, reject) => {
    httpGetRawRedirect(url, (err, res) => {
      if (err) return reject(err)
      if (res.statusCode < 200 || res.statusCode >= 400) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      const chunks: Buffer[] = []
      const stream = res.headers['content-encoding'] === 'gzip' ? res.pipe(createGunzip()) : res
      stream.on('data', (chunk: Buffer) => { chunks.push(chunk) })
      stream.on('end', () => resolve({ data: Buffer.concat(chunks), contentType: res.headers['content-type'] }))
    })
  })
}

function httpGetRawRedirect(url: string, callback: (err: Error | null, res: any) => void, maxRedirects = 5): void {
  const parsedUrl = new URL(url)
  const isHttps = parsedUrl.protocol === 'https:'
  const reqFn = isHttps ? httpsRequest : request
  const req = reqFn({
    hostname: parsedUrl.hostname,
    port: parsedUrl.port || (isHttps ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'image/*,*/*;q=0.1', 'Referer': parsedUrl.origin + '/' }
  }, (res: any) => {
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
      res.resume()
      return httpGetRawRedirect(redirectUrl, callback, maxRedirects - 1)
    }
    callback(null, res)
  })
  req.on('error', (err: Error) => callback(err, null as any))
  req.setTimeout(10000, () => { req.destroy(); callback(new Error('Request timeout'), null as any) })
  req.end()
}
