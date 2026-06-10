// app/(dashboard)/layout.tsx
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 服务端校验会话（middleware 只查 cookie 是否存在，这里查 Redis 确认有效）
  const user = await getSessionUser()
  if (!user) {
    redirect("/login")
  }

  return <DashboardShell username={user.username}>{children}</DashboardShell>
}
