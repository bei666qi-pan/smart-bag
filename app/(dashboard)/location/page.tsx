// app/(dashboard)/location/page.tsx
"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

const LocationSection = dynamic(
  () => import("@/components/dashboard/location-section").then((mod) => ({ default: mod.LocationSection })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">加载地图组件中...</p>
        </div>
      </div>
    ),
  }
)

export default function LocationPage() {
  return <LocationSection />
}
