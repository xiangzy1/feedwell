export interface OpenAIConfig {
  aiBaseUrl?: string
  aiApiKey?: string
  aiModel?: string
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function callOpenAI(config: OpenAIConfig, messages: ChatMessage[], temperature = 0.3): Promise<string> {
  const baseUrl = (config.aiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model = config.aiModel || 'gpt-4o-mini'

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.aiApiKey}`
    },
    body: JSON.stringify({ model, messages, temperature })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI API error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from AI')
  return content
}
