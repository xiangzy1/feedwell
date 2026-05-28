declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export function getDocument(src: { data: Uint8Array }): { promise: Promise<PDFDocumentProxy> }

  interface PDFDocumentProxy {
    numPages: number
    getPage(n: number): Promise<PDFPageProxy>
    getMetadata(): Promise<{ info: Record<string, any> | null }>
    destroy(): void
  }

  interface PDFPageProxy {
    getTextContent(): Promise<TextContent>
  }

  interface TextContent {
    items: TextItem[]
  }

  interface TextItem {
    str: string
    dir: string
    transform: number[]
    width: number
    height: number
    fontName: string
    hasEOL: boolean
  }
}
