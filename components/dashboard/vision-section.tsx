// components/dashboard/vision-section.tsx
"use client"

import { useState, useEffect, useActionState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Eye, Video, Brain, Clock, Sparkles, Loader2 } from "lucide-react"
import { analyzeImageAction, ActionState } from "@/app/actions/analyze-image"
import { toast } from "sonner"

const aiLogs = [
  { time: "14:32:05", message: "示例：检测到教科书（数学）", type: "info" as const },
  { time: "14:32:03", message: "示例：物体跟踪结果已生成", type: "info" as const },
  { time: "14:31:58", message: "示例：姿态分析（演示数据）", type: "success" as const },
  { time: "14:31:45", message: "示例：光线条件评估（演示数据）", type: "info" as const },
]

const initialState: ActionState = {
  success: false,
  message: '',
}

export function VisionSection() {
  const [isWan, setIsWan] = useState(false)
  const [imageUrl, setImageUrl] = useState<string>('')
  const [streamError, setStreamError] = useState<string | null>(null)
  const [state, formAction, isPending] = useActionState(analyzeImageAction, initialState)

  const isProd = process.env.NODE_ENV === 'production'
  const configuredStreamUrl = process.env.NEXT_PUBLIC_ESP32_STREAM_URL
  const devFallbackLanUrl = 'http://192.168.1.100:81/stream'
  const rawLanStreamUrl = configuredStreamUrl || (isProd ? '' : devFallbackLanUrl)

  const [streamWarning, setStreamWarning] = useState<string | null>(null)

  function isPrivateHostname(hostname: string) {
    const host = hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1') return true
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
    const m = host.match(/^172\.(\d{1,2})\.\d{1,3}\.\d{1,3}$/)
    if (m) {
      const second = Number(m[1])
      if (second >= 16 && second <= 31) return true
    }
    return false
  }

  function validateStreamUrl(url: string) {
    if (!url) return { ok: false, reason: '未配置视频流地址' }
    try {
      const parsed = new URL(url)
      const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:'
      if (isHttpsPage && parsed.protocol === 'http:') {
        return { ok: false, reason: '当前页面为 HTTPS，HTTP 视频流会触发混合内容拦截，请使用 HTTPS 或走广域网快照模式' }
      }
      if (isProd && isPrivateHostname(parsed.hostname)) {
        return { ok: false, reason: '生产环境不建议使用局域网地址作为视频流，请配置公网可达地址或使用广域网快照模式' }
      }
      return { ok: true as const }
    } catch {
      return { ok: false, reason: '视频流地址格式无效' }
    }
  }

  const validation = validateStreamUrl(rawLanStreamUrl)
  const lanStreamUrl = validation.ok ? rawLanStreamUrl : ''

  useEffect(() => {
    if (!isWan && !validation.ok) {
      setStreamWarning(validation.reason)
    } else {
      setStreamWarning(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWan, rawLanStreamUrl, isProd])

  // WAN Mode: Poll for latest snapshot
  useEffect(() => {
    if (!isWan) return

    const pollInterval = setInterval(() => {
      setImageUrl(`/api/camera/latest?t=${Date.now()}`)
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(pollInterval)
  }, [isWan])

  // Handle AI analysis result
  useEffect(() => {
    if (state.success && state.payload) {
      toast.success('AI 分析完成', {
        description: state.payload.analysis.slice(0, 100),
      })
    } else if (!state.success && state.message) {
      toast.error('分析失败', {
        description: state.message,
      })
    }
  }, [state])

  // Capture and analyze current frame
  const handleAnalyze = async () => {
    try {
      toast.info('正在调用大模型分析...', {
        description: '请稍候',
      })

      let blob: Blob

      if (isWan) {
        // Fetch from API
        const response = await fetch(`/api/camera/latest?t=${Date.now()}`)
        if (!response.ok) throw new Error('获取快照失败')
        blob = await response.blob()
      } else {
        // Fetch from ESP32 direct stream
        if (!lanStreamUrl) throw new Error('当前未配置局域网视频流地址')
        const response = await fetch(lanStreamUrl)
        if (!response.ok) throw new Error('获取 ESP32 流失败')
        blob = await response.blob()
      }

      const formData = new FormData()
      formData.append('image', blob, 'snapshot.jpg')
      formAction(formData)
    } catch (error) {
      toast.error('获取图像失败', {
        description: error instanceof Error ? error.message : '未知错误',
      })
    }
  }

  const streamUrl = isWan ? imageUrl : lanStreamUrl

  return (
    <>
      {/* <!-- SECTION:VISION --> */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold text-foreground">视觉中心</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Video Feed */}
          <Card className="lg:col-span-2 border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Video className="h-4 w-4" />
                  实时流
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Label htmlFor="stream-mode" className="text-xs text-muted-foreground">
                    {isWan ? "广域网" : "局域网"}
                  </Label>
                  <Switch
                    id="stream-mode"
                    checked={isWan}
                    onCheckedChange={(v) => {
                      setStreamError(null)
                      setIsWan(v)
                    }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                {/* Video Stream */}
                {!isWan ? (
                  // LAN Mode: Direct ESP32 MJPEG Stream
                  streamUrl ? (
                    <img
                      src={streamUrl}
                      alt="ESP32 实时流"
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={() => {
                        if (!streamError) {
                          console.error('[Vision] ESP32 流加载失败')
                          setStreamError('局域网视频流加载失败，请检查网络与地址配置')
                        }
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                      <p className="text-sm font-medium text-foreground">未配置视频流地址</p>
                      <p className="text-xs text-muted-foreground">
                        开发环境可使用局域网地址；生产环境请配置公网可访问的 NEXT_PUBLIC_ESP32_STREAM_URL，或切换到“广域网”模式使用 API 快照。
                      </p>
                      {streamWarning && (
                        <p className="text-xs text-amber-700">
                          {streamWarning}
                        </p>
                      )}
                    </div>
                  )
                ) : (
                  // WAN Mode: Polling snapshot
                  imageUrl ? (
                    <img
                      key={imageUrl}
                      src={imageUrl}
                      alt="远程快照"
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={() => {
                        if (!streamError) {
                          console.error('[Vision] 快照加载失败')
                          setStreamError('快照加载失败，请检查 /api/camera/latest 是否可用')
                        }
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">等待快照...</p>
                    </div>
                  )
                )}

                {streamError && (
                  <div className="absolute inset-x-3 bottom-14 z-10 rounded-lg border border-rose-200 bg-rose-50/90 p-2 text-xs text-rose-700 backdrop-blur-sm">
                    {streamError}
                  </div>
                )}

                {/* Fallback placeholder */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
                    <Video className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      摄像头流
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isWan ? "广域网流 - 远程访问" : "局域网流 - 本地网络"}
                    </p>
                  </div>
                </div>

                {/* Status overlay */}
                <div className="absolute left-3 top-3 z-10">
                  <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-gray-200 text-xs">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-gray-500" />
                    预览
                  </Badge>
                </div>
                <div className="absolute bottom-3 right-3 z-10">
                  <Badge variant="secondary" className="text-xs font-mono">
                    1920x1080 @ 30fps
                  </Badge>
                </div>

                {/* AI Analyze Button */}
                <div className="absolute bottom-3 left-3 z-10">
                  <Button
                    size="sm"
                    onClick={handleAnalyze}
                    disabled={isPending}
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
            </CardContent>
          </Card>

          {/* AI Analysis Log */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Brain className="h-4 w-4" />
                人工智能分析（演示）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-xs text-muted-foreground">
                下方“示例日志”为演示数据；真实结果以点击“AI 分析”后的返回内容为准。
              </p>
              <ScrollArea className="h-64 lg:h-72">
                <div className="flex flex-col gap-2 pr-3">
                  {/* Show latest analysis result */}
                  {state.success && state.payload && (
                    <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5">
                      <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-[10px] text-emerald-600">
                          {new Date(state.payload.timestamp).toLocaleTimeString('zh-CN')}
                        </span>
                        <span className="text-xs leading-relaxed text-foreground">
                          {state.payload.analysis}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Mock logs */}
                  {aiLogs.map((log, i) => (
                    <div
                      key={i}
                      className="flex gap-2 rounded-lg border border-border bg-muted/50 p-2.5"
                    >
                      <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {log.time}
                        </span>
                        <span className="text-xs leading-relaxed text-foreground">
                          {log.message}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* <!-- /SECTION:VISION --> */}
    </>
  )
}
