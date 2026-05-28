import { contextBridge, ipcRenderer } from 'electron'

function onChannel(channel: string, callback: () => void) {
  const handler = () => callback()
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

function onTypedChannel<T>(channel: string, callback: (data: T) => void) {
  const handler = (_e: any, data: T) => callback(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  feeds: {
    add: (url: string, folderId?: number) => ipcRenderer.invoke('feeds:add', url, folderId),
    remove: (id: number) => ipcRenderer.invoke('feeds:remove', id),
    update: (id: number, changes: Record<string, unknown>) => ipcRenderer.invoke('feeds:update', id, changes),
    list: () => ipcRenderer.invoke('feeds:list'),
    refresh: (id?: number) => ipcRenderer.invoke('feeds:refresh', id),
    refreshStale: () => ipcRenderer.invoke('feeds:refreshStale'),
    clearFaviconCache: (feedId: number) => ipcRenderer.invoke('feeds:clearFaviconCache', feedId)
  },
  articles: {
    list: (feedId?: number, options?: Record<string, unknown>) => ipcRenderer.invoke('articles:list', feedId, options),
    get: (id: number) => ipcRenderer.invoke('articles:get', id),
    markRead: (id: number, read?: boolean) => ipcRenderer.invoke('articles:markRead', id, read),
    markStarred: (id: number, starred: boolean) => ipcRenderer.invoke('articles:markStarred', id, starred),
    markAllRead: (feedId?: number, folderId?: number) => ipcRenderer.invoke('articles:markAllRead', feedId, folderId)
  },
  folders: {
    list: () => ipcRenderer.invoke('folders:list'),
    create: (name: string) => ipcRenderer.invoke('folders:create', name),
    reorder: (orderedIds: number[]) => ipcRenderer.invoke('folders:reorder', orderedIds)
  },
  opml: {
    import: (filePath?: string) => ipcRenderer.invoke('opml:import', filePath),
    export: () => ipcRenderer.invoke('opml:export')
  },
  stats: {
    getMonthly: (feedId?: number, months?: number) => ipcRenderer.invoke('stats:getMonthly', feedId, months),
    getFeedHealth: () => ipcRenderer.invoke('stats:getFeedHealth')
  },
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value)
  },
  scheduler: {
    reschedule: () => ipcRenderer.invoke('scheduler:reschedule')
  },
  translation: {
    translate: (articleId: number, texts: string[]) => ipcRenderer.invoke('translation:translate', { articleId, texts }),
    testConnection: () => ipcRenderer.invoke('translation:testConnection'),
    onTranslationChunk: (callback: (data: { articleId: number; index: number; translated: string }) => void) =>
      onTypedChannel('translation:chunk', callback)
  },
  summary: {
    summarize: (articleId: number, title: string, content: string) => ipcRenderer.invoke('summary:summarize', { articleId, title, content }),
    onSummaryChunk: (callback: (data: { articleId: number; delta: string }) => void) =>
      onTypedChannel('summary:chunk', callback)
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    getAutoCheck: () => ipcRenderer.invoke('updater:getAutoCheck'),
    setAutoCheck: (enabled: boolean) => ipcRenderer.invoke('updater:setAutoCheck', enabled),
    onChecking: (callback: () => void) => onChannel('updater:checking', callback),
    onAvailable: (callback: (data: { version: string; releaseNotes: string | null }) => void) => onTypedChannel('updater:available', callback),
    onNotAvailable: (callback: () => void) => onChannel('updater:not-available', callback),
    onProgress: (callback: (data: { percent: number }) => void) => onTypedChannel('updater:progress', callback),
    onDownloaded: (callback: () => void) => onChannel('updater:downloaded', callback),
    onError: (callback: (data: { message: string }) => void) => onTypedChannel('updater:error', callback),
  },
  onFeedsUpdated: (callback: () => void) => onChannel('feeds:updated', callback),
  onArticlesUpdated: (callback: () => void) => onChannel('articles:updated', callback),
  onArticleStateChanged: (callback: (data: { id: number; feedId: number; read: boolean; starred: boolean; readDelta: number }) => void) =>
    onTypedChannel('articles:stateChanged', callback),
  onAllRead: (callback: (data: { feedId?: number; feeds?: { id: number; unread_count: number }[] }) => void) =>
    onTypedChannel('feeds:unreadReset', callback),
  onRefreshProgress: (callback: (progress: { current: number; total: number }) => void) =>
    onTypedChannel('feeds:refreshProgress', callback),
  onRefreshDone: (callback: () => void) => onChannel('feeds:refreshDone', callback),
  openExternal: (url: string) => ipcRenderer.invoke('openExternal', url),
  cache: {
    getSizes: () => ipcRenderer.invoke('cache:getSizes'),
    clearAll: () => ipcRenderer.invoke('cache:clearAll'),
    cleanup: () => ipcRenderer.invoke('cache:cleanup'),
  },
  pdf: {
    extractText: (url: string) => ipcRenderer.invoke('pdf:extractText', url)
  },
  setCurrentArticle: (feedId: number | null, articleId: number | null) => ipcRenderer.invoke('app:setCurrentArticle', feedId, articleId),
  closeArticleWebview: (webContentsId: number | null, partition: string | null, closeConnections: boolean) =>
    ipcRenderer.invoke('app:closeArticleWebview', webContentsId, partition, closeConnections),
  isColdStart: () => ipcRenderer.invoke('app:isColdStart'),
  onMenuAddFeed: (callback: () => void) => onChannel('menu:addFeed', callback),
  onMenuImportOpml: (callback: () => void) => onChannel('menu:importOpml', callback),
  onMenuExportOpml: (callback: () => void) => onChannel('menu:exportOpml', callback),
  onMenuSettings: (callback: () => void) => onChannel('menu:settings', callback),
  onMenuCheckUpdates: (callback: () => void) => onChannel('menu:checkUpdates', callback)
}

contextBridge.exposeInMainWorld('api', api)
