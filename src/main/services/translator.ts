import { createHash } from 'crypto'

export interface TranslationConfig {
  provider: 'ai' | 'google' | 'microsoft'
  targetLang: string
  aiBaseUrl?: string
  aiApiKey?: string
  aiModel?: string
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

async function translateViaAI(texts: string[], config: TranslationConfig): Promise<string[]> {
  const baseUrl = (config.aiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model = config.aiModel || 'gpt-4o-mini'
  const prompt = `Translate the following texts to ${config.targetLang}. Return a JSON array of translated strings in the same order. Only return the JSON array, nothing else.`

  const body = {
    model,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: JSON.stringify(texts) }
    ],
    temperature: 0.3
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.aiApiKey}`
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI API error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from AI')

  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const parsed = JSON.parse(cleaned)
  if (!Array.isArray(parsed) || parsed.length !== texts.length) {
    throw new Error(`AI returned ${Array.isArray(parsed) ? parsed.length : 'non-array'} results, expected ${texts.length}`)
  }
  return parsed.map(String)
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
