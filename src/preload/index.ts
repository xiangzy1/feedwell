import { contextBridge, ipcRenderer } from 'electron'

function onChannel(channel: string, callback: () => void) {
  const handler = () => callback()
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
    markRead: (id: number, read?: boolean) => ipcRenderer.invoke('articles:markRead', id, read),
    markStarred: (id: number, starred: boolean) => ipcRenderer.invoke('articles:markStarred', id, starred),
    markAllRead: (feedId?: number) => ipcRenderer.invoke('articles:markAllRead', feedId)
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
  translation: {
    translate: (articleId: number, texts: string[]) => ipcRenderer.invoke('translation:translate', { articleId, texts }),
    testConnection: () => ipcRenderer.invoke('translation:testConnection')
  },
  onFeedsUpdated: (callback: () => void) => onChannel('feeds:updated', callback),
  onArticlesUpdated: (callback: () => void) => onChannel('articles:updated', callback),
  onRefreshProgress: (callback: (progress: { current: number; total: number }) => void) => {
    const handler = (_e: any, progress: { current: number; total: number }) => callback(progress)
    ipcRenderer.on('feeds:refreshProgress', handler)
    return () => ipcRenderer.removeListener('feeds:refreshProgress', handler)
  },
  onRefreshDone: (callback: () => void) => onChannel('feeds:refreshDone', callback),
  openExternal: (url: string) => ipcRenderer.invoke('openExternal', url),
  setCurrentArticle: (feedId: number | null, articleId: number | null) => ipcRenderer.invoke('app:setCurrentArticle', feedId, articleId),
  isColdStart: () => ipcRenderer.invoke('app:isColdStart'),
  onMenuAddFeed: (callback: () => void) => onChannel('menu:addFeed', callback),
  onMenuImportOpml: (callback: () => void) => onChannel('menu:importOpml', callback),
  onMenuExportOpml: (callback: () => void) => onChannel('menu:exportOpml', callback)
}

contextBridge.exposeInMainWorld('api', api)
