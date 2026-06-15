import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// 页面级守卫：受保护页面若没有会话 cookie，直接重定向到 /login（带 next 回跳）。
// 只查 cookie 是否存在（Edge 运行时不连 Redis）；会话是否有效由 app/(dashboard)/layout.tsx
// 的 getSessionUser 在服务端二次校验。cookie 名与 lib/auth.ts 的 SESSION_COOKIE 保持一致。
const SESSION_COOKIE = "sb_session"

export function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (token) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = "/login"
  url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search)
  return NextResponse.redirect(url)
}

// 排除 /login、/api、Next 静态资源与带后缀的静态文件；其余（仪表盘各页）都需登录。
export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
}
