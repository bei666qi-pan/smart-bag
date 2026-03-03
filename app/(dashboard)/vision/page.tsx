// app/(dashboard)/vision/page.tsx
import { VisionSection } from "@/components/dashboard/vision-section"

export const metadata = {
  title: "视觉中心 - 智能书包 V5.0",
  description: "实时视频流与 AI 物体检测",
}

export default function VisionPage() {
  return <VisionSection />
}
