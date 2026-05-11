import { ipcMain } from 'electron'
import { getDb } from '../db'
import { getSettingJson } from './settings'
import { hashText, translateTexts, type TranslationConfig } from '../services/translator'

interface CachedTranslation {
  original_text: string
  translated: string
}

function loadConfig(): TranslationConfig {
  const raw = getSettingJson<Record<string, string>>('feedwell-translation-settings')
  if (!raw || !raw.provider || raw.provider === 'disabled') throw new Error('Translation not configured')
  return {
    provider: raw.provider as TranslationConfig['provider'],
    targetLang: raw.targetLang || 'en',
    aiBaseUrl: raw.aiBaseUrl,
    aiApiKey: raw.aiApiKey,
    aiModel: raw.aiModel,
    googleApiKey: raw.googleApiKey,
    microsoftApiKey: raw.microsoftApiKey,
    microsoftRegion: raw.microsoftRegion,
  }
}

export function registerTranslationIpc(): void {
  ipcMain.handle('translation:translate', async (_event, { articleId, texts }: { articleId: number; texts: string[] }) => {
    if (!texts || texts.length === 0) return []

    const config = loadConfig()

    const targetLang = config.targetLang
    const db = getDb()

    // Check cache
    const cached = db.prepare(
      'SELECT original_text, translated FROM translations WHERE article_id = ? AND target_lang = ? AND source_hash IN (?' + ',?'.repeat(Math.max(0, texts.length - 1)) + ')'
    ).all(articleId, targetLang, ...texts.map(t => hashText(t, targetLang))) as CachedTranslation[]

    const cachedMap = new Map(cached.map(c => [c.original_text, c.translated]))

    const uncachedTexts = texts.filter(t => !cachedMap.has(t))

    if (uncachedTexts.length > 0) {
      const translated = await translateTexts(uncachedTexts, config)

      const insertStmt = db.prepare(
        'INSERT OR IGNORE INTO translations (article_id, target_lang, source_hash, original_text, translated, provider) VALUES (?, ?, ?, ?, ?, ?)'
      )
      const insertMany = db.transaction((items: { text: string; result: string }[]) => {
        for (const { text, result } of items) {
          insertStmt.run(articleId, targetLang, hashText(text, targetLang), text, result, config.provider)
        }
      })
      insertMany(uncachedTexts.map((text, i) => ({ text, result: translated[i] })))

      for (let i = 0; i < uncachedTexts.length; i++) {
        cachedMap.set(uncachedTexts[i], translated[i])
      }
    }

    return texts.map(t => cachedMap.get(t) ?? '')
  })

  ipcMain.handle('translation:testConnection', async () => {
    const config = loadConfig()
    await translateTexts(['Hello'], config)
    return true
  })
}
