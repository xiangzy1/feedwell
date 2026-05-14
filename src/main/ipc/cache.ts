import { ipcMain } from 'electron'
import { configuredSessions } from '../index'
import { getCacheSizes, clearCaches, performAutoCleanup } from '../services/cache'
import { getSettingJson } from './settings'
import { MB } from '../services/cache'

const SETTINGS_KEY = 'feedwell-cache-settings'

function getMaxBytes(): number {
  const settings = getSettingJson<{ maxSizeMB: number }>(SETTINGS_KEY)
  if (!settings?.maxSizeMB) return 0
  return settings.maxSizeMB * MB
}

export function registerCacheIpc(): void {
  ipcMain.handle('cache:getSizes', async () => {
    return getCacheSizes(configuredSessions)
  })

  ipcMain.handle('cache:clearAll', async () => {
    await clearCaches(configuredSessions)
    return getCacheSizes(configuredSessions)
  })

  ipcMain.handle('cache:cleanup', async () => {
    const maxBytes = getMaxBytes()
    await performAutoCleanup(configuredSessions, maxBytes)
  })
}
