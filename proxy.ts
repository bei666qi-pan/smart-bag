import { NextRequest, NextResponse } from 'next/server'

const SESSION_COOKIE = 'sb_session'

/**
 * 页面级守卫（Next 16 的 proxy.ts，即原 middleware）：
 * 未携带会话 cookie 直接跳登录页；真正的会话有效性校验在
 * 服务端 layout / API 路由里查 Redis 完成，这里只做轻量拦截。
 *
 * 注意 matcher 不拦 /api（API 路由自行返回 401，且 ESP32 上传不带 cookie）。
 */
export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  const isLoginPage = request.nextUrl.pathname === '/login'

  if (!hasSession && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (hasSession && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // 排除 API、静态资源、图标等；只保护页面路由
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg|.*\\..*).*)'],
}
