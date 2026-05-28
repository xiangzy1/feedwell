export {}

declare global {
  interface CacheSizes {
    webviewCache: number
    databaseSize: number
    faviconSize: number
    total: number
  }
  interface Window {
    api: {
      feeds: {
        add: (url: string, folderId?: number) => Promise<{ id?: number; error?: string }>
        remove: (id: number) => Promise<void>
        update: (id: number, changes: Record<string, unknown>) => Promise<void>
        list: () => Promise<any[]>
        refresh: (id?: number) => Promise<void>
        refreshStale: () => Promise<void>
        clearFaviconCache: (feedId: number) => Promise<void>
      }
      articles: {
        list: (feedId?: number, options?: Record<string, unknown>) => Promise<{ articles: any[] }>
        markRead: (id: number, read?: boolean) => Promise<void>
        markStarred: (id: number, starred: boolean) => Promise<void>
        markAllRead: (feedId?: number, folderId?: number) => Promise<void>
      }
      folders: {
        list: () => Promise<{ id: number; name: string; sort_order: number }[]>
        create: (name: string) => Promise<{ id: number }>
        reorder: (orderedIds: number[]) => Promise<void>
      }
      opml: {
        import: (filePath?: string) => Promise<void>
        export: () => Promise<void>
      }
      stats: {
        getMonthly: (feedId?: number, months?: number) => Promise<any>
        getFeedHealth: () => Promise<any>
      }
      settings: {
        get: (key: string) => Promise<any>
        set: (key: string, value: unknown) => Promise<void>
      }
      scheduler: {
        reschedule: () => Promise<void>
      }
      translation: {
        translate: (articleId: number, texts: string[]) => Promise<string[]>
        testConnection: () => Promise<boolean>
      }
      summary: {
        summarize: (articleId: number, title: string, content: string) => Promise<string>
        onSummaryChunk: (callback: (data: { articleId: number; delta: string }) => void) => () => void
      }
      updater: {
        check: () => Promise<void>
        download: () => Promise<void>
        install: () => Promise<void>
        getAutoCheck: () => Promise<boolean>
        setAutoCheck: (enabled: boolean) => Promise<void>
        onChecking: (callback: () => void) => () => void
        onAvailable: (callback: (data: { version: string; releaseNotes: string | null }) => void) => () => void
        onNotAvailable: (callback: () => void) => () => void
        onProgress: (callback: (data: { percent: number }) => void) => () => void
        onDownloaded: (callback: () => void) => () => void
        onError: (callback: (data: { message: string }) => void) => () => void
      }
      onFeedsUpdated: (callback: () => void) => () => void
      onArticlesUpdated: (callback: () => void) => () => void
      onArticleStateChanged: (callback: (data: { id: number; feedId: number; read: boolean; starred: boolean; readDelta: number }) => void) => () => void
      onAllRead: (callback: (data: { feedId?: number; feeds?: { id: number; unread_count: number }[] }) => void) => () => void
      onRefreshProgress: (callback: (progress: { current: number; total: number }) => void) => () => void
      onRefreshDone: (callback: () => void) => () => void
      openExternal: (url: string) => Promise<void>
      cache: {
        getSizes: () => Promise<CacheSizes>
        clearAll: () => Promise<CacheSizes>
        cleanup: () => Promise<void>
      }
      pdf: {
        extractText: (url: string) => Promise<{ title: string | null; html: string; pages: number }>
      }
      setCurrentArticle: (feedId: number | null, articleId: number | null) => Promise<void>
      closeArticleWebview: (webContentsId: number | null, partition: string | null, closeConnections: boolean) => Promise<void>
      isColdStart: () => Promise<boolean>
      onMenuAddFeed: (callback: () => void) => () => void
      onMenuImportOpml: (callback: () => void) => () => void
      onMenuExportOpml: (callback: () => void) => () => void
      onMenuSettings: (callback: () => void) => () => void
      onMenuCheckUpdates: (callback: () => void) => () => void
    }
  }
}
