import { NextRequest, NextResponse } from 'next/server'
import { createSession, SESSION_COOKIE, verifyUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const username = String(body?.username ?? '').trim()
    const password = String(body?.password ?? '')

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: '请输入用户名和密码' },
        { status: 400 },
      )
    }

    const verified = await verifyUser(username, password)
    if (!verified) {
      return NextResponse.json(
        { success: false, message: '用户名或密码错误' },
        { status: 401 },
      )
    }

    const { token, maxAge } = await createSession(verified)
    const response = NextResponse.json({ success: true, username: verified })
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    })
    return response
  } catch (error) {
    console.error('[Auth] 登录失败:', error)
    return NextResponse.json(
      { success: false, message: '登录失败：服务暂不可用，请稍后重试' },
      { status: 500 },
    )
  }
}
