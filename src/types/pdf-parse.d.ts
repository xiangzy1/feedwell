declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export function getDocument(src: { data: Uint8Array }): { promise: Promise<PDFDocumentProxy> }

  export const OPS: Record<string, number>

  interface PDFDocumentProxy {
    numPages: number
    getPage(n: number): Promise<PDFPageProxy>
    getMetadata(): Promise<{ info: Record<string, any> | null }>
    destroy(): void
  }

  interface OperatorList {
    fnArray: number[]
    argsArray: any[][]
  }

  interface PDFObjects {
    get(id: string, callback: (obj: any) => void): void
  }

  interface PDFPageProxy {
    getTextContent(): Promise<TextContent>
    getOperatorList(): Promise<OperatorList>
    objs: PDFObjects
    commonObjs: PDFObjects
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
