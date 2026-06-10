import { NextRequest, NextResponse } from 'next/server'
import {
  clearUserNewapiConfig,
  getSessionUser,
  getUserNewapiConfig,
  setUserNewapiConfig,
} from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function maskKey(key: string) {
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

// GET: 查询当前用户的 AI 激活状态（key 只回掩码，绝不回明文）
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  const config = await getUserNewapiConfig(user.username)
  const hasServerFallback = Boolean(
    process.env.NEWAPI_BASE_URL && process.env.NEWAPI_API_KEY,
  )

  return NextResponse.json({
    success: true,
    activated: Boolean(config),
    maskedKey: config ? maskKey(config.apiKey) : null,
    baseUrl: config?.baseUrl ?? null,
    hasServerFallback,
  })
}

// POST: 保存用户自己的 NewAPI key（激活 AI 功能）
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const apiKey = String(body?.apiKey ?? '').trim()
    const baseUrl = String(body?.baseUrl ?? '').trim()

    if (apiKey.length < 8 || apiKey.length > 256) {
      return NextResponse.json(
        { success: false, message: 'API key 格式不正确' },
        { status: 400 },
      )
    }
    if (baseUrl) {
      try {
        const parsed = new URL(baseUrl)
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
      } catch {
        return NextResponse.json(
          { success: false, message: '接口地址需为合法的 http(s) URL' },
          { status: 400 },
        )
      }
    }

    await setUserNewapiConfig(user.username, {
      apiKey,
      baseUrl: baseUrl || undefined,
    })

    return NextResponse.json({ success: true, maskedKey: maskKey(apiKey) })
  } catch (error) {
    console.error('[Settings] 保存 NewAPI 配置失败:', error)
    return NextResponse.json(
      { success: false, message: '保存失败，请稍后重试' },
      { status: 500 },
    )
  }
}

// DELETE: 清除用户 key（回退到服务端环境变量配置，若有）
export async function DELETE() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }
  await clearUserNewapiConfig(user.username)
  return NextResponse.json({ success: true })
}
