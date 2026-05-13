import { ipcMain } from 'electron'
import { getDb } from '../db'
import { rescheduleScheduler } from '../services/scheduler'
const stmtGet = () => getDb().prepare('SELECT value FROM settings WHERE key = ?')
const stmtSet = () => getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')

export function getSetting(key: string): string | null {
  return (stmtGet().get(key) as { value: string } | undefined)?.value ?? null
}

export function getSettingJson<T>(key: string): T | null {
  const value = getSetting(key)
  if (!value) return null
  try { return JSON.parse(value) as T } catch { return null }
}

export function setSetting(key: string, value: unknown): void {
  stmtSet().run(key, JSON.stringify(value))
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (_event, key: string) => getSetting(key))
  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    setSetting(key, value)
  })
  ipcMain.handle('scheduler:reschedule', () => rescheduleScheduler())
}
