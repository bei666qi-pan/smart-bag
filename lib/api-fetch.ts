// 客户端统一 fetch 包装：会话过期(401)时自动跳登录页。
//
// 背景：仪表盘是常驻 SPA，打开期间 Redis 会话可能过期。原先各处 fetch 拿到 401 只是
// 静默失败、瓦片变空，用户误以为"设备离线"而非"我被登出了"。这里集中处理：任意受保护
// API 返回 401 即跳 /login（带 next 回跳），避免停在一个再也刷不出数据的死页面。
//
// 服务端页面仍由 app/(dashboard)/layout.tsx 的 getSessionUser 守卫（硬刷新场景），
// 二者互补：middleware 查 cookie 是否存在、layout 查 Redis 是否有效、本包兜底运行期过期。
let redirecting = false

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status === 401 && typeof window !== "undefined" && !redirecting) {
    redirecting = true
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    window.location.href = `/login?next=${next}`
  }
  return res
}
