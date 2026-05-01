import { BrowserWindow, app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

let statsWindow: BrowserWindow | null = null

export function createStatsWindow(): void {
  if (statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.focus()
    return
  }

  statsWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: 'Subscription Statistics',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const statsPath = join(__dirname, '../renderer-stats/index.html')
  if (existsSync(statsPath)) {
    statsWindow.loadFile(statsPath)
  } else {
    statsWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  statsWindow.on('closed', () => { statsWindow = null })
}
