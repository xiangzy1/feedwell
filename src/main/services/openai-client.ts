export interface OpenAIConfig {
  aiBaseUrl?: string
  aiApiKey?: string
  aiModel?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function fetchCompletion(config: OpenAIConfig, messages: ChatMessage[], temperature: number, stream = false): Promise<Response> {
  const baseUrl = (config.aiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model = config.aiModel || 'gpt-4o-mini'

  const body: Record<string, unknown> = { model, messages, temperature }
  if (stream) body.stream = true

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

  return res
}

export async function callOpenAI(config: OpenAIConfig, messages: ChatMessage[], temperature = 0.3): Promise<string> {
  const res = await fetchCompletion(config, messages, temperature)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from AI')
  return content
}

export async function streamOpenAI(
  config: OpenAIConfig,
  messages: ChatMessage[],
  onChunk: (text: string) => void,
  temperature = 0.3
): Promise<string> {
  const res = await fetchCompletion(config, messages, temperature, true)

  if (!res.body) throw new Error('No response body')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()!

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue
      const payload = trimmed.slice(6)
      if (payload === '[DONE]') continue
      try {
        const parsed = JSON.parse(payload)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) {
          fullText += delta
          onChunk(delta)
        }
      } catch { /* skip malformed lines */ }
    }
  }

  return fullText
}
