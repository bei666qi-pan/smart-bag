// app/actions/analyze-image.ts
'use server'

import { z } from 'zod'

export type ActionState = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
  payload?: any
}

const schema = z.object({
  image: z.instanceof(Blob).or(z.instanceof(File)),
})

export async function analyzeImageAction(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    // Validate input
    const file = formData.get('image')
    const parsed = schema.safeParse({ image: file })

    if (!parsed.success) {
      return {
        success: false,
        message: '图片格式错误',
        errors: parsed.error.flatten().fieldErrors,
      }
    }

    // Convert to Buffer
    const imageFile = file as File
    const buffer = Buffer.from(await imageFile.arrayBuffer())
    const base64Image = buffer.toString('base64')

    // Prepare Coze API request
    const cozeToken = process.env.COZE_TOKEN
    const cozeBotId = process.env.COZE_BOT_ID

    if (!cozeToken || !cozeBotId) {
      return {
        success: false,
        message: 'Coze 配置缺失',
      }
    }

    console.log('[Coze] 正在调用大模型分析...')

    // Call Coze REST API (Native fetch - NO SDK)
    const response = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cozeToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bot_id: cozeBotId,
        user_id: 'web_user',
        stream: false,
        auto_save_history: true,
        additional_messages: [
          {
            role: 'user',
            content: '请分析这张图片中的物品,识别书包内容物',
            content_type: 'text',
          },
          {
            role: 'user',
            content: base64Image,
            content_type: 'image',
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Coze] API 错误:', errorText)
      return {
        success: false,
        message: `Coze API 调用失败: ${response.status}`,
      }
    }

    const result = await response.json()
    console.log('[Coze] 分析完成:', result)

    // Extract analysis result
    const analysisText = result.messages?.[0]?.content || '分析结果为空'

    return {
      success: true,
      message: '分析完成',
      payload: {
        analysis: analysisText,
        timestamp: new Date().toISOString(),
      },
    }
  } catch (error) {
    console.error('[Coze] 服务器错误:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '服务器内部错误',
    }
  }
}
