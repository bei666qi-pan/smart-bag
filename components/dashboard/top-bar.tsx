// components/dashboard/top-bar.tsx
"use client"

import { usePathname } from "next/navigation"
import {
  Signal,
  Thermometer,
  Droplets,
  BatteryMedium,
  ChevronRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useIoTStore } from "@/store/useIoTStore"

const viewLabels: Record<string, string> = {
  "/": "仪表盘",
  "/vision": "视觉中心",
  "/location": "位置追踪",
  "/interaction": "互动中心",
}

export function TopBar() {
  const pathname = usePathname()
  const { lwtStatus, battery, temp, humid } = useIoTStore()
  
  const isOnline = lwtStatus === 'online'
  const currentLabel = viewLabels[pathname] || "仪表盘"

  return (
    <>
      {/* <!-- SECTION:TOPBAR --> */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
          <span className="text-muted-foreground">仪表盘</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">
            {currentLabel}
          </span>
        </nav>

        {/* IoT Sensors Status */}
        <div className="flex items-center gap-4">
          {/* MQTT Status */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {isOnline && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            </span>
            <Badge
              variant="secondary"
              className={`${
                isOnline 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-gray-50 text-gray-700 border-gray-200'
              } text-xs font-medium`}
            >
              MQTT {isOnline ? '在线' : '离线'}
            </Badge>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* GPS Signal */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Signal className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs">GPS 信号</span>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Temperature */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Thermometer className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs">{temp}°C</span>
          </div>

          {/* Humidity */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Droplets className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs">{humid}%</span>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Battery */}
          <div className="flex items-center gap-1.5 text-sm">
            <BatteryMedium className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs text-muted-foreground">电量 {battery}%</span>
          </div>
        </div>
      </header>
      {/* <!-- /SECTION:TOPBAR --> */}
    </>
  )
}
