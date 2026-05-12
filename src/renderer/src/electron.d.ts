declare namespace Electron {
  interface WebviewTag extends HTMLElement {
    src: string
    loadURL(url: string): Promise<void>
    executeJavaScript(code: string): Promise<any>
    insertCSS(css: string): Promise<string>
    addEventListener(event: string, handler: (...args: any[]) => void): void
    removeEventListener(event: string, handler: (...args: any[]) => void): void
  }
  interface DidFailLoadEvent {
    errorCode: number
    errorDescription: string
  }
  interface ConsoleMessageEvent {
    message: string | number
    level: number
    line: number
    sourceId: string
  }
}
