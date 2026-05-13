import { ipcMain } from 'electron'
import { checkForUpdates, downloadUpdate, installUpdate, isAutoCheckEnabled, setAutoCheckEnabled } from '../services/updater'

export function registerUpdaterIpc(): void {
  ipcMain.handle('updater:check', () => checkForUpdates())
  ipcMain.handle('updater:download', () => downloadUpdate())
  ipcMain.handle('updater:install', () => installUpdate())
  ipcMain.handle('updater:getAutoCheck', () => isAutoCheckEnabled())
  ipcMain.handle('updater:setAutoCheck', (_event, enabled: boolean) => setAutoCheckEnabled(enabled))
}
