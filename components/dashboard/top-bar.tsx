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

const mqttBadgeStyles = {
  connected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  connecting: "bg-amber-50 text-amber-700 border-amber-200",
  disconnected: "bg-gray-50 text-gray-700 border-gray-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
} as const

const mqttBadgeLabel = {
  connected: "MQTT 在线",
  connecting: "MQTT 连接中",
  disconnected: "MQTT 离线",
  error: "MQTT 异常",
} as const

export function TopBar() {
  const pathname = usePathname()
  const mqttConnectionStatus = useIoTStore((state) => state.mqttConnectionStatus)
  const deviceOnline = useIoTStore((state) => state.deviceOnline)
  const battery = useIoTStore((state) => state.battery)
  const temp = useIoTStore((state) => state.temp)
  const humid = useIoTStore((state) => state.humid)

  const currentLabel = viewLabels[pathname] || "仪表盘"
  const mqttOnline = mqttConnectionStatus === "connected"

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
        <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
          <span className="text-muted-foreground">仪表盘</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">{currentLabel}</span>
        </nav>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              {mqttOnline && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  mqttOnline ? "bg-emerald-500" : mqttConnectionStatus === "error" ? "bg-rose-500" : "bg-gray-400"
                }`}
              />
            </span>
            <Badge
              variant="secondary"
              className={`${mqttBadgeStyles[mqttConnectionStatus]} text-xs font-medium`}
            >
              {mqttBadgeLabel[mqttConnectionStatus]}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${
                deviceOnline ? "bg-sky-500" : "bg-gray-400"
              }`}
            />
            <Badge
              variant="secondary"
              className={`${
                deviceOnline
                  ? "bg-sky-50 text-sky-700 border-sky-200"
                  : "bg-gray-50 text-gray-700 border-gray-200"
              } text-xs font-medium`}
            >
              设备 {deviceOnline ? "在线" : "离线"}
            </Badge>
          </div>

          <Separator orientation="vertical" className="h-5" />

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Signal className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs">GPS 信号</span>
          </div>

          <Separator orientation="vertical" className="h-5" />

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Thermometer className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs">{temp}°C</span>
          </div>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Droplets className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs">{humid}%</span>
          </div>

          <Separator orientation="vertical" className="h-5" />

          <div className="flex items-center gap-1.5 text-sm">
            <BatteryMedium className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs text-muted-foreground">电量 {battery}%</span>
          </div>
        </div>
      </header>
    </>
  )
}
