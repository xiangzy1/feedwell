import { ipcMain, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { importOpml, exportOpml } from '../services/opml'

export function registerOpmlIpc(): void {
  ipcMain.handle('opml:import', async (_event, filePath?: string) => {
    const path = filePath || (await dialog.showOpenDialog({
      filters: [{ name: 'OPML', extensions: ['opml', 'xml'] }],
      properties: ['openFile']
    })).filePaths[0]
    if (!path) return { imported: 0, failed: 0 }

    const xml = await readFile(path, 'utf-8')
    return importOpml(xml)
  })

  ipcMain.handle('opml:export', async () => {
    const { filePath } = await dialog.showSaveDialog({
      defaultPath: 'subscriptions.opml',
      filters: [{ name: 'OPML', extensions: ['opml'] }]
    })
    if (!filePath) return false

    const xml = exportOpml()
    await writeFile(filePath, xml, 'utf-8')
    return true
  })
}
