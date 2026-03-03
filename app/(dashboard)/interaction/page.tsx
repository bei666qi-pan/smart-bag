// app/(dashboard)/interaction/page.tsx
import { InteractionSection } from "@/components/dashboard/interaction-section"

export const metadata = {
  title: "互动中心 - 智能书包 V5.0",
  description: "聊天消息与专注计时器",
}

export default function InteractionPage() {
  return <InteractionSection />
}
