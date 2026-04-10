export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatContentPart[]
}

export type ChatCompletionOptions = {
  temperature?: number
  max_tokens?: number
  response_format?: { type: 'json_object' | 'text' }
  timeoutMs?: number
}

type ChatChoice = {
  message: {
    role: string
    content: string | Array<{ type?: string; text?: string }>
  }
  finish_reason?: string
}

export type NewAPIResponse = {
  id: string
  choices: ChatChoice[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  error?: {
    message?: string
    type?: string
    code?: string | number
  }
}

const DEFAULT_TIMEOUT_MS = 45_000

function normalizeBaseUrl(input: string) {
  const trimmed = input.trim().replace(/\/+$/, '')

  if (!trimmed) {
    throw new Error('NewAPI 配置缺失：NEWAPI_BASE_URL 不能为空')
  }

  if (trimmed.endsWith('/chat/completions')) {
    return trimmed.slice(0, -'/chat/completions'.length)
  }

  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
}

function getConfig() {
  const baseUrl = process.env.NEWAPI_BASE_URL
  const apiKey = process.env.NEWAPI_API_KEY

  if (!baseUrl || !apiKey) {
    throw new Error('NewAPI 配置缺失：请设置 NEWAPI_BASE_URL 和 NEWAPI_API_KEY')
  }

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    apiKey,
  }
}

function readChoiceContent(choice: ChatChoice | undefined) {
  const content = choice?.message?.content

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim()
  }

  return ''
}

function toUserFacingError(status: number, fallback?: string) {
  if (status === 401 || status === 403) {
    return 'NewAPI 鉴权失败，请检查服务端 API Key 配置'
  }

  if (status === 404) {
    return 'NewAPI 接口地址不可用，请检查 NEWAPI_BASE_URL 是否正确'
  }

  if (status === 408 || status === 504) {
    return 'NewAPI 响应超时，请稍后重试'
  }

  if (status >= 500) {
    return 'NewAPI 服务暂时不可用，请稍后重试'
  }

  return fallback || `NewAPI 调用失败（HTTP ${status}）`
}

export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
) {
  const { baseUrl, apiKey } = getConfig()
  const endpoint = `${baseUrl}/chat/completions`
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature,
        max_tokens: options.max_tokens,
        response_format: options.response_format,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      let fallback = ''

      try {
        const body = (await response.json()) as NewAPIResponse
        fallback = body.error?.message || ''
      } catch {
        fallback = await response.text().catch(() => '')
      }

      console.error('[NewAPI] 请求失败', {
        model,
        status: response.status,
        endpoint,
        detail: fallback.slice(0, 500),
      })

      throw new Error(toUserFacingError(response.status, fallback))
    }

    const data = (await response.json()) as NewAPIResponse
    const content = readChoiceContent(data.choices?.[0])

    if (!content) {
      console.error('[NewAPI] 空响应内容', {
        model,
        endpoint,
        response: JSON.stringify(data).slice(0, 500),
      })
      throw new Error('NewAPI 返回了空内容，暂时无法完成分析')
    }

    return data
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`NewAPI 调用超时（${Math.round(timeoutMs / 1000)} 秒）`)
    }

    throw error
  } finally {
    clearTimeout(timer)
  }
}

export function extractModelText(response: NewAPIResponse) {
  const text = readChoiceContent(response.choices?.[0])

  if (!text) {
    throw new Error('模型未返回可解析内容')
  }

  return text
}

export function parseModelJSON<T>(raw: string) {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T
    }

    throw new Error('模型返回的 JSON 无法解析')
  }
}
