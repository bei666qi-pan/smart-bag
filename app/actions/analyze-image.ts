'use server'

import { z } from 'zod'
import {
  chatCompletion,
  extractModelText,
  parseModelJSON,
  type ChatMessage,
} from '@/lib/newapi'
import { analyzeTextWithBagText, type TextAnalysisOutput } from '@/app/actions/analyze-text'
import { getSessionUser, getUserNewapiConfig } from '@/lib/auth'

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024

const imageUploadSchema = z.object({
  image: z
    .instanceof(Blob)
    .refine((file) => file.size > 0, '未收到可分析的图片')
    .refine((file) => file.size <= MAX_IMAGE_SIZE_BYTES, '图片不能超过 8MB'),
})

const imageAnalysisSchema = z.object({
  objects: z.array(z.string().trim()).default([]),
  scene: z.string().trim().min(1),
  risks: z.array(z.string().trim()).default([]),
  confidence: z.coerce.number().min(0).max(1),
  raw_summary: z.string().trim().min(1),
})

export type ImageAnalysisResult = z.infer<typeof imageAnalysisSchema>

export type AnalyzeImagePayload = TextAnalysisOutput & {
  structured: ImageAnalysisResult
  models: {
    vision: 'bag-image'
    text: 'bag-text'
  }
  timestamp: string
}

export type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[] | undefined>
  payload?: AnalyzeImagePayload
}

function buildBagImageMessages(base64Image: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是智能书包系统中的视觉理解助手，只负责识别图片内容并输出结构化 JSON。

请严格返回以下 JSON，不能包含 markdown 或额外说明：
{
  "objects": ["书本", "笔袋", "水杯"],
  "scene": "书桌",
  "risks": ["未发现明显危险物"],
  "confidence": 0.92,
  "raw_summary": "画面中主要是学习用品"
}

要求：
1. objects 只列出画面中较明确的关键物品。
2. risks 没有明显风险时返回 ["未发现明显危险物"]。
3. confidence 使用 0 到 1 之间的小数。`,
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: '请分析这张智能书包相关图片，并输出结构化 JSON。' },
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${base64Image}` },
        },
      ],
    },
  ]
}

async function callBagImage(
  base64Image: string,
  auth?: { apiKey: string; baseUrl?: string },
) {
  const response = await chatCompletion('bag-image', buildBagImageMessages(base64Image), {
    temperature: 0.1,
    max_tokens: 800,
    response_format: { type: 'json_object' },
    timeoutMs: 45_000,
    auth,
  })

  const raw = extractModelText(response)
  const parsed = parseModelJSON<ImageAnalysisResult>(raw)
  const validated = imageAnalysisSchema.safeParse(parsed)

  if (!validated.success) {
    console.error('[bag-image] 输出结构异常', {
      issues: validated.error.issues,
      raw: raw.slice(0, 500),
    })
    throw new Error('视觉模型返回结构异常，请稍后重试')
  }

  return validated.data
}

async function callBagTextFromImageResult(imageResult: ImageAnalysisResult) {
  return analyzeTextWithBagText({
    text: JSON.stringify(imageResult, null, 2),
    context: '以下内容是 bag-image 输出的结构化视觉识别结果，请据此生成网页展示结论和建议。',
    task:
      '请根据结构化视觉结果生成中文 analysis、suggestion、screen_text、severity。不要臆造图片中不存在的物品。',
  })
}

export async function analyzeImageAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    // 鉴权：未登录直接拒绝；已登录优先用其设置页填入的 API key
    const user = await getSessionUser()
    if (!user) {
      return {
        success: false,
        message: '未登录或会话已过期，请重新登录',
      }
    }
    const auth = (await getUserNewapiConfig(user.username)) ?? undefined

    const candidate = formData.get('image')
    const parsed = imageUploadSchema.safeParse({ image: candidate })

    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message || '图片校验失败',
        errors: parsed.error.flatten().fieldErrors,
      }
    }

    const imageFile = parsed.data.image as Blob
    const mimeType = imageFile.type || 'image/jpeg'

    if (!mimeType.startsWith('image/')) {
      return {
        success: false,
        message: '上传内容不是图片，无法进行视觉分析',
      }
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer())
    const base64Image = buffer.toString('base64')

    console.log('[Vision Analysis] 开始调用 bag-image')
    const structured = await callBagImage(base64Image, auth)
    console.log('[Vision Analysis] bag-image 完成', {
      objects: structured.objects,
      scene: structured.scene,
      confidence: structured.confidence,
    })

    console.log('[Vision Analysis] 开始调用 bag-text')
    const textResult = await callBagTextFromImageResult(structured)
    console.log('[Vision Analysis] bag-text 完成', {
      severity: textResult.severity,
      screen_text: textResult.screen_text,
    })

    return {
      success: true,
      message: 'AI 分析完成',
      payload: {
        ...textResult,
        structured,
        models: {
          vision: 'bag-image',
          text: 'bag-text',
        },
        timestamp: new Date().toISOString(),
      },
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '视觉分析失败，请稍后重试'

    console.error('[Vision Analysis] 失败', { message })

    return {
      success: false,
      message,
    }
  }
}
