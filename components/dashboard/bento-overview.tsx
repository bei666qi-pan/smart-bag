"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  Eye,
  MapPin,
  MessageCircle,
  Thermometer,
  Droplets,
  Wifi,
  WifiOff,
  Backpack,
  Activity,
  Radio,
  CheckCircle2,
  AlertCircle,
  MicOff,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DiagnosticsCard } from "@/components/dashboard/diagnostics-card"
import { useIoTStore } from "@/store/useIoTStore"
import { apiFetch } from "@/lib/api-fetch"

const visionSeverityLabel: Record<"low" | "medium" | "high", string> = {
  low: "正常",
  medium: "注意",
  high: "警告",
}

// 异常可见性：哨兵值(9999)/物理越界统一翻译成"故障"，而不是把 9999°C 当真实读数显示。
// null（从未上报）显示"—"。danger=true 时上层用红色呈现。
type MetricView = { text: string; danger: boolean }

function viewTemp(value: number | null): MetricView {
  if (typeof value !== "number") return { text: "—", danger: false }
  if (value >= 9000 || value < -40 || value > 85) return { text: "故障", danger: true }
  return { text: `${value}°C`, danger: false }
}

function viewHumid(value: number | null): MetricView {
  if (typeof value !== "number") return { text: "—", danger: false }
  if (value >= 9000 || value < 0 || value > 100) return { text: "故障", danger: true }
  return { text: `${value}%`, danger: false }
}

function formatCoords(coords: [number, number] | null) {
  if (!coords) return "暂无数据"
  return `${coords[1].toFixed(6)}°N, ${coords[0].toFixed(6)}°E`
}

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return "—"

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp

  return date.toLocaleString("zh-CN")
}

export function BentoOverview() {
  const mqttConnectionStatus = useIoTStore((state) => state.mqttConnectionStatus)
  const deviceOnline = useIoTStore((state) => state.deviceOnline)
  const iotApiFetchStatus = useIoTStore((state) => state.iotApiFetchStatus)
  const temp = useIoTStore((state) => state.temp)
  const humid = useIoTStore((state) => state.humid)
  const gpsCoords = useIoTStore((state) => state.gpsCoords)
  const lastSeenAt = useIoTStore((state) => state.lastSeenAt)
  const pendingCmd = useIoTStore((state) => state.pendingCmd)
  const lastCmdAck = useIoTStore((state) => state.lastCmdAck)
  const lastVisionResult = useIoTStore((state) => state.lastVisionResult)
  const micHealth = useIoTStore((state) => state.micHealth)

  const tempView = viewTemp(temp)
  const humidView = viewHumid(humid)
  const micFault = micHealth?.status === "need_physical_replug"
  const realtimeDown = mqttConnectionStatus !== "connected"

  const [snapshot, setSnapshot] = useState<{
    hasSnapshot: boolean
    lastSnapshotAt: string | null
  }>({ hasSnapshot: false, lastSnapshotAt: null })

  // Poll the read-only camera status so the dashboard reflects whether a WAN
  // snapshot exists, instead of always showing "进入视觉页查看".
  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const res = await apiFetch("/api/camera/status", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (active) {
          setSnapshot({
            hasSnapshot: Boolean(data?.hasSnapshot),
            lastSnapshotAt:
              typeof data?.lastSnapshotAt === "string" ? data.lastSnapshotAt : null,
          })
        }
      } catch {
        // best-effort; dashboard stays usable without snapshot status
      }
    }

    load()
    const timer = window.setInterval(load, 10000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const mqttLabel: Record<typeof mqttConnectionStatus, string> = {
    connected: "已连接",
    connecting: "连接中",
    disconnected: "未连接",
    error: "异常",
  }

  const ackLabel = lastCmdAck
    ? `${lastCmdAck.status === 0 ? "成功" : "失败"} ${lastCmdAck.cmd_id}`
    : "暂无 ACK"

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
          智能书包 V5.0
        </h1>
        <p className="text-sm text-muted-foreground">
          数字孪生仪表盘，当前只展示已接入的实时状态与真实空态。
        </p>
      </div>

      {/* 就近告警：麦克风故障需有人到书包旁拔插，仪表盘端给出明确的现场处理指引 */}
      {micFault ? (
        <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <MicOff className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">麦克风故障，语音助手暂时听不见</span>
            <span className="text-xs">
              这类故障软件无法自动恢复，需到书包旁拔下 USB 麦克风再插上。书包本体此时也会红字+红灯提示。
            </span>
          </div>
        </div>
      ) : null}

      {/* 降级可见性：实时连接中断时明确告知，避免用户把"停更的旧数据"误当成最新状态 */}
      {realtimeDown ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">
              实时连接{mqttConnectionStatus === "connecting" ? "建立中" : "已中断"}
            </span>
            <span className="text-xs">
              下方温湿度、位置等实时数据可能不是最新，恢复连接后会自动更新。
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 pt-6">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                mqttConnectionStatus === "connected"
                  ? "bg-emerald-50"
                  : mqttConnectionStatus === "connecting"
                    ? "bg-amber-50"
                    : mqttConnectionStatus === "error"
                      ? "bg-rose-50"
                      : "bg-gray-50"
              }`}
            >
              <Wifi
                className={`h-5 w-5 ${
                  mqttConnectionStatus === "connected"
                    ? "text-emerald-600"
                    : mqttConnectionStatus === "connecting"
                      ? "text-amber-600"
                      : mqttConnectionStatus === "error"
                        ? "text-rose-600"
                        : "text-gray-600"
                }`}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">MQTT Broker</span>
              <span className="text-sm font-semibold text-foreground">
                {mqttLabel[mqttConnectionStatus]}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 pt-6">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                deviceOnline ? "bg-sky-50" : "bg-gray-50"
              }`}
            >
              <Backpack
                className={`h-5 w-5 ${deviceOnline ? "text-sky-600" : "text-gray-600"}`}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">设备</span>
              <span className="text-sm font-semibold text-foreground">
                {deviceOnline ? "在线" : "离线"}
              </span>
              <span className="mt-0.5 text-[10px] text-muted-foreground">
                来自 v5/bag/status
              </span>
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
              <span
                className={`text-sm font-semibold ${
                  tempView.danger ? "text-rose-600" : "text-foreground"
                }`}
              >
                {tempView.text}
              </span>
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
              <span
                className={`text-sm font-semibold ${
                  humidView.danger ? "text-rose-600" : "text-foreground"
                }`}
              >
                {humidView.text}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary" className="text-[10px]">
          API 初始化：{iotApiFetchStatus}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          最近上报：{formatTimestamp(lastSeenAt)}
        </Badge>
        <span className="text-[10px]">提示：Broker 已连接 ≠ 设备在线</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Link href="/vision" className="group lg:row-span-2">
          <Card className="h-full cursor-pointer border-border bg-card transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-foreground">
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  视觉
                </span>
                <Badge
                  variant={lastVisionResult ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  {lastVisionResult
                    ? visionSeverityLabel[lastVisionResult.severity]
                    : "按需分析"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
                  <Eye className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">最近识别场景</span>
                    <span className="max-w-[60%] truncate font-medium text-foreground">
                      {lastVisionResult ? lastVisionResult.scene : "暂无数据"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">AI 结论</span>
                    <span className="max-w-[60%] truncate font-medium text-foreground">
                      {lastVisionResult ? lastVisionResult.screen_text : "进入视觉页触发分析"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">最近快照</span>
                    <span className="max-w-[60%] truncate font-mono text-foreground">
                      {snapshot.hasSnapshot
                        ? formatTimestamp(snapshot.lastSnapshotAt)
                        : "暂无快照"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/location" className="group">
          <Card className="h-full cursor-pointer border-border bg-card transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-foreground">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  位置
                </span>
                <Badge variant={gpsCoords ? "secondary" : "outline"} className="text-[10px]">
                  {gpsCoords ? "已接入" : "暂无数据"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">当前坐标</span>
                  <span className="max-w-[65%] truncate font-mono text-foreground">
                    {formatCoords(gpsCoords)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">最后上报</span>
                  <span className="max-w-[65%] truncate font-mono text-foreground">
                    {formatTimestamp(lastSeenAt)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/interaction" className="group">
          <Card className="h-full cursor-pointer border-border bg-card transition-shadow hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-foreground">
                <span className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  交互
                </span>
                <Badge
                  variant={pendingCmd ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  {pendingCmd ? "等待 ACK" : "无待确认命令"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">待确认命令</span>
                  <span className="max-w-[65%] truncate font-medium text-foreground">
                    {pendingCmd ? `${pendingCmd.type}: ${pendingCmd.value}` : "暂无"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">最近 ACK</span>
                  <span className="max-w-[65%] truncate font-mono text-foreground">
                    {ackLabel}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="border-border bg-card lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Backpack className="h-4 w-4" />
              物品识别
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastVisionResult ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {lastVisionResult.objects.length > 0 ? (
                    lastVisionResult.objects.map((item, index) => (
                      <Badge
                        key={`${item}-${index}`}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {item}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">未识别到明确物品</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    场景：
                    <span className="text-foreground">{lastVisionResult.scene}</span>
                  </span>
                  <span>
                    置信度：
                    <span className="text-foreground">
                      {(lastVisionResult.confidence * 100).toFixed(0)}%
                    </span>
                  </span>
                  <span>
                    更新：
                    <span className="text-foreground">
                      {formatTimestamp(lastVisionResult.timestamp)}
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                尚未有视觉识别结果。进入视觉页触发一次 bag-image 分析后，这里会显示最近识别到的物品与场景。
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 pt-6">
            <Radio className="h-4 w-4 text-emerald-500" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">GPS</span>
              <span className="text-sm font-semibold text-foreground">
                {gpsCoords ? "已接收坐标" : "暂无数据"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 pt-6">
            {lastCmdAck?.status === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : lastCmdAck ? (
              <AlertCircle className="h-4 w-4 text-rose-500" />
            ) : (
              <Activity className="h-4 w-4 text-muted-foreground" />
            )}
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">命令回执</span>
              <span className="text-sm font-semibold text-foreground">{ackLabel}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 pt-6">
            <Activity className="h-4 w-4 text-blue-500" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">API 初始状态</span>
              <span className="text-sm font-semibold text-foreground">{iotApiFetchStatus}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <DiagnosticsCard />
    </div>
  )
}
