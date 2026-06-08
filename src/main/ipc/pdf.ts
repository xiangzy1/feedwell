import { ipcMain, net } from 'electron'
import sharp from 'sharp'

const CJK_REGEX = /[一-龥⼀-⿟⺀-⻳぀-ヿ가-힯＀-￯]/
const CJK_SPACING_RE = /([一-龥⼀-⿟⺀-⻳぀-ヿ가-힯＀-￯])\s+([一-龥⼀-⿟⺀-⻳぀-ヿ가-힯＀-￯])/g

// DOMMatrix polyfill for pdfjs-dist (browser API not available in Electron main process)
class DOMMatrixPolyfill {
  is2D = true
  m11 = 1; m12 = 0; m13 = 0; m14 = 0
  m21 = 0; m22 = 1; m23 = 0; m24 = 0
  m31 = 0; m32 = 0; m33 = 1; m34 = 0
  m41 = 0; m42 = 0; m43 = 0; m44 = 1
  get a() { return this.m11 }
  get b() { return this.m12 }
  get c() { return this.m21 }
  get d() { return this.m22 }
  get e() { return this.m41 }
  get f() { return this.m42 }
  get isIdentity() {
    return this.m11===1&&this.m22===1&&this.m33===1&&this.m44===1&&
      this.m12===0&&this.m13===0&&this.m14===0&&
      this.m21===0&&this.m23===0&&this.m24===0&&
      this.m31===0&&this.m32===0&&this.m34===0&&
      this.m41===0&&this.m42===0&&this.m43===0
  }
  constructor(init?: any) {
    if (!init) return
    if (Array.isArray(init)) {
      if (init.length === 6) {
        this.m11=init[0]; this.m12=init[1]; this.m21=init[2]; this.m22=init[3]; this.m41=init[4]; this.m42=init[5]
      } else if (init.length === 16) {
        [this.m11,this.m12,this.m13,this.m14,this.m21,this.m22,this.m23,this.m24,
         this.m31,this.m32,this.m33,this.m34,this.m41,this.m42,this.m43,this.m44] = init
      }
    } else if (typeof init === 'object') {
      this.m11 = init.m11 ?? init.a ?? 1
      this.m12 = init.m12 ?? init.b ?? 0
      this.m13 = init.m13 ?? 0
      this.m14 = init.m14 ?? 0
      this.m21 = init.m21 ?? init.c ?? 0
      this.m22 = init.m22 ?? init.d ?? 1
      this.m23 = init.m23 ?? 0
      this.m24 = init.m24 ?? 0
      this.m31 = init.m31 ?? 0
      this.m32 = init.m32 ?? 0
      this.m33 = init.m33 ?? 1
      this.m34 = init.m34 ?? 0
      this.m41 = init.m41 ?? init.e ?? 0
      this.m42 = init.m42 ?? init.f ?? 0
      this.m43 = init.m43 ?? 0
      this.m44 = init.m44 ?? init.m44 ?? 1
    } else if (typeof init === 'string') {
      const match = init.match(/matrix\(([^)]+)\)/i)
      if (match) {
        const parts = match[1].split(',').map((s: string) => parseFloat(s.trim()))
        if (parts.length === 6) {
          this.m11=parts[0]; this.m12=parts[1]; this.m21=parts[2]; this.m22=parts[3]; this.m41=parts[4]; this.m42=parts[5]
        }
      } else {
        const match3d = init.match(/matrix3d\(([^)]+)\)/i)
        if (match3d) {
          const parts = match3d[1].split(',').map((s: string) => parseFloat(s.trim()))
          if (parts.length === 16) {
            [this.m11,this.m12,this.m13,this.m14,this.m21,this.m22,this.m23,this.m24,
             this.m31,this.m32,this.m33,this.m34,this.m41,this.m42,this.m43,this.m44] = parts
          }
        }
      }
    }
  }
  private setMatrixValue(o: DOMMatrixPolyfill): this {
    this.m11 = o.m11; this.m12 = o.m12; this.m13 = o.m13; this.m14 = o.m14
    this.m21 = o.m21; this.m22 = o.m22; this.m23 = o.m23; this.m24 = o.m24
    this.m31 = o.m31; this.m32 = o.m32; this.m33 = o.m33; this.m34 = o.m34
    this.m41 = o.m41; this.m42 = o.m42; this.m43 = o.m43; this.m44 = o.m44
    return this
  }
  multiply(o: DOMMatrixPolyfill): DOMMatrixPolyfill {
    const r = new DOMMatrixPolyfill()
    r.m11 = this.m11 * o.m11 + this.m21 * o.m12 + this.m31 * o.m13 + this.m41 * o.m14
    r.m12 = this.m12 * o.m11 + this.m22 * o.m12 + this.m32 * o.m13 + this.m42 * o.m14
    r.m13 = this.m13 * o.m11 + this.m23 * o.m12 + this.m33 * o.m13 + this.m43 * o.m14
    r.m14 = this.m14 * o.m11 + this.m24 * o.m12 + this.m34 * o.m13 + this.m44 * o.m14

    r.m21 = this.m11 * o.m21 + this.m21 * o.m22 + this.m31 * o.m23 + this.m41 * o.m24
    r.m22 = this.m12 * o.m21 + this.m22 * o.m22 + this.m32 * o.m23 + this.m42 * o.m24
    r.m23 = this.m13 * o.m21 + this.m23 * o.m22 + this.m33 * o.m23 + this.m43 * o.m24
    r.m24 = this.m14 * o.m21 + this.m24 * o.m22 + this.m34 * o.m23 + this.m44 * o.m24

    r.m31 = this.m11 * o.m31 + this.m21 * o.m32 + this.m31 * o.m33 + this.m41 * o.m34
    r.m32 = this.m12 * o.m31 + this.m22 * o.m32 + this.m32 * o.m33 + this.m42 * o.m34
    r.m33 = this.m13 * o.m31 + this.m23 * o.m32 + this.m33 * o.m33 + this.m43 * o.m34
    r.m34 = this.m14 * o.m31 + this.m24 * o.m32 + this.m34 * o.m33 + this.m44 * o.m34

    r.m41 = this.m11 * o.m41 + this.m21 * o.m42 + this.m31 * o.m43 + this.m41 * o.m44
    r.m42 = this.m12 * o.m41 + this.m22 * o.m42 + this.m32 * o.m43 + this.m42 * o.m44
    r.m43 = this.m13 * o.m41 + this.m23 * o.m42 + this.m33 * o.m43 + this.m43 * o.m44
    r.m44 = this.m14 * o.m41 + this.m24 * o.m42 + this.m34 * o.m43 + this.m44 * o.m44
    return r
  }
  multiplySelf(o: DOMMatrixPolyfill): DOMMatrixPolyfill {
    const r = this.multiply(o)
    return this.setMatrixValue(r)
  }
  preMultiplySelf(o: DOMMatrixPolyfill): DOMMatrixPolyfill {
    const r = o.multiply(this)
    return this.setMatrixValue(r)
  }
  inverse(): DOMMatrixPolyfill {
    const [a,b,c,d,e,f] = [this.m11,this.m12,this.m21,this.m22,this.m41,this.m42]
    const det = a*d-b*c
    if (det === 0) return new DOMMatrixPolyfill()
    const r = new DOMMatrixPolyfill()
    r.m11=d/det; r.m12=-b/det; r.m21=-c/det; r.m22=a/det
    r.m41=(c*f-d*e)/det; r.m42=(b*e-a*f)/det
    r.m33=1; r.m44=1
    return r
  }
  invertSelf(): DOMMatrixPolyfill {
    const r = this.inverse()
    return this.setMatrixValue(r)
  }
  translate(tx: number, ty: number, tz = 0): DOMMatrixPolyfill {
    return this.multiply(new DOMMatrixPolyfill([1,0,0,1,tx,ty]))
  }
  scale(sx: number, ..._args: number[]): DOMMatrixPolyfill {
    const sy = _args[0] ?? sx
    return this.multiply(new DOMMatrixPolyfill([sx,0,0,sy,0,0]))
  }
  toString(): string {
    return `matrix(${this.a},${this.b},${this.c},${this.d},${this.e},${this.f})`
  }
}

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')
let _pdfjs: PdfjsModule | null = null

async function loadPdfjs(): Promise<PdfjsModule> {
  if (_pdfjs) return _pdfjs
  if (typeof (globalThis as any).DOMMatrix === 'undefined') {
    ;(globalThis as any).DOMMatrix = DOMMatrixPolyfill
  }
  _pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  return _pdfjs
}

export function registerPdfIpc(): void {
  ipcMain.handle('pdf:extractText', async (_event, url: string) => {
    const { getDocument, OPS } = await loadPdfjs()
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

      const seenImages = new Set<string>()
      const allItems: PageItem[] = []
      for (let i = 1; i <= totalPages; i++) {
        const page = await doc.getPage(i)
        const [content, opList] = await Promise.all([
          page.getTextContent(),
          page.getOperatorList()
        ])

        const images: ImageInfo[] = []
        let currentTransform = [1, 0, 0, 1, 0, 0]
        const transformStack: number[][] = []

        for (let j = 0; j < opList.fnArray.length; j++) {
          const fn = opList.fnArray[j]
          const args = opList.argsArray[j]

          if (fn === OPS.save) {
            transformStack.push([...currentTransform])
          } else if (fn === OPS.restore) {
            if (transformStack.length > 0) {
              currentTransform = transformStack.pop()!
            }
          } else if (fn === OPS.transform) {
            currentTransform = multiply(currentTransform, args)
          } else if (fn === OPS.paintImageXObject) {
            const img = await fetchPageImage(page, args[0])
            if (img) await tryAddImage(img, currentTransform, images, seenImages)
          } else if (fn === OPS.paintInlineImageXObject) {
            const img = args[0]
            if (img?.data) await tryAddImage(img, currentTransform, images, seenImages)
          }
        }

        const textItems: PageItem[] = content.items.map((it: any) => ({
          type: 'text',
          str: it.str,
          transform: it.transform,
          hasEOL: it.hasEOL,
          width: it.width
        }))

        const imagesWithTargets = associateImagesToText(images, textItems)

        const imagesByTarget = new Map<number, ImageInfo[]>()
        for (const { img, targetIdx } of imagesWithTargets) {
          const arr = imagesByTarget.get(targetIdx) ?? []
          arr.push(img)
          imagesByTarget.set(targetIdx, arr)
        }

        const mergedItems: PageItem[] = []
        for (let idx = 0; idx <= textItems.length; idx++) {
          const imgsAtIdx = (imagesByTarget.get(idx) ?? [])
            .sort((a, b) => b.y - a.y)

          for (const img of imgsAtIdx) {
            mergedItems.push({ type: 'image', ...img })
          }
          if (idx < textItems.length) {
            mergedItems.push(textItems[idx])
          }
        }

        allItems.push(...mergedItems)
        if (i < totalPages) {
          allItems.push({ type: 'pageBreak' })
        }
      }
      doc.destroy()

      const html = buildPageHtml(allItems)
      return { title, html, pages: totalPages }
    } finally {
      clearTimeout(timer)
    }
  })
}

type ImageInfo = { dataUri: string; width: number; height: number; x: number; y: number }

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), ms) })
  ]).finally(() => clearTimeout(timer!))
}

async function fetchPageImage(page: any, imgId: string): Promise<any | null> {
  return await withTimeout(
    new Promise<any>(resolve => page.objs.get(imgId, (obj: any) => resolve(obj))),
    1000
  ) ?? await withTimeout(
    new Promise<any>(resolve => page.commonObjs.get(imgId, (obj: any) => resolve(obj))),
    1000
  )
}

async function tryAddImage(img: any, transform: number[], images: ImageInfo[], seenImages: Set<string>) {
  const dataUri = await convertRawToPngDataUri(img)
  if (!dataUri || seenImages.has(dataUri)) return
  seenImages.add(dataUri)
  images.push({
    dataUri,
    width: Math.abs(transform[0]),
    height: Math.abs(transform[3]),
    x: transform[4],
    y: transform[5] + transform[3]
  })
}

function associateImagesToText(images: ImageInfo[], textItems: PageItem[]) {
  return images.map(img => {
    if (textItems.length === 0) return { img, targetIdx: 0 }

    let closestIdx = 0
    let minDistance = Infinity
    const imgCenterX = img.x + (img.width / 2)
    const imgCenterY = img.y - (img.height / 2)

    for (let idx = 0; idx < textItems.length; idx++) {
      const txt = textItems[idx] as Extract<PageItem, { type: 'text' }>
      const txtX = txt.transform[4] + (txt.width / 2)
      const txtY = txt.transform[5]
      const dx = txtX - imgCenterX
      const dy = txtY - imgCenterY
      const dist = dx * dx + 5 * dy * dy
      if (dist < minDistance) { minDistance = dist; closestIdx = idx }
    }

    const txt = textItems[closestIdx] as Extract<PageItem, { type: 'text' }>
    const targetIdx = txt.transform[5] > imgCenterY ? closestIdx + 1 : closestIdx
    return { img, targetIdx }
  })
}

function multiply(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ]
}

async function convertRawToPngDataUri(img: any): Promise<string | null> {
  if (!img.data || img.width <= 0 || img.height <= 0) return null
  try {
    const channels = Math.round(img.data.length / (img.width * img.height))
    if (channels !== 1 && channels !== 2 && channels !== 3 && channels !== 4) {
      return null
    }
    const image = sharp(Buffer.from(img.data), {
      raw: {
        width: img.width,
        height: img.height,
        channels: channels as 1 | 2 | 3 | 4
      }
    })
    const pngBuffer = await image.png().toBuffer()
    return `data:image/png;base64,${pngBuffer.toString('base64')}`
  } catch (err) {
    console.error('[pdf-extract-image] failed to convert:', err)
    return null
  }
}

type PageItem =
  | { type: 'text'; str: string; transform: number[]; hasEOL: boolean; width: number }
  | { type: 'image'; dataUri: string; width: number; height: number; x: number; y: number }
  | { type: 'pageBreak' }

function shouldFlushEndOfPage(text: string): boolean {
  if (!text) return true
  const t = text.trim()
  if (t.length === 0) return true

  const lastChar = t.slice(-1)
  const ENDING_PUNCTUATION = /[.。?？!！"”'’」』)）]/
  return ENDING_PUNCTUATION.test(lastChar)
}

function imageHtml(dataUri: string) {
  return `<div class="pdf-image-container"><img src="${dataUri}" /></div>`
}

function buildPageHtml(items: PageItem[]): string {
  const textItems = items.filter(it => it.type === 'text') as Extract<PageItem, { type: 'text' }>[]
  const sizes = textItems
    .filter(it => it.str.trim())
    .map(it => Math.abs(it.transform[0]))
    .filter(s => s > 0)

  if (sizes.length === 0) {
    return items
      .filter((it): it is Extract<PageItem, { type: 'image' }> => it.type === 'image')
      .map(it => imageHtml(it.dataUri))
      .join('\n')
  }

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
  let paraSizes: number[] = []

  const maybeAddSpace = (text: string) => {
    const last = currentPara[currentPara.length - 1]
    if (last && shouldAddSpace(last, text)) currentPara.push(' ')
  }

  const shouldFlushForSize = (size: number) => {
    if (paraSizes.length === 0) return false
    const prev = Math.round((getDominantSize(paraSizes) ?? bodySize) * 10) / 10
    return Math.abs(Math.round(size * 10) / 10 - prev) > 0.5
  }

  const flushParagraph = () => {
    let text = currentPara.join('').trim()
    if (!text) return

    text = text.replace(CJK_SPACING_RE, '$1$2')

    const dominantSize = getDominantSize(paraSizes) || bodySize
    const sz = Math.round(dominantSize * 10) / 10
    const ratio = sz / bodySize
    if (ratio >= 1.5) parts.push(`<h2>${text}</h2>`)
    else if (ratio >= 1.25) parts.push(`<h3>${text}</h3>`)
    else if (ratio >= 1.1) parts.push(`<h4>${text}</h4>`)
    else parts.push(`<p>${text}</p>`)
    currentPara = []
    paraSizes = []
  }

  for (const item of items) {
    if (item.type === 'pageBreak') {
      const text = currentPara.join('').trim()
      if (text && shouldFlushEndOfPage(text)) flushParagraph()
      lastY = null
      continue
    }

    if (item.type === 'image') {
      flushParagraph()
      parts.push(imageHtml(item.dataUri))
      lastY = null
      continue
    }

    const y = item.transform[5]
    const size = Math.abs(item.transform[0])
    const text = item.str

    if (!text.trim() && !item.hasEOL) continue

    const sameLine = lastY !== null && Math.abs(y - lastY) <= 2

    if (lastY === null) {
      if (currentPara.length > 0 && shouldFlushForSize(size)) flushParagraph()
      else maybeAddSpace(text)
    } else if (!sameLine) {
      const lineGapThreshold = Math.max(bodySize, size) * 1.7
      if (Math.abs(y - lastY) > lineGapThreshold) {
        flushParagraph()
      } else if (text.trim() && currentPara.some(s => s.trim()) && shouldFlushForSize(size)) {
        flushParagraph()
      } else {
        maybeAddSpace(text)
      }
    } else if (currentPara.length > 0) {
      maybeAddSpace(text)
    }

    if (text.trim()) {
      currentPara.push(escHtml(text))
      paraSizes.push(Math.round(size * 10) / 10)
    }

    lastY = y
  }
  flushParagraph()

  return parts.join('\n')
}

function shouldAddSpace(prev: string, next: string): boolean {
  const p = prev.trim()
  const n = next.trim()
  if (!p || !n) return false

  const lastChar = p.slice(-1)
  const firstChar = n.charAt(0)

  if (lastChar === '-' || lastChar === '/') return false
  if (CJK_REGEX.test(lastChar) || CJK_REGEX.test(firstChar)) return false

  return true
}

function getDominantSize(sizes: number[]): number | null {
  if (sizes.length === 0) return null
  const counts = new Map<number, number>()
  for (const s of sizes) counts.set(s, (counts.get(s) || 0) + 1)
  let best = sizes[0], bestCount = 0
  for (const [size, count] of counts) {
    if (count > bestCount) { bestCount = count; best = size }
  }
  return best
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
