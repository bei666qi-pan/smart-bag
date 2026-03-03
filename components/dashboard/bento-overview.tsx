// components/dashboard/bento-overview.tsx
"use client"

import Link from "next/link"
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
import { useIoTStore } from "@/store/useIoTStore"

export function BentoOverview() {
  const { lwtStatus, battery, temp, humid } = useIoTStore()
  const isOnline = lwtStatus === 'online'

  return (
    <>
      {/* <!-- SECTION:BENTO_OVERVIEW --> */}
      <div className="flex flex-col gap-6">
        {/* Welcome */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
            智能书包 V5.0
          </h1>
          <p className="text-sm text-muted-foreground">
            数字孪生仪表盘 - 实时监测和智能分析
          </p>
        </div>

        {/* Status Cards Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isOnline ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                <Wifi className={`h-5 w-5 ${isOnline ? 'text-emerald-600' : 'text-gray-600'}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">连接</span>
                <span className="text-sm font-semibold text-foreground">{isOnline ? '在线' : '离线'}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <BatteryMedium className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">电池</span>
                <span className="text-sm font-semibold text-foreground">{battery}%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50">
                <Thermometer className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">温度</span>
                <span className="text-sm font-semibold text-foreground">{temp}°C</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50">
                <Droplets className="h-5 w-5 text-sky-600" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">湿度</span>
                <span className="text-sm font-semibold text-foreground">{humid}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bento Grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Vision Card */}
          <Link href="/vision" className="group lg:row-span-2">
            <Card className="h-full cursor-pointer border-border bg-card transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm font-medium text-foreground">
                  <span className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    视觉
                  </span>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                    活跃
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <div className="aspect-video w-full rounded-lg bg-muted flex items-center justify-center">
                    <Eye className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">流</span>
                      <span className="font-medium text-foreground">局域网模式</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">人工智能检测</span>
                      <span className="font-medium text-foreground">3 个物品</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">延迟</span>
                      <span className="font-mono text-foreground">23ms</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Location Card */}
          <Link href="/location" className="group">
            <Card className="h-full cursor-pointer border-border bg-card transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm font-medium text-foreground">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    位置
                  </span>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                    安全区
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">当前</span>
                    <span className="font-medium text-foreground">教室 3-B</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">速度</span>
                    <span className="font-mono text-foreground">0 km/h</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Interaction Card */}
          <Link href="/interaction" className="group">
            <Card className="h-full cursor-pointer border-border bg-card transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm font-medium text-foreground">
                  <span className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    交互
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    2 条新消息
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">最新</span>
                    <span className="font-medium text-foreground truncate ml-2">好的,收到!</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">专注计时</span>
                    <span className="font-mono text-foreground">25:00</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Bag Contents Card */}
          <Card className="border-border bg-card lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Backpack className="h-4 w-4" />
                书包内容
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { name: "数学教科书", icon: BookOpen, status: "ok" },
                  { name: "英文书", icon: BookOpen, status: "ok" },
                  { name: "笔记本", icon: BookOpen, status: "ok" },
                  { name: "水瓶", icon: Droplets, status: "ok" },
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
                <span className="text-xs text-muted-foreground">内存</span>
                <span className="font-mono text-sm font-semibold text-foreground">256MB</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="flex items-center gap-3 pt-6">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">安全</span>
                <span className="text-sm font-semibold text-foreground">正常</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* <!-- /SECTION:BENTO_OVERVIEW --> */}
    </>
  )
}
