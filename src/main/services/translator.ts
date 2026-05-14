import { createHash } from 'crypto'
import { callOpenAI, streamOpenAI, type OpenAIConfig } from './openai-client'

export interface TranslationConfig extends OpenAIConfig {
  provider: 'ai' | 'google' | 'microsoft'
  targetLang: string
  googleApiKey?: string
  microsoftApiKey?: string
  microsoftRegion?: string
}

export function hashText(text: string, targetLang: string): string {
  return createHash('sha256').update(text + '\0' + targetLang).digest('hex')
}

export async function translateTexts(texts: string[], config: TranslationConfig): Promise<string[]> {
  if (texts.length === 0) return []
  switch (config.provider) {
    case 'ai': return translateViaAI(texts, config)
    case 'google': return translateViaGoogle(texts, config)
    case 'microsoft': return translateViaMicrosoft(texts, config)
    default: throw new Error(`Unknown provider: ${config.provider}`)
  }
}

const COMPLETE_JSON_STRING = /"(?:[^"\\]|\\.)*"/g

function stripMarkdownFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function parseTranslationResponse(raw: string, expectedCount: number): string[] {
  const cleaned = stripMarkdownFences(raw)
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    parsed = JSON.parse(cleaned + ']')
  }
  if (!Array.isArray(parsed) || parsed.length !== expectedCount) {
    throw new Error(`AI returned ${Array.isArray(parsed) ? parsed.length : 'non-array'} results, expected ${expectedCount}`)
  }
  return parsed.map(String)
}

export async function streamTranslateTexts(
  texts: string[],
  config: TranslationConfig,
  onResult: (index: number, translated: string) => void
): Promise<string[]> {
  if (texts.length === 0) return []

  let accumulated = ''
  let emittedCount = 0

  await streamOpenAI(config, [
    { role: 'system', content: `Translate the following texts to ${config.targetLang}. Return a JSON array of translated strings in the same order. Only return the JSON array, nothing else.` },
    { role: 'user', content: JSON.stringify(texts) }
  ], (delta) => {
    accumulated += delta
    const cleaned = stripMarkdownFences(accumulated)
    // Only complete quoted strings match; the trailing incomplete one won't
    const matches = [...cleaned.matchAll(COMPLETE_JSON_STRING)]
    if (matches.length > emittedCount) {
      for (let i = emittedCount; i < matches.length; i++) {
        onResult(i, JSON.parse(matches[i][0]))
      }
      emittedCount = matches.length
    }
  }, 0.3)

  // Final parse with the complete text
  const results = parseTranslationResponse(accumulated, texts.length)
  for (let i = emittedCount; i < results.length; i++) {
    onResult(i, results[i])
  }

  return results
}

async function translateViaAI(texts: string[], config: TranslationConfig): Promise<string[]> {
  const content = await callOpenAI(config, [
    { role: 'system', content: `Translate the following texts to ${config.targetLang}. Return a JSON array of translated strings in the same order. Only return the JSON array, nothing else.` },
    { role: 'user', content: JSON.stringify(texts) }
  ], 0.3)

  return parseTranslationResponse(content, texts.length)
}

async function translateViaGoogle(texts: string[], config: TranslationConfig): Promise<string[]> {
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${config.googleApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: texts,
        target: config.targetLang,
        format: 'text'
      })
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google API error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const translations = data.data?.translations
  if (!Array.isArray(translations) || translations.length !== texts.length) {
    throw new Error('Unexpected Google Translate response format')
  }
  return translations.map((t: { translatedText: string }) => t.translatedText)
}

async function translateViaMicrosoft(texts: string[], config: TranslationConfig): Promise<string[]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': config.microsoftApiKey || '',
  }
  if (config.microsoftRegion) {
    headers['Ocp-Apim-Subscription-Region'] = config.microsoftRegion
  }

  const res = await fetch(
    `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${config.targetLang}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(texts.map(t => ({ text: t })))
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Microsoft API error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  if (!Array.isArray(data) || data.length !== texts.length) {
    throw new Error('Unexpected Microsoft Translator response format')
  }
  return data.map((item: { translations: { text: string }[] }) => item.translations[0].text)
}
