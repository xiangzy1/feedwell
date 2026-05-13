import { BrowserWindow, app } from 'electron'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { getSetting, setSetting } from '../ipc/settings'

const AUTO_CHECK_KEY = 'feedwell-auto-check-updates'
const isDev = !app.isPackaged

export function isAutoCheckEnabled(): boolean {
  const val = getSetting(AUTO_CHECK_KEY)
  if (val === null) return true
  return val === 'true'
}

export function setAutoCheckEnabled(enabled: boolean): void {
  setSetting(AUTO_CHECK_KEY, String(enabled))
}

export function initUpdater(): void {
  if (isDev) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('updater:checking')
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    sendToRenderer('updater:available', { version: info.version, releaseNotes: info.releaseNotes })
  })

  autoUpdater.on('update-not-available', () => {
    sendToRenderer('updater:not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('updater:progress', { percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', () => {
    sendToRenderer('updater:downloaded')
  })

  autoUpdater.on('error', (err) => {
    sendToRenderer('updater:error', { message: err.message })
  })

  if (isAutoCheckEnabled()) {
    autoUpdater.checkForUpdates().catch(() => {})
  }
}

export async function checkForUpdates(): Promise<void> {
  if (isDev) {
    sendToRenderer('updater:not-available')
    return
  }
  await autoUpdater.checkForUpdates()
}

export async function downloadUpdate(): Promise<void> {
  if (isDev) return
  await autoUpdater.downloadUpdate()
}

export function installUpdate(): void {
  if (isDev) return
  autoUpdater.quitAndInstall()
}

function sendToRenderer(channel: string, data?: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }
}
