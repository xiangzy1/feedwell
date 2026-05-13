import { callOpenAI, streamOpenAI, type ChatMessage, type OpenAIConfig } from './openai-client'

export type SummaryConfig = OpenAIConfig & { targetLang: string }

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildSummaryMessages(title: string, content: string, config: SummaryConfig): ChatMessage[] {
  const plainContent = stripHtml(content).slice(0, 8000)
  return [
    { role: 'system', content: `You are a concise summarizer. Summarize the following article in ${config.targetLang}. Output only the summary text, no preamble. Capture the key points in 3-5 sentences so the reader can quickly decide whether to read the full article.` },
    { role: 'user', content: `Title: ${title}\n\n${plainContent}` }
  ]
}

export async function summarizeText(title: string, content: string, config: SummaryConfig): Promise<string> {
  const summary = await callOpenAI(config, buildSummaryMessages(title, content, config), 0.4)
  return summary.trim()
}

export async function streamSummarizeText(
  title: string,
  content: string,
  config: SummaryConfig,
  onChunk: (delta: string) => void
): Promise<string> {
  const summary = await streamOpenAI(config, buildSummaryMessages(title, content, config), onChunk, 0.4)
  return summary.trim()
}
