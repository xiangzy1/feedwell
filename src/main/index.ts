import { app, BrowserWindow, Menu, ipcMain, nativeImage, session, shell } from 'electron'
import { join } from 'path'
import { initDatabase } from './db'
import { startScheduler, stopScheduler } from './services/scheduler'
import { registerFeedIpc } from './ipc/feeds'
import { registerArticleIpc } from './ipc/articles'
import { registerFolderIpc } from './ipc/folders'
import { registerSettingsIpc } from './ipc/settings'
import { registerOpmlIpc } from './ipc/opml'
import { registerStatsIpc } from './ipc/stats'

const isDev = !app.isPackaged

const iconPath = join(__dirname, '../../resources/icon.png')

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
  createMainWindow()
  startScheduler()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopScheduler()
  if (process.platform !== 'darwin') {
    app.quit()
  }
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

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: 'hiddenInset',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  })
  setupMenu(win)
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}
