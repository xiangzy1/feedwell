import { callOpenAI, type OpenAIConfig } from './openai-client'

export type SummaryConfig = OpenAIConfig & { targetLang: string }

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function summarizeText(title: string, content: string, config: SummaryConfig): Promise<string> {
  const plainContent = stripHtml(content).slice(0, 8000)
  const summary = await callOpenAI(config, [
    { role: 'system', content: `You are a concise summarizer. Summarize the following article in ${config.targetLang}. Output only the summary text, no preamble. Capture the key points in 3-5 sentences so the reader can quickly decide whether to read the full article.` },
    { role: 'user', content: `Title: ${title}\n\n${plainContent}` }
  ], 0.4)
  return summary.trim()
}
