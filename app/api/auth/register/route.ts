import { NextRequest, NextResponse } from 'next/server'
import {
  createSession,
  createUser,
  SESSION_COOKIE,
  validateCredentialsFormat,
} from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const username = String(body?.username ?? '').trim()
    const password = String(body?.password ?? '')

    const formatError = validateCredentialsFormat(username, password)
    if (formatError) {
      return NextResponse.json({ success: false, message: formatError }, { status: 400 })
    }

    const result = await createUser(username, password)
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: 409 })
    }

    const { token, maxAge } = await createSession(username)
    const response = NextResponse.json({ success: true, username })
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    })
    return response
  } catch (error) {
    console.error('[Auth] 注册失败:', error)
    return NextResponse.json(
      { success: false, message: '注册失败：服务暂不可用，请稍后重试' },
      { status: 500 },
    )
  }
}
