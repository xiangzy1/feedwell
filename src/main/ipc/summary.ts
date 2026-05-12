import { ipcMain } from 'electron'
import { getDb } from '../db'
import { getSettingJson } from './settings'
import { summarizeText, type SummaryConfig } from '../services/summarizer'

function loadConfig(): SummaryConfig & { provider: string } {
  const raw = getSettingJson<Record<string, string>>('feedwell-translation-settings')
  if (!raw || raw.provider !== 'ai') throw new Error('AI provider not configured')
  return {
    provider: raw.provider,
    targetLang: raw.targetLang || 'en',
    aiBaseUrl: raw.aiBaseUrl,
    aiApiKey: raw.aiApiKey,
    aiModel: raw.aiModel,
  }
}

export function registerSummaryIpc(): void {
  ipcMain.handle('summary:summarize', async (_event, { articleId, title, content }: { articleId: number; title: string; content: string }) => {
    if (!title && !content) return ''

    const config = loadConfig()
    const targetLang = config.targetLang
    const db = getDb()

    // Check cache
    const cached = db.prepare(
      'SELECT summary FROM summaries WHERE article_id = ? AND target_lang = ?'
    ).get(articleId, targetLang) as { summary: string } | undefined

    if (cached) return cached.summary

    const summary = await summarizeText(title, content, config)

    db.prepare(
      'INSERT OR IGNORE INTO summaries (article_id, target_lang, summary) VALUES (?, ?, ?)'
    ).run(articleId, targetLang, summary)

    return summary
  })
}
