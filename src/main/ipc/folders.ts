import { ipcMain } from 'electron'
import { getDb } from '../db'

export function registerFolderIpc(): void {
  ipcMain.handle('folders:create', (_event, name: string) => {
    const maxOrder = getDb().prepare('SELECT MAX(sort_order) as max FROM folders').get() as { max: number | null }
    const info = getDb().prepare('INSERT INTO folders (name, sort_order) VALUES (?, ?)').run(name, (maxOrder.max ?? -1) + 1)
    return { id: info.lastInsertRowid }
  })

  ipcMain.handle('folders:reorder', (_event, orderedIds: number[]) => {
    const stmt = getDb().prepare('UPDATE folders SET sort_order = ? WHERE id = ?')
    const tx = getDb().transaction((ids: number[]) => {
      for (let i = 0; i < ids.length; i++) {
        stmt.run(i, ids[i])
      }
    })
    tx(orderedIds)
  })
}
