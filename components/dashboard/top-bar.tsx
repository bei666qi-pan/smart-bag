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
  "/": "\u4eea\u8868\u76d8",
  "/vision": "\u89c6\u89c9\u4e2d\u5fc3",
  "/location": "\u4f4d\u7f6e\u8ffd\u8e2a",
  "/interaction": "\u4e92\u52a8\u4e2d\u5fc3",
}

const mqttBadgeStyles = {
  connected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  connecting: "bg-amber-50 text-amber-700 border-amber-200",
  disconnected: "bg-gray-50 text-gray-700 border-gray-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
} as const

const mqttBadgeLabel = {
  connected: "MQTT \u5728\u7ebf",
  connecting: "MQTT \u8fde\u63a5\u4e2d",
  disconnected: "MQTT \u79bb\u7ebf",
  error: "MQTT \u5f02\u5e38",
} as const

export function TopBar() {
  const pathname = usePathname()
  const mqttConnectionStatus = useIoTStore((state) => state.mqttConnectionStatus)
  const deviceOnline = useIoTStore((state) => state.deviceOnline)
  const iotApiFetchStatus = useIoTStore((state) => state.iotApiFetchStatus)
  const battery = useIoTStore((state) => state.battery)
  const temp = useIoTStore((state) => state.temp)
  const humid = useIoTStore((state) => state.humid)

  const currentLabel = viewLabels[pathname] || "\u4eea\u8868\u76d8"
  const mqttOnline = mqttConnectionStatus === "connected"
  const apiBadge =
    iotApiFetchStatus === "success"
      ? { label: "API 正常", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
      : iotApiFetchStatus === "loading"
        ? { label: "API 拉取中", className: "bg-amber-50 text-amber-700 border-amber-200" }
        : iotApiFetchStatus === "error"
          ? { label: "API 异常", className: "bg-rose-50 text-rose-700 border-rose-200" }
          : { label: "API 未拉取", className: "bg-gray-50 text-gray-700 border-gray-200" }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
        <span className="text-muted-foreground">{"\u4eea\u8868\u76d8"}</span>
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
            {"\u8bbe\u5907 "}
            {deviceOnline ? "\u5728\u7ebf" : "\u79bb\u7ebf"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${
              iotApiFetchStatus === "success"
                ? "bg-emerald-500"
                : iotApiFetchStatus === "loading"
                  ? "bg-amber-500"
                  : iotApiFetchStatus === "error"
                    ? "bg-rose-500"
                    : "bg-gray-400"
            }`}
          />
          <Badge variant="secondary" className={`${apiBadge.className} text-xs font-medium`}>
            {apiBadge.label}
          </Badge>
        </div>

        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Signal className="h-4 w-4 text-foreground" />
          <span className="font-mono text-xs">{"GPS \u4fe1\u53f7"}</span>
        </div>

        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Thermometer className="h-4 w-4 text-foreground" />
          <span className="font-mono text-xs">{typeof temp === 'number' ? `${temp}C` : '—'}</span>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Droplets className="h-4 w-4 text-foreground" />
          <span className="font-mono text-xs">{typeof humid === 'number' ? `${humid}%` : '—'}</span>
        </div>

        <Separator orientation="vertical" className="h-5" />

        <div className="flex items-center gap-1.5 text-sm">
          <BatteryMedium className="h-4 w-4 text-foreground" />
          <span className="font-mono text-xs text-muted-foreground">
            {"\u7535\u91cf "}
            {typeof battery === 'number' ? `${battery}%` : '—'}
          </span>
        </div>
      </div>
    </header>
  )
}
