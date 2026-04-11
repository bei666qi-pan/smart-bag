'use server'

import { z } from 'zod'
import {
  chatCompletion,
  extractModelText,
  NewAPIUserFacingError,
  parseModelJSON,
  type ChatMessage,
} from '@/lib/newapi'

const textAnalysisOutputSchema = z.object({
  analysis: z.string().trim().min(1),
  suggestion: z.string().trim().min(1),
  screen_text: z.string().trim().min(1).max(24),
  severity: z.enum(['low', 'medium', 'high']),
})

export type TextAnalysisInput = {
  text: string
  context?: string
  task?: string
}

export type TextAnalysisOutput = z.infer<typeof textAnalysisOutputSchema>

export type DeviceMessageReview = TextAnalysisOutput & {
  original_text: string
  should_send: boolean
  decision_reason: string
}

export type DeviceMessageReviewActionResult =
  | {
      ok: true
      review: DeviceMessageReview
    }
  | {
      ok: false
      message: string
      canUseIotPanel: true
      code?: string
    }

function buildBagTextMessages(input: TextAnalysisInput): ChatMessage[] {
  const normalizedTask = input.task?.trim()
  const normalizedContext = input.context?.trim()

  return [
    {
      role: 'system',
      content: `你是智能书包系统中的中文文本分析助手，只负责基于输入内容生成结构化 JSON 结果。

请严格返回以下 JSON，不能包含 markdown、解释或多余文字：
{
  "analysis": "1-3 句中文结论",
  "suggestion": "1 条简短建议",
  "screen_text": "适合设备屏幕展示的短文本，尽量 10 字以内",
  "severity": "low" | "medium" | "high"
}

要求：
1. analysis 面向网页展示，表达清晰自然。
2. suggestion 要可执行、简短。
3. screen_text 用于设备屏幕，应明显短于 analysis。
4. low 表示可直接采用；medium 表示需要用户留意；high 表示建议人工确认后再执行。`,
    },
    {
      role: 'user',
      content: [
        normalizedTask ? `任务：${normalizedTask}` : null,
        normalizedContext ? `上下文：${normalizedContext}` : null,
        `待分析内容：${input.text.trim()}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ]
}

/**
 * 稳定的 bag-text 服务端入口，供未来接入：
 * - 用户消息润色
 * - 设备状态文本分析
 * - 规则解释
 * - 命令建议
 */
export async function analyzeTextWithBagText(
  input: TextAnalysisInput,
): Promise<TextAnalysisOutput> {
  const normalizedText = input.text.trim()

  if (!normalizedText) {
    throw new Error('待分析文本不能为空')
  }

  const response = await chatCompletion('bag-text', buildBagTextMessages(input), {
    temperature: 0.3,
    max_tokens: 512,
    response_format: { type: 'json_object' },
    timeoutMs: 30_000,
  })

  let raw = ''
  let parsed: TextAnalysisOutput

  try {
    raw = extractModelText(response)
    parsed = parseModelJSON<TextAnalysisOutput>(raw)
  } catch (error) {
    console.error('[bag-text] JSON 解析失败', {
      message: error instanceof Error ? error.message : String(error),
      raw: raw ? raw.slice(0, 500) : '',
    })
    throw new NewAPIUserFacingError(
      'invalid_model_json',
      'bag-text 返回内容不是可解析的 JSON，请稍后重试或联系维护人员检查模型输出格式',
    )
  }

  const validated = textAnalysisOutputSchema.safeParse(parsed)

  if (!validated.success) {
    console.error('[bag-text] 输出结构异常', {
      issues: validated.error.issues,
      raw: raw.slice(0, 500),
    })
    throw new NewAPIUserFacingError(
      'invalid_response',
      'bag-text 返回 JSON 结构异常，请稍后重试或联系维护人员检查模型输出格式',
    )
  }

  return validated.data
}

export async function reviewDeviceMessageAction(
  input: TextAnalysisInput,
): Promise<DeviceMessageReviewActionResult> {
  try {
    const originalText = input.text.trim()

    if (!originalText) {
      return {
        ok: false,
        message: '待评估文本不能为空',
        canUseIotPanel: true,
        code: 'empty_input',
      }
    }

    const reviewed = await analyzeTextWithBagText({
      text: originalText,
      context: input.context,
      task:
        input.task ||
        '请先润色成适合智能书包设备展示的中文提示，再判断是否适合直接下发到设备屏幕。',
    })

    const shouldSend = reviewed.severity !== 'high'
    const decisionReason = shouldSend
      ? 'bag-text 判断该内容可直接用于设备展示'
      : 'bag-text 判断该内容需要人工确认，已阻止自动下发'

    return {
      ok: true,
      review: {
        ...reviewed,
        original_text: originalText,
        should_send: shouldSend,
        decision_reason: decisionReason,
      },
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'AI 评估失败，请稍后重试'
    const code =
      error instanceof NewAPIUserFacingError ? error.code : 'unknown_error'

    console.error('[bag-text] 设备消息评估失败', {
      code,
      message,
    })

    return {
      ok: false,
      message,
      canUseIotPanel: true,
      code,
    }
  }
}
