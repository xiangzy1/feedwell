import { app, BrowserWindow, Menu, ipcMain, nativeImage, nativeTheme, powerMonitor, session, shell } from 'electron'
import { join } from 'path'
import { initDatabase } from './db'
import { getSetting, getSettingJson, setSetting } from './ipc/settings'
import { startScheduler, stopScheduler, isRunning, onResume } from './services/scheduler'
import { registerFeedIpc } from './ipc/feeds'
import { registerArticleIpc } from './ipc/articles'
import { registerFolderIpc } from './ipc/folders'
import { registerSettingsIpc } from './ipc/settings'
import { registerOpmlIpc } from './ipc/opml'
import { registerStatsIpc } from './ipc/stats'

const isDev = !app.isPackaged
let isColdStart = true

app.setName('Feedwell')

const iconPath = join(__dirname, '../../resources/icon.png')

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url)
      return { action: 'deny' }
    })
  }
})

app.whenReady().then(() => {
  if (process.platform === 'darwin' && isDev) {
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }
  session.defaultSession.setProxy({ mode: 'system' })
  ipcMain.handle('openExternal', (_event, url: string) => { shell.openExternal(url) })
  initDatabase()
  registerFeedIpc()
  registerArticleIpc()
  registerFolderIpc()
  registerSettingsIpc()
  registerOpmlIpc()
  registerStatsIpc()
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
