"use client"

/* eslint-disable @next/next/no-img-element */

import { useActionState, useEffect, useRef, useState } from "react"
import { analyzeImageAction, type ActionState } from "@/app/actions/analyze-image"
import { useIoTStore } from "@/store/useIoTStore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  Eye,
  Info,
  Loader2,
  Send,
  Sparkles,
  Video,
} from "lucide-react"
import { toast } from "sonner"

const initialState: ActionState = {
  success: false,
  message: "",
}

const severityConfig = {
  low: {
    label: "正常",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: CheckCircle,
  },
  medium: {
    label: "注意",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: AlertTriangle,
  },
  high: {
    label: "警告",
    color: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    icon: AlertTriangle,
  },
} as const

export function VisionSection() {
  const [imageUrl, setImageUrl] = useState("")
  const [streamError, setStreamError] = useState<string | null>(null)
  const [frameReady, setFrameReady] = useState(false)
  const [lastFrameAt, setLastFrameAt] = useState<string | null>(null)
  const lastSnapshotRef = useRef<string | null>(null)
  const [state, formAction, isPending] = useActionState(analyzeImageAction, initialState)

  const setLastVisionResult = useIoTStore((s) => s.setLastVisionResult)
  const publishCommand = useIoTStore((s) => s.publishCommand)
  const mqttConnectionStatus = useIoTStore((s) => s.mqttConnectionStatus)
  const deviceOnline = useIoTStore((s) => s.deviceOnline)
  const pendingCmd = useIoTStore((s) => s.pendingCmd)

  const streamUrl = imageUrl
  const canAnalyze = Boolean(streamUrl) && frameReady && !streamError

  // 广域网快照：轮询轻量的 /api/camera/status 探测是否有新帧；
  // 仅当 lastSnapshotAt 真的变化时才更新图片 URL（设备约 30s 上传一次）。
  // 这样避免每 3s 无谓重拉 /api/camera/latest 导致的明显闪烁/刷新感。
  useEffect(() => {
    let active = true

    const poll = async () => {
      try {
        const res = await fetch("/api/camera/status", { cache: "no-store" })
        if (!res.ok || !active) return
        const data = await res.json()
        if (!active) return
        if (data?.hasSnapshot && typeof data.lastSnapshotAt === "string") {
          if (lastSnapshotRef.current !== data.lastSnapshotAt) {
            lastSnapshotRef.current = data.lastSnapshotAt
            // 用快照时间戳做 cache-buster：仅在有新帧时换 src，浏览器会保留旧图直到新图加载完，平滑无闪
            setImageUrl(`/api/camera/latest?t=${encodeURIComponent(data.lastSnapshotAt)}`)
          }
        }
      } catch {
        // best-effort：拿不到状态就保持当前画面
      }
    }

    poll()
    const pollInterval = setInterval(poll, 3000)

    return () => {
      active = false
      clearInterval(pollInterval)
    }
  }, [])

  useEffect(() => {
    if (state.success && state.payload) {
      const p = state.payload
      // Share the latest result globally so the dashboard can reflect it.
      setLastVisionResult({
        objects: p.structured.objects,
        scene: p.structured.scene,
        risks: p.structured.risks,
        confidence: p.structured.confidence,
        analysis: p.analysis,
        suggestion: p.suggestion,
        screen_text: p.screen_text,
        severity: p.severity,
        timestamp: p.timestamp,
      })
      toast.success("AI 分析完成", {
        description: p.analysis.slice(0, 100),
      })
      return
    }

    if (!state.success && state.message) {
      toast.error("分析失败", {
        description: state.message,
      })
    }
  }, [state, setLastVisionResult])

  const blockedReason = (() => {
    if (streamError) return streamError
    if (!streamUrl) {
      return "暂未获取到快照，请确认设备已上传到 /api/camera/latest。"
    }
    if (!frameReady) {
      return "正在等待最新快照加载完成。"
    }
    return null
  })()

  const previewStatusText = (() => {
    if (canAnalyze) return "真实快照已就绪"
    if (streamError) return "预览异常"
    if (!streamUrl) return "未接入快照"
    return "等待远程快照"
  })()

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      toast.warning("当前无法开始分析", {
        description: blockedReason || "请先准备真实图像输入。",
      })
      return
    }

    try {
      toast.info("正在执行双模型分析", {
        description: "链路为 bag-image 识图，再由 bag-text 生成中文结论。",
      })

      const response = await fetch(`/api/camera/latest?t=${Date.now()}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        throw new Error("未能获取远程快照，请确认摄像头已上传最新图片。")
      }

      const contentType = response.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        const body = await response.json().catch(() => null)
        throw new Error(
          body?.message
            ? `远程快照空态：${body.message}`
            : "远程快照接口当前没有可分析的图片。",
        )
      }

      if (!contentType.startsWith("image/")) {
        throw new Error("远程快照接口没有返回图片内容，无法继续分析。")
      }

      const blob = await response.blob()

      const formData = new FormData()
      formData.append("image", blob, "snapshot.jpg")
      formAction(formData)
    } catch (error) {
      toast.error("图像准备失败", {
        description: error instanceof Error ? error.message : "未知错误",
      })
    }
  }

  const payload = state.success ? state.payload : null
  const severity = payload?.severity as keyof typeof severityConfig | undefined
  const sConfig = severity ? severityConfig[severity] : null
  const SeverityIcon = sConfig?.icon ?? Info

  const screenTextToSend = payload?.screen_text?.trim() ?? ""
  const canSendToDevice =
    mqttConnectionStatus === "connected" &&
    deviceOnline &&
    screenTextToSend.length > 0 &&
    !pendingCmd
  const sendToDeviceHint = !payload
    ? ""
    : pendingCmd
      ? "上一条命令正在等待设备确认。"
      : mqttConnectionStatus !== "connected"
        ? "MQTT 未连接，暂时无法发送。"
        : !deviceOnline
          ? "设备未在线，暂时无法发送。"
          : "将上面的屏幕文案下发到设备屏幕并等待 ACK。"

  const handleSendToDevice = () => {
    if (!screenTextToSend) {
      toast.warning("当前没有可发送的屏幕文字")
      return
    }

    const result = publishCommand("screen_text", screenTextToSend)
    if (!result.ok) {
      toast.error("发送失败", {
        description: result.error || "设备连接暂时不可用",
      })
      return
    }

    toast.success("已发送到设备", { description: screenTextToSend })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-foreground" />
        <h2 className="text-lg font-semibold text-foreground">视觉中心</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Video className="h-4 w-4" />
                实时画面
              </CardTitle>
              <Badge variant="outline">广域网快照</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
              {streamUrl ? (
                <img
                  src={streamUrl}
                  alt="广域网快照预览"
                  className="absolute inset-0 h-full w-full object-cover"
                  onLoad={() => {
                    setStreamError(null)
                    setFrameReady(true)
                    setLastFrameAt(new Date().toISOString())
                  }}
                  onError={() => {
                    setFrameReady(false)
                    setStreamError(
                      "远程快照当前不可用，请确认设备已成功上传最新图片。",
                    )
                  }}
                />
              ) : null}

              {(!streamUrl || !frameReady || streamError) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
                    {streamError ? (
                      <AlertTriangle className="h-8 w-8 text-amber-600" />
                    ) : (
                      <Video className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {streamError ? "当前没有可分析的真实画面" : "等待远程快照"}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {blockedReason ||
                        "只有在真实画面就绪后，AI 分析按钮才会使用最新图像执行分析。"}
                    </p>
                  </div>
                </div>
              )}

              <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className={canAnalyze ? "bg-emerald-50 text-emerald-700" : ""}
                >
                  {canAnalyze ? "真实输入" : "等待输入"}
                </Badge>
                <Badge variant="outline">广域网</Badge>
              </div>

              <div className="absolute bottom-3 right-3 z-10">
                <Badge variant="secondary" className="text-xs">
                  {previewStatusText}
                </Badge>
              </div>

              <div className="absolute bottom-3 left-3 z-10">
                <Button
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={isPending || !canAnalyze}
                  className="gap-2"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      AI 分析
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-2">
                <div className="text-[10px] uppercase tracking-wide">输入来源</div>
                <div className="mt-1 text-foreground">
                  远程快照接口 /api/camera/latest
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-2">
                <div className="text-[10px] uppercase tracking-wide">最近帧时间</div>
                <div className="mt-1 text-foreground">
                  {lastFrameAt
                    ? new Date(lastFrameAt).toLocaleString("zh-CN")
                    : "暂无真实画面"}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-2">
                <div className="text-[10px] uppercase tracking-wide">说明</div>
                <div className="mt-1 text-foreground">
                  面板只展示真实模型返回，不再展示伪造分析日志。
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Brain className="h-4 w-4" />
              AI 分析结果
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 lg:h-72">
              <div className="flex flex-col gap-3 pr-3">
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-2 text-[11px] leading-5 text-muted-foreground">
                  真实链路：图片 → <span className="font-medium text-foreground">bag-image</span> →
                  结构化结果 → <span className="font-medium text-foreground">bag-text</span> →
                  页面中文结论。广域网快照需要设备先用 `x-device-token` 上传到 `/api/camera/latest`，
                  未配置公网快照源时这里只显示空态。
                </div>

                {payload ? (
                  <>
                    <div
                      className={`flex items-center gap-2 rounded-lg border p-2.5 ${sConfig?.border ?? "border-border"} ${sConfig?.bg ?? "bg-muted/50"}`}
                    >
                      <SeverityIcon
                        className={`h-4 w-4 shrink-0 ${sConfig?.color ?? "text-muted-foreground"}`}
                      />
                      <div className="flex flex-1 items-center justify-between gap-3">
                        <span className={`text-sm font-medium ${sConfig?.color ?? ""}`}>
                          {payload.screen_text}
                        </span>
                        <Badge variant="outline" className={sConfig?.color ?? ""}>
                          {sConfig?.label ?? payload.severity}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSendToDevice}
                        disabled={!canSendToDevice}
                        className="gap-2"
                      >
                        <Send className="h-3.5 w-3.5" />
                        发送到设备屏幕
                      </Button>
                      {sendToDeviceHint ? (
                        <p className="text-[10px] leading-4 text-muted-foreground">
                          {sendToDeviceHint}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                        分析结论
                      </p>
                      <p className="text-xs leading-relaxed text-foreground">
                        {payload.analysis}
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                        建议
                      </p>
                      <p className="text-xs leading-relaxed text-foreground">
                        {payload.suggestion}
                      </p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                        <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                          场景
                        </p>
                        <p className="text-xs text-foreground">{payload.structured.scene}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                        <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                          置信度
                        </p>
                        <p className="text-xs text-foreground">
                          {(payload.structured.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                        识别物品
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {payload.structured.objects.length > 0 ? (
                          payload.structured.objects.map((item, index) => (
                            <Badge key={`${item}-${index}`} variant="secondary" className="text-[10px]">
                              {item}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">未识别到明确物品</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                        风险提示
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {payload.structured.risks.map((risk, index) => (
                          <Badge key={`${risk}-${index}`} variant="outline" className="text-[10px]">
                            {risk}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                        原始摘要
                      </p>
                      <p className="text-xs leading-relaxed text-foreground">
                        {payload.structured.raw_summary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        模型别名：{payload.models.vision} / {payload.models.text}
                      </span>
                      <span>{new Date(payload.timestamp).toLocaleString("zh-CN")}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">暂无真实分析结果</p>
                    <p className="text-xs leading-5 text-muted-foreground/80">
                      {blockedReason
                        ? `当前未开始分析：${blockedReason}`
                        : "点击左侧 AI 分析按钮后，这里只会显示真实模型结果。"}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
