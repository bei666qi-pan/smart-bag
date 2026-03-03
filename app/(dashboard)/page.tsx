// app/(dashboard)/page.tsx
import { BentoOverview } from "@/components/dashboard/bento-overview"

export const metadata = {
  title: "仪表盘 - 智能书包 V5.0",
  description: "智能书包数字孪生仪表盘概览",
}

export default function DashboardPage() {
  return <BentoOverview />
}
