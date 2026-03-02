"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Eye,
  MapPin,
  MessageCircle,
  BatteryMedium,
  Thermometer,
  Droplets,
  Wifi,
  Backpack,
  BookOpen,
  ShieldCheck,
  Activity,
} from "lucide-react"

interface BentoOverviewProps {
  onNavigate: (view: string) => void
}

export function BentoOverview({ onNavigate }: BentoOverviewProps) {
  return (
    <>
      {/* <!-- SECTION:BENTO_OVERVIEW --> */}
      <div className="flex flex-col gap-6">
        {/* Welcome */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
            Smart Schoolbag V5.0
          </h1>
          <p className="text-sm text-muted-foreground">
            Digital Twin Dashboard - Real-time monitoring and intelligent analysis
          </p>
        </div>

        {/* Status Cards Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
                <Wifi className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Connection</span>
                <span className="text-sm font-semibold text-foreground">Online</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <BatteryMedium className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Battery</span>
                <span className="text-sm font-semibold text-foreground">85%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                <Thermometer className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Temperature</span>
                <span className="text-sm font-semibold text-foreground">24°C</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
                <Droplets className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Humidity</span>
                <span className="text-sm font-semibold text-foreground">45%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bento Grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Vision Card */}
          <Card
            className="group cursor-pointer border-border bg-card transition-shadow hover:shadow-md lg:row-span-2"
            onClick={() => onNavigate("vision")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-foreground">
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Vision
                </span>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                  Active
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                {/* Mini video preview placeholder */}
                <div className="aspect-video w-full rounded-lg bg-muted flex items-center justify-center">
                  <Eye className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Stream</span>
                    <span className="font-medium text-foreground">LAN Mode</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">AI Detections</span>
                    <span className="font-medium text-foreground">3 objects</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Latency</span>
                    <span className="font-mono text-foreground">23ms</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Card */}
          <Card
            className="group cursor-pointer border-border bg-card transition-shadow hover:shadow-md"
            onClick={() => onNavigate("location")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-foreground">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Location
                </span>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                  Safe Zone
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Current</span>
                  <span className="font-medium text-foreground">Classroom 3-B</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Speed</span>
                  <span className="font-mono text-foreground">0 km/h</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Interaction Card */}
          <Card
            className="group cursor-pointer border-border bg-card transition-shadow hover:shadow-md"
            onClick={() => onNavigate("interaction")}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-foreground">
                <span className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Interaction
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  2 new
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Latest</span>
                  <span className="font-medium text-foreground truncate ml-2">Ok, got it!</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Focus Timer</span>
                  <span className="font-mono text-foreground">25:00</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bag Contents Card */}
          <Card className="border-border bg-card lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Backpack className="h-4 w-4" />
                Bag Contents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { name: "Math Textbook", icon: BookOpen, status: "ok" },
                  { name: "English Book", icon: BookOpen, status: "ok" },
                  { name: "Notebook", icon: BookOpen, status: "ok" },
                  { name: "Water Bottle", icon: Droplets, status: "ok" },
                ].map((item, i) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2.5"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">{item.name}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Health */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 pt-6">
              <Activity className="h-4 w-4 text-emerald-500" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">CPU</span>
                <span className="font-mono text-sm font-semibold text-foreground">12%</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 pt-6">
              <Activity className="h-4 w-4 text-blue-500" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Memory</span>
                <span className="font-mono text-sm font-semibold text-foreground">256MB</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 pt-6">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Security</span>
                <span className="text-sm font-semibold text-foreground">Normal</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* <!-- /SECTION:BENTO_OVERVIEW --> */}
    </>
  )
}
