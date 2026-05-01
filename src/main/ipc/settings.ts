import { ipcMain } from 'electron'
import { getDb } from '../db'
import { createStatsWindow } from '../windows/stats'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (_event, key: string) => {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  })

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value))
    if (key === 'openStats' && value === true) {
      createStatsWindow()
    }
  })
}
