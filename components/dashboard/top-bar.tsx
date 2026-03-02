"use client"

import {
  Signal,
  Thermometer,
  Droplets,
  BatteryMedium,
  ChevronRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const viewLabels: Record<string, string> = {
  dashboard: "Overview",
  vision: "Vision",
  location: "Location",
  interaction: "Interaction",
}

interface TopBarProps {
  activeView: string
}

export function TopBar({ activeView }: TopBarProps) {
  return (
    <>
      {/* <!-- SECTION:TOPBAR --> */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
          <span className="text-muted-foreground">Dashboard</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">
            {viewLabels[activeView] || "Overview"}
          </span>
        </nav>

        {/* IoT Sensors Status */}
        <div className="flex items-center gap-4">
          {/* MQTT Status */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <Badge
              variant="secondary"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-medium"
            >
              MQTT Live
            </Badge>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* GPS Signal */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Signal className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs">GPS</span>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Temperature */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Thermometer className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs">24°C</span>
          </div>

          {/* Humidity */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Droplets className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs">45%</span>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Battery */}
          <div className="flex items-center gap-1.5 text-sm">
            <BatteryMedium className="h-4 w-4 text-foreground" />
            <span className="font-mono text-xs text-muted-foreground">85%</span>
          </div>
        </div>
      </header>
      {/* <!-- /SECTION:TOPBAR --> */}
    </>
  )
}
