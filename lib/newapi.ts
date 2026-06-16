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
  response_format?: { type: 'json_object' | 'text' } | null
  retryWithoutResponseFormat?: boolean
  timeoutMs?: number
  /** 用户级配置覆盖（设置页填入的 API key）；缺省回退服务端环境变量 */
  auth?: { apiKey?: string; baseUrl?: string }
  /** 透传给上游的额外 body 字段（如 MiMo 的 thinking:{type:'disabled'} 关思考链、降延迟） */
  extraBody?: Record<string, unknown>
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
  | 'unsupported_response_format'
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

function isUnsupportedResponseFormatDetail(detail: string) {
  const normalized = detail.toLowerCase()

  return (
    normalized.includes('response_format') &&
    normalized.includes('json_object') &&
    (normalized.includes('not supported') ||
      normalized.includes('not support') ||
      normalized.includes('unsupported') ||
      normalized.includes('不支持'))
  )
}

function buildChatCompletionBody(
  model: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions,
  responseFormat: ChatCompletionOptions['response_format'],
) {
  const body: {
    model: string
    messages: ChatMessage[]
    temperature?: number
    max_tokens?: number
    response_format?: { type: 'json_object' | 'text' }
  } = {
    model,
    messages,
  }

  if (typeof options.temperature === 'number') {
    body.temperature = options.temperature
  }

  if (typeof options.max_tokens === 'number') {
    body.max_tokens = options.max_tokens
  }

  if (responseFormat) {
    body.response_format = responseFormat
  }

  // 透传额外字段（如 MiMo thinking:{type:'disabled'}）；放最后，允许覆盖上面的默认
  if (options.extraBody) {
    return { ...body, ...options.extraBody }
  }

  return body
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

function getConfig(override?: { apiKey?: string; baseUrl?: string }) {
  // 优先用用户在设置页填入的 key/地址，缺省回退服务端环境变量
  const baseUrl = override?.baseUrl?.trim() || process.env.NEWAPI_BASE_URL?.trim()
  const apiKey = override?.apiKey?.trim() || process.env.NEWAPI_API_KEY?.trim()

  if (!baseUrl || !apiKey) {
    console.error('[NewAPI] 配置缺失', {
      hasBaseUrl: Boolean(baseUrl),
      hasApiKey: Boolean(apiKey),
    })
    throw new NewAPIUserFacingError(
      'config_missing',
      'AI 功能尚未激活：请在「设置」页填入 API key，或在服务端配置 NEWAPI_BASE_URL / NEWAPI_API_KEY',
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
  if (fallback && isUnsupportedResponseFormatDetail(fallback)) {
    return new NewAPIUserFacingError(
      'unsupported_response_format',
      '当前模型不支持 response_format=json_object 结构化输出，请关闭结构化输出参数，改用提示词约束 JSON 输出',
      status,
    )
  }

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
    `NewAPI 调用失败：上游返回 HTTP ${status}，请检查模型服务配置或稍后重试`,
    status,
  )
}

export async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
) {
  const { baseUrl, apiKey } = getConfig(options.auth)
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

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retryWithoutResponseFormat =
    options.retryWithoutResponseFormat !== false &&
    options.response_format?.type === 'json_object'

  const sendRequest = async (
    responseFormat: ChatCompletionOptions['response_format'],
    attempt: 'primary' | 'retry_without_response_format',
  ) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(
          buildChatCompletionBody(model, messages, options, responseFormat),
        ),
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

        const unsupportedResponseFormat =
          responseFormat?.type === 'json_object' &&
          isUnsupportedResponseFormatDetail(fallback)

        console.error('[NewAPI] 请求失败', {
          model,
          status: response.status,
          endpoint: redactUrl(endpoint),
          attempt,
          responseFormat: responseFormat?.type ?? 'none',
          unsupportedResponseFormat,
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
          attempt,
          message: error instanceof Error ? error.message : String(error),
        })
        throw new NewAPIUserFacingError(
          'invalid_response',
          'NewAPI 服务返回内容异常：响应不是有效 JSON，无法完成分析',
        )
      }

      const content = readChoiceContent(data.choices?.[0])

      if (!content) {
        console.error('[NewAPI] 空响应内容', {
          model,
          endpoint: redactUrl(endpoint),
          attempt,
          response: toSafeLogDetail(JSON.stringify(data)),
        })
        throw new NewAPIUserFacingError(
          'empty_response',
          'NewAPI 服务返回了空内容，暂时无法完成分析',
        )
      }

      return data
    } finally {
      clearTimeout(timer)
    }
  }

  try {
    try {
      return await sendRequest(options.response_format, 'primary')
    } catch (error) {
      if (
        retryWithoutResponseFormat &&
        error instanceof NewAPIUserFacingError &&
        error.code === 'unsupported_response_format'
      ) {
        console.warn('[NewAPI] 模型不支持结构化输出，去掉 response_format 后重试', {
          model,
          endpoint: redactUrl(endpoint),
        })
        return await sendRequest(null, 'retry_without_response_format')
      }

      throw error
    }
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
