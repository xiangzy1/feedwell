import { app, BrowserWindow, Menu, ipcMain, nativeImage, nativeTheme, powerMonitor, protocol, net, session, shell } from 'electron'
import { join } from 'path'
import { initDatabase } from './db'
import { getSetting, getSettingJson, setSetting } from './ipc/settings'
import { startScheduler, stopScheduler, isRunning, onResume } from './services/scheduler'
import { registerFeedIpc, updateBadgeCount, broadcast } from './ipc/feeds'
import { registerArticleIpc } from './ipc/articles'
import { registerFolderIpc } from './ipc/folders'
import { registerSettingsIpc } from './ipc/settings'
import { registerOpmlIpc } from './ipc/opml'
import { registerStatsIpc } from './ipc/stats'
import { registerTranslationIpc } from './ipc/translation'
import { registerSummaryIpc } from './ipc/summary'
import { ensureIconsDir, downloadAndCacheIcon, findCachedFile } from './services/favicon'

const isDev = !app.isPackaged
let isColdStart = true

// Track the currently viewed article so the favicon handler can resolve feedId
// without relying on article URL matching (which fails after redirects).
let currentArticle: { feedId: number; articleId: number } | null = null

app.setName('Feedwell')

const iconPath = join(__dirname, '../../resources/icon.png')

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })
    contents.on('page-favicon-updated', async (_e, favicons) => {
      if (!favicons || favicons.length === 0) return
      const faviconUrl = favicons[0]
      if (!faviconUrl || !faviconUrl.startsWith('http')) return
      try {
        const feedId = currentArticle?.feedId
        if (!feedId) return
        const filename = await downloadAndCacheIcon(faviconUrl, feedId)
        if (filename) {
          const { getDb } = await import('./db')
          getDb().prepare('UPDATE feeds SET favicon_cached = ?, favicon_url = COALESCE(favicon_url, ?) WHERE id = ?')
            .run(filename, faviconUrl, feedId)
          broadcast('feeds:updated')
        }
      } catch { /* ignore */ }
    })
  }
})

app.whenReady().then(() => {
  if (process.platform === 'darwin' && isDev) {
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }
  protocol.handle('feedicon', (request) => {
    const filename = new URL(request.url).hostname
    const filePath = join(app.getPath('userData'), 'icons', filename)
    return net.fetch(`file://${filePath}`)
  })
  session.defaultSession.setProxy({ mode: 'system' })
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    if (details.resourceType === 'image') {
      const headers = { ...details.requestHeaders }
      const ref = headers['Referer']
      if (ref && (ref.startsWith('file://') || new URL(ref).hostname === 'localhost')) {
        delete headers['Referer']
      }
      callback({ requestHeaders: headers })
    } else {
      callback({ requestHeaders: details.requestHeaders })
    }
  })
  ipcMain.handle('openExternal', (_event, url: string) => { shell.openExternal(url) })
  ipcMain.handle('app:setCurrentArticle', (_event, feedId: number | null, articleId: number | null) => {
    currentArticle = feedId != null && articleId != null ? { feedId, articleId } : null
  })
  ensureIconsDir()
  initDatabase()
  updateBadgeCount()
  registerFeedIpc()
  registerArticleIpc()
  registerFolderIpc()
  registerSettingsIpc()
  registerOpmlIpc()
  registerStatsIpc()
  registerTranslationIpc()
  registerSummaryIpc()
  ipcMain.handle('app:isColdStart', () => isColdStart)
  createMainWindow()
  startScheduler()

  powerMonitor.on('resume', onResume)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
    if (!isRunning()) {
      startScheduler()
    }
  })
})

app.on('window-all-closed', () => {
  isColdStart = false
  if (process.platform !== 'darwin') {
    stopScheduler()
    app.quit()
  }
  // macOS: keep scheduler running for background refresh
})

app.on('before-quit', () => {
  stopScheduler()
})

function setupMenu(win: BrowserWindow) {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Feedwell',
      submenu: [
        { role: 'about' },
        { label: 'Settings...', accelerator: 'CmdOrCtrl+,', click: () => win.webContents.send('menu:settings') },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Feed', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('menu:addFeed') },
        { type: 'separator' },
        { label: 'Import OPML...', click: () => win.webContents.send('menu:importOpml') },
        { label: 'Export OPML...', click: () => win.webContents.send('menu:exportOpml') },
        { type: 'separator' },
        { label: 'Close Window', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Refresh Current', accelerator: 'CmdOrCtrl+R', click: () => win.webContents.send('menu:refreshCurrent') },
        { label: 'Refresh All', accelerator: 'CmdOrCtrl+Shift+R', click: () => win.webContents.send('menu:refreshAll') },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function loadWindowBounds() {
  return getSettingJson<{ width: number; height: number; x?: number; y?: number }>('windowBounds')
}

function saveWindowBounds(win: BrowserWindow) {
  const { width, height, x, y } = win.getBounds()
  setSetting('windowBounds', { width, height, x, y })
}

function loadThemeColor(): string {
  const theme = getSettingJson<string>('theme')
  const dark = theme === 'dark' || (theme !== 'light' && nativeTheme.shouldUseDarkColors)
  return dark ? '#252525' : '#ffffff'
}

function createMainWindow() {
  const bounds = loadWindowBounds()
  const win = new BrowserWindow({
    width: bounds?.width ?? 1200,
    height: bounds?.height ?? 800,
    ...(bounds?.x != null && bounds?.y != null ? { x: bounds.x, y: bounds.y } : {}),
    backgroundColor: loadThemeColor(),
    show: false,
    titleBarStyle: 'hiddenInset',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  })
  win.once('ready-to-show', () => win.show())
  win.on('close', () => saveWindowBounds(win))
  setupMenu(win)
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}
