import { ipcMain, net } from 'electron'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

export function registerPdfIpc(): void {
  ipcMain.handle('pdf:extractText', async (_event, url: string) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30000)
    try {
      const res = await net.fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buffer = Buffer.from(await res.arrayBuffer())
      if (buffer.length > 50 * 1024 * 1024) throw new Error('PDF too large (max 50 MB)')

      const doc = await getDocument({ data: new Uint8Array(buffer) }).promise
      const metadata = await doc.getMetadata().catch(() => null)
      const title: string | null = (metadata?.info as any)?.Title || null

      const totalPages = doc.numPages
      const pages: string[] = []
      for (let i = 1; i <= totalPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        pages.push(buildPageHtml(content.items))
      }
      doc.destroy()

      return { title, html: pages.join(''), pages: totalPages }
    } finally {
      clearTimeout(timer)
    }
  })
}

interface TextItem {
  str: string
  transform: number[]
  hasEOL: boolean
  width: number
}

function buildPageHtml(items: TextItem[]): string {
  const sizes = items
    .filter(it => it.str.trim())
    .map(it => Math.abs(it.transform[0]))
    .filter(s => s > 0)
  if (sizes.length === 0) return ''

  const sizeCounts = new Map<number, number>()
  for (const s of sizes) {
    const r = Math.round(s * 10) / 10
    sizeCounts.set(r, (sizeCounts.get(r) || 0) + 1)
  }
  let bodySize = sizes[0]
  let maxCount = 0
  for (const [size, count] of sizeCounts) {
    if (count > maxCount) { maxCount = count; bodySize = size }
  }

  const parts: string[] = []

  let currentPara: string[] = []
  let lastY: number | null = null
  let lastSize = bodySize

  const flushParagraph = () => {
    const text = currentPara.join(' ').trim()
    if (!text) return
    const sz = Math.round(lastSize * 10) / 10
    const ratio = sz / bodySize
    if (ratio >= 1.5) parts.push(`<h2>${text}</h2>`)
    else if (ratio >= 1.25) parts.push(`<h3>${text}</h3>`)
    else if (ratio >= 1.1) parts.push(`<h4>${text}</h4>`)
    else parts.push(`<p>${text}</p>`)
    currentPara = []
  }

  for (const item of items) {
    const y = item.transform[5]
    const size = Math.abs(item.transform[0])
    const text = item.str

    if (!text.trim() && !item.hasEOL) continue

    if (lastY !== null && Math.abs(y - lastY) > 2) {
      if (Math.abs(y - lastY) > bodySize * 1.6) {
        flushParagraph()
      } else {
        currentPara.push(' ')
      }
    } else if (lastY !== null && currentPara.length > 0) {
      currentPara.push(' ')
    }

    if (text.trim()) {
      const roundedSize = Math.round(size * 10) / 10
      if (lastY !== null && Math.abs(roundedSize - Math.round(lastSize * 10) / 10) > 0.5 && currentPara.some(s => !s.startsWith('<br>'))) {
        flushParagraph()
      }
      currentPara.push(escHtml(text))
      lastSize = size
    }

    lastY = y
  }
  flushParagraph()

  return parts.join('\n')
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
