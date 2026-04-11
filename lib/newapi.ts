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

export type NewAPIErrorCode =
  | 'config_missing'
  | 'invalid_base_url'
  | 'auth_failed'
  | 'not_found'
  | 'upstream_timeout'
  | 'upstream_5xx'
  | 'upstream_http_error'
  | 'network_error'
  | 'invalid_response'
  | 'empty_response'
  | 'invalid_model_json'

export class NewAPIUserFacingError extends Error {
  code: NewAPIErrorCode
  status?: number

  constructor(code: NewAPIErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'NewAPIUserFacingError'
    this.code = code
    this.status = status
  }
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

function isNewAPIUserFacingError(error: unknown): error is NewAPIUserFacingError {
  return error instanceof NewAPIUserFacingError
}

function redactSecretLikeText(input: string) {
  return input
    .replace(/Bearer\s+[^\s"'`]+/gi, 'Bearer ***')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
    .replace(/(api[_-]?key["':=\s]+)[^"',\s]+/gi, '$1***')
}

function redactUrl(input: string) {
  try {
    const url = new URL(input)
    if (url.username) url.username = '***'
    if (url.password) url.password = '***'
    return url.toString()
  } catch {
    return redactSecretLikeText(input)
  }
}

function toSafeLogDetail(detail: string) {
  return redactSecretLikeText(detail).slice(0, 500)
}

function normalizeBaseUrl(input: string) {
  const trimmed = input.trim().replace(/\/+$/, '')

  if (!trimmed) {
    throw new NewAPIUserFacingError(
      'config_missing',
      'NewAPI 配置缺失：请在服务端配置 NEWAPI_BASE_URL',
    )
  }

  if (trimmed.endsWith('/chat/completions')) {
    return trimmed.slice(0, -'/chat/completions'.length)
  }

  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
}

function getConfig() {
  const baseUrl = process.env.NEWAPI_BASE_URL?.trim()
  const apiKey = process.env.NEWAPI_API_KEY?.trim()

  if (!baseUrl || !apiKey) {
    const missing = [
      !baseUrl ? 'NEWAPI_BASE_URL' : null,
      !apiKey ? 'NEWAPI_API_KEY' : null,
    ].filter(Boolean)

    console.error('[NewAPI] 配置缺失', { missing })
    throw new NewAPIUserFacingError(
      'config_missing',
      `NewAPI 配置缺失：请在服务端配置 ${missing.join('、')}`,
    )
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
    return new NewAPIUserFacingError(
      'auth_failed',
      'NewAPI 鉴权失败：请检查服务端 NEWAPI_API_KEY 是否正确',
      status,
    )
  }

  if (status === 404) {
    return new NewAPIUserFacingError(
      'not_found',
      'NewAPI 接口地址不可用：请检查 NEWAPI_BASE_URL 是否正确',
      status,
    )
  }

  if (status === 408 || status === 504) {
    return new NewAPIUserFacingError(
      'upstream_timeout',
      'NewAPI 响应超时：请稍后重试，或检查上游服务是否可用',
      status,
    )
  }

  if (status >= 500) {
    return new NewAPIUserFacingError(
      'upstream_5xx',
      'NewAPI 上游服务故障：请稍后重试或检查 NewAPI 服务状态',
      status,
    )
  }

  return new NewAPIUserFacingError(
    'upstream_http_error',
    fallback || `NewAPI 调用失败：HTTP ${status}`,
    status,
  )
}

export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
) {
  const { baseUrl, apiKey } = getConfig()
  const endpoint = `${baseUrl}/chat/completions`
  try {
    new URL(endpoint)
  } catch {
    console.error('[NewAPI] 接口地址格式无效', { model, endpoint: redactUrl(endpoint) })
    throw new NewAPIUserFacingError(
      'invalid_base_url',
      'NewAPI 接口地址格式无效：请检查 NEWAPI_BASE_URL',
    )
  }

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
        const rawBody = await response.text()
        try {
          const body = rawBody ? (JSON.parse(rawBody) as NewAPIResponse) : null
          fallback = body?.error?.message || rawBody
        } catch {
          fallback = rawBody
        }
      } catch {
        fallback = ''
      }

      console.error('[NewAPI] 请求失败', {
        model,
        status: response.status,
        endpoint: redactUrl(endpoint),
        detail: toSafeLogDetail(fallback),
      })

      throw toUserFacingError(response.status, fallback)
    }

    let data: NewAPIResponse
    try {
      data = (await response.json()) as NewAPIResponse
    } catch (error) {
      console.error('[NewAPI] 响应不是有效 JSON', {
        model,
        endpoint: redactUrl(endpoint),
        message: error instanceof Error ? error.message : String(error),
      })
      throw new NewAPIUserFacingError(
        'invalid_response',
        'NewAPI 返回内容不是有效 JSON，无法完成分析',
      )
    }

    const content = readChoiceContent(data.choices?.[0])

    if (!content) {
      console.error('[NewAPI] 空响应内容', {
        model,
        endpoint: redactUrl(endpoint),
        response: toSafeLogDetail(JSON.stringify(data)),
      })
      throw new NewAPIUserFacingError(
        'empty_response',
        'NewAPI 返回了空内容，暂时无法完成分析',
      )
    }

    return data
  } catch (error) {
    if (isNewAPIUserFacingError(error)) {
      throw error
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new NewAPIUserFacingError(
        'upstream_timeout',
        `NewAPI 调用超时：已等待 ${Math.round(timeoutMs / 1000)} 秒`,
      )
    }

    console.error('[NewAPI] 请求异常', {
      model,
      endpoint: redactUrl(endpoint),
      message: error instanceof Error ? error.message : String(error),
    })

    throw new NewAPIUserFacingError(
      'network_error',
      'NewAPI 请求失败：无法连接上游服务，请检查 NEWAPI_BASE_URL 和网络连通性',
    )
  } finally {
    clearTimeout(timer)
  }
}

export function extractModelText(response: NewAPIResponse) {
  const text = readChoiceContent(response.choices?.[0])

  if (!text) {
    throw new NewAPIUserFacingError(
      'empty_response',
      '模型未返回可解析内容',
    )
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
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T
      } catch {
        throw new NewAPIUserFacingError(
          'invalid_model_json',
          '模型返回的 JSON 无法解析',
        )
      }
    }

    throw new NewAPIUserFacingError(
      'invalid_model_json',
      '模型返回的 JSON 无法解析',
    )
  }
}
