import { NextRequest, NextResponse } from 'next/server'
import { destroySession, SESSION_COOKIE } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (token) {
    try {
      await destroySession(token)
    } catch (error) {
      console.error('[Auth] 注销会话清理失败:', error)
    }
  }
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}
