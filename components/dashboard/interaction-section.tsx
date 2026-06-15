"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import {
  reviewDeviceMessageAction,
  type DeviceMessageReview,
} from "@/app/actions/analyze-text"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { TimetableEditor } from "@/components/dashboard/timetable-editor"
import { useIoTStore } from "@/store/useIoTStore"
import {
  ChevronDown,
  Focus,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Timer,
} from "lucide-react"
import { toast } from "sonner"

type ChatMessage = {
  id: string
  sender: "parent" | "child" | "system"
  text: string
  time: string
  source: "example" | "live"
}

const initialMessages: ChatMessage[] = [
  { id: "example-1", sender: "parent", text: "你到学校了吗？", time: "08:25", source: "example" },
  { id: "example-2", sender: "child", text: "是的，我刚进教室。", time: "08:26", source: "example" },
  { id: "example-3", sender: "parent", text: "好的，记得喝水。", time: "08:27", source: "example" },
  { id: "example-4", sender: "child", text: "好的，收到！", time: "08:28", source: "example" },
  {
    id: "example-5",
    sender: "system",
    text: "以上为示例消息记录；真实下发请先做 AI 评估，再点击“发送到设备”。",
    time: "08:30",
    source: "example",
  },
]

function nowTime() {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getConnectionStatusText(status: string) {
  if (status === "connected") return "已连接"
  if (status === "connecting") return "连接中"
  if (status === "error") return "连接异常"
  return "未连接"
}

function getDataSyncStatusText(status: string) {
  if (status === "loading") return "同步中"
  if (status === "success") return "已同步"
  if (status === "error") return "同步失败"
  return "待同步"
}

function getCommandLabel(action: "mode_switch" | "screen_text", value: string) {
  if (action === "screen_text") {
    return `屏幕文字：${value}`
  }

  if (value === "focus_mode") {
    return "切换为专注模式"
  }

  if (value === "normal_mode") {
    return "切换为普通模式"
  }

  return `模式切换：${value}`
}

export function InteractionSection() {
  const [messages, setMessages] = useState(initialMessages)
  const [draftMessage, setDraftMessage] = useState("")
  const [lastReview, setLastReview] = useState<DeviceMessageReview | null>(null)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [focusRemainingSeconds, setFocusRemainingSeconds] = useState(25 * 60)
  const [isFocusRunning, setIsFocusRunning] = useState(false)
  const [screenText, setScreenText] = useState("")
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [isReviewPending, startReviewTransition] = useTransition()

  const mqttConnectionStatus = useIoTStore((state) => state.mqttConnectionStatus)
  const deviceOnline = useIoTStore((state) => state.deviceOnline)
  const iotApiFetchStatus = useIoTStore((state) => state.iotApiFetchStatus)
  const lastSeenAt = useIoTStore((state) => state.lastSeenAt)
  const pendingCmd = useIoTStore((state) => state.pendingCmd)
  const lastCmdAck = useIoTStore((state) => state.lastCmdAck)
  const cmdError = useIoTStore((state) => state.cmdError)
  const publishCommand = useIoTStore((state) => state.publishCommand)

  useEffect(() => {
    if (!isFocusRunning || focusRemainingSeconds <= 0) {
      return
    }

    const interval = window.setInterval(() => {
      setFocusRemainingSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(interval)
          setIsFocusRunning(false)
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [focusRemainingSeconds, isFocusRunning])

  // Bridge the local focus timer to the device. Best-effort only: when the
  // device is offline the timer stays purely local and no command is sent.
  const focusCompletionNotifiedRef = useRef(false)

  const notifyDeviceMode = (mode: "focus_mode" | "normal_mode") => {
    if (mqttConnectionStatus !== "connected" || !deviceOnline) {
      return
    }

    const result = publishCommand("mode_switch", mode)
    if (result.ok) {
      toast.info(
        mode === "focus_mode" ? "已通知设备进入专注模式" : "已通知设备恢复普通模式",
      )
    }
  }

  // When the countdown naturally reaches 0, tell the device to leave focus mode.
  useEffect(() => {
    if (focusRemainingSeconds > 0) {
      focusCompletionNotifiedRef.current = false
      return
    }

    if (!focusCompletionNotifiedRef.current) {
      focusCompletionNotifiedRef.current = true
      notifyDeviceMode("normal_mode")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRemainingSeconds])

  const appendMessages = (...nextMessages: ChatMessage[]) => {
    setMessages((current) => [...current, ...nextMessages])
  }

  const resetFocus = () => {
    const wasRunning = isFocusRunning
    setIsFocusRunning(false)
    setFocusRemainingSeconds(25 * 60)
    if (wasRunning) {
      notifyDeviceMode("normal_mode")
    }
  }

  const handleToggleFocus = () => {
    const next = !isFocusRunning
    setIsFocusRunning(next)
    notifyDeviceMode(next ? "focus_mode" : "normal_mode")
  }

  const handleReviewMessage = () => {
    const trimmed = draftMessage.trim()

    if (!trimmed) {
      toast.warning("请输入要处理的消息内容")
      return
    }

    setReviewError(null)
    setLastReview(null)
    setScreenText("")

    startReviewTransition(async () => {
      try {
        const result = await reviewDeviceMessageAction({
          text: trimmed,
          context:
            "这段文本准备发送到智能书包设备屏幕，请先生成适合儿童设备显示的简体中文短句。",
        })

        if (!result.ok) {
          setReviewError(result.message)
          appendMessages({
            id: `live-system-review-error-${Date.now()}`,
            sender: "system",
            text: `AI 评估暂时不可用：${result.message}。你仍可展开“高级调试与设备控制”，手动输入要显示在设备上的短文本后发送。`,
            time: nowTime(),
            source: "live",
          })
          toast.error("AI 暂时不可用，请稍后重试", {
            description:
              "需要继续联调时，可展开“高级调试与设备控制”手动发送屏幕文字。",
          })
          return
        }

        const review = result.review
        setReviewError(null)
        setLastReview(review)
        setScreenText(review.screen_text)

        appendMessages(
          {
            id: `live-parent-${Date.now()}`,
            sender: "parent",
            text: trimmed,
            time: nowTime(),
            source: "live",
          },
          {
            id: `live-system-review-${Date.now() + 1}`,
            sender: "system",
            text: `AI 评估：${review.screen_text}。${review.decision_reason}`,
            time: nowTime(),
            source: "live",
          },
        )

        if (review.should_send) {
          toast.success("AI 评估完成", {
            description: "已生成适合设备屏幕显示的短文本，请确认后发送。",
          })
        } else {
          toast.warning("AI 建议先人工确认", {
            description: review.analysis,
          })
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误"
        setReviewError(message)
        toast.error("AI 暂时不可用，请稍后重试", {
          description:
            "需要继续联调时，可展开“高级调试与设备控制”手动发送屏幕文字。",
        })
      }
    })
  }

  // 离线确认：broker 连着但设备未上报在线时，命令可能进不了设备。
  // 返回 false 表示用户取消、不应发送。
  const confirmIfOffline = () => {
    if (mqttConnectionStatus === "connected" && !deviceOnline) {
      return window.confirm("设备当前离线，命令可能不会送达。确定仍要发送吗？")
    }
    return true
  }

  const handlePublishScreenText = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      toast.warning("当前没有可发送的屏幕文字")
      return
    }

    if (!confirmIfOffline()) return

    const result = publishCommand("screen_text", trimmed)
    if (!result.ok) {
      toast.error("发送失败", {
        description: result.error || "设备连接暂时不可用",
      })
      return
    }

    appendMessages({
      id: `live-system-send-${Date.now()}`,
      sender: "system",
      text: `已发送到设备，等待设备确认：${trimmed}`,
      time: nowTime(),
      source: "live",
    })

    toast.success("已发送到设备", {
      description: trimmed,
    })
  }

  const handleQuickCommand = (action: "mode_switch" | "screen_text", value: string) => {
    if (!confirmIfOffline()) return

    const result = publishCommand(action, value)
    if (!result.ok) {
      toast.error("发送失败", {
        description: result.error || "设备连接暂时不可用",
      })
      return
    }

    toast.success("已发送到设备", {
      description: getCommandLabel(action, value),
    })
  }

  const focusMinutes = Math.floor(focusRemainingSeconds / 60)
  const focusSeconds = focusRemainingSeconds % 60
  const canSendToDevice =
    mqttConnectionStatus === "connected" &&
    deviceOnline &&
    screenText.trim().length > 0 &&
    !pendingCmd
  const screenTextPreview = screenText.trim()
  const sendButtonHint = pendingCmd
    ? "上一条消息正在等待设备确认，请稍候。"
    : !screenTextPreview && reviewError
      ? "AI 暂时不可用，尚未生成可发送内容。可展开下方高级控制手动输入。"
      : !screenTextPreview
        ? "先输入消息并完成 AI 评估，生成适合设备显示的短文本。"
        : mqttConnectionStatus !== "connected"
          ? "连接未建立，暂时无法发送。"
          : !deviceOnline
            ? "设备未连接，暂时无法发送。"
            : `准备发送：${screenTextPreview}`

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-foreground" />
        <h2 className="text-lg font-semibold text-foreground">交互</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MessageCircle className="h-4 w-4" />
                消息
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                设备屏幕消息
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-2 text-[11px] leading-5 text-muted-foreground">
                先输入想显示在书包屏幕上的原始消息，AI 会帮你整理成更短、更适合设备展示的文字。
                确认无误后，再点击“发送到设备”。
              </div>

              <ScrollArea className="h-64">
                <div className="flex flex-col gap-3 pr-3">
                  {messages.map((message) => {
                    if (message.sender === "system") {
                      return (
                        <div key={message.id} className="flex justify-center">
                          <Badge
                            variant="secondary"
                            className="flex max-w-full items-center gap-2 whitespace-normal px-3 py-1 text-[10px] font-normal leading-5"
                          >
                            <span>{message.text}</span>
                            <span className="text-[9px] opacity-70">{message.time}</span>
                          </Badge>
                        </div>
                      )
                    }

                    const isParent = message.sender === "parent"

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isParent ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                            isParent
                              ? "rounded-tl-sm bg-muted text-foreground"
                              : "rounded-tr-sm bg-primary text-primary-foreground"
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            {message.source === "example" ? (
                              <Badge variant="outline" className="h-5 text-[9px]">
                                示例
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm leading-relaxed">{message.text}</p>
                          <p
                            className={`mt-1 text-right text-[10px] ${
                              isParent
                                ? "text-muted-foreground"
                                : "text-primary-foreground/70"
                            }`}
                          >
                            {message.time}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              {lastReview ? (
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-foreground">最近一次 AI 建议</div>
                    <Badge variant={lastReview.should_send ? "secondary" : "destructive"}>
                      {lastReview.should_send ? "建议可发送" : "请先确认"}
                    </Badge>
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="rounded-md border border-border bg-background p-2">
                      <div className="text-[10px] text-muted-foreground">原始消息</div>
                      <div className="mt-1 text-foreground">{lastReview.original_text}</div>
                    </div>
                    <div className="rounded-md border border-border bg-background p-2">
                      <div className="text-[10px] text-muted-foreground">建议显示</div>
                      <div className="mt-1 text-foreground">{lastReview.screen_text}</div>
                    </div>
                    <div className="rounded-md border border-border bg-background p-2">
                      <div className="text-[10px] text-muted-foreground">分析结论</div>
                      <div className="mt-1 text-foreground">{lastReview.analysis}</div>
                    </div>
                    <div className="rounded-md border border-border bg-background p-2">
                      <div className="text-[10px] text-muted-foreground">处理建议</div>
                      <div className="mt-1 text-foreground">{lastReview.suggestion}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Input
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder="输入想展示给设备的原始消息..."
                  className="flex-1 text-sm"
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={handleReviewMessage}
                    disabled={isReviewPending || draftMessage.trim().length === 0}
                    className="gap-2 sm:flex-1"
                  >
                    {isReviewPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        AI 评估中
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        AI 评估
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handlePublishScreenText(screenText)}
                    disabled={!canSendToDevice}
                    className="gap-2 sm:flex-1"
                  >
                    <Send className="h-4 w-4" />
                    发送到设备
                  </Button>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{sendButtonHint}</p>

                {reviewError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    <div className="font-medium">AI 暂时不可用，请稍后重试</div>
                    <div className="mt-1">原因：{reviewError}</div>
                    <div className="mt-1">
                      需要继续联调设备时，可以展开“高级调试与设备控制”，手动输入要显示在设备上的短文本后发送。
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 h-8 bg-white/70"
                      onClick={() => setIsAdvancedOpen(true)}
                    >
                      展开高级控制
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Focus className="h-4 w-4" />
              专注模式
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-6">
              <div className="relative flex h-40 w-40 items-center justify-center rounded-full border-4 border-muted bg-muted/30">
                <div className="flex flex-col items-center gap-1">
                  <Timer className="h-5 w-5 text-muted-foreground" />
                  <span className="font-mono text-3xl font-semibold tabular-nums text-foreground">
                    {String(focusMinutes).padStart(2, "0")}:
                    {String(focusSeconds).padStart(2, "0")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isFocusRunning ? "专注中..." : "就绪"}
                  </span>
                </div>
                {isFocusRunning ? (
                  <div className="absolute -inset-1 animate-pulse rounded-full border-2 border-primary/20" />
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={resetFocus}
                  aria-label="重置计时器"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  className="h-12 w-12 rounded-full"
                  onClick={handleToggleFocus}
                  aria-label={isFocusRunning ? "暂停计时器" : "开始计时器"}
                >
                  {isFocusRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <TimetableEditor />

      <Card className="border-border bg-card">
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-sm font-medium text-foreground">
                  高级调试与设备控制
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  硬件联调、手动发送和设备回执记录。
                </p>
              </div>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-2">
                  {isAdvancedOpen ? "收起" : "展开"}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      isAdvancedOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>

          <CollapsibleContent>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/20 p-2">
                    <div className="text-[10px] text-muted-foreground">连接状态</div>
                    <div className="mt-0.5 text-xs font-medium text-foreground">
                      {getConnectionStatusText(mqttConnectionStatus)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-2">
                    <div className="text-[10px] text-muted-foreground">设备状态</div>
                    <div className="mt-0.5 text-xs font-medium text-foreground">
                      {deviceOnline ? "在线" : "未连接"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-2">
                    <div className="text-[10px] text-muted-foreground">数据同步</div>
                    <div className="mt-0.5 text-xs font-medium text-foreground">
                      {getDataSyncStatusText(iotApiFetchStatus)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>最后在线：{lastSeenAt ?? "暂无"}</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>
                    等待设备确认：{pendingCmd ? pendingCmd.cmd_id : "暂无"}
                  </span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>
                    最近设备回执：
                    {lastCmdAck
                      ? `${lastCmdAck.status === 0 ? "成功" : "失败"} ${lastCmdAck.cmd_id}${
                          lastCmdAck.ts ? ` @ ${lastCmdAck.ts}` : ""
                        }`
                      : "暂无"}
                  </span>
                </div>

                {cmdError ? (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                    发送失败：{cmdError}
                  </div>
                ) : null}

                {mqttConnectionStatus !== "connected" ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    连接尚未建立，高级控制暂时不能发送。请先检查设备通信连接。
                  </div>
                ) : null}

                {mqttConnectionStatus === "connected" && !deviceOnline ? (
                  <div className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-800">
                    通信连接已建立，但设备还没有上报在线。高级控制仍可用于联调，正式发送建议等设备上线。
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium text-foreground">模式切换</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickCommand("mode_switch", "focus_mode")}
                      disabled={mqttConnectionStatus !== "connected"}
                    >
                      进入专注模式
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleQuickCommand("mode_switch", "normal_mode")}
                      disabled={mqttConnectionStatus !== "connected"}
                    >
                      回到普通模式
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium text-foreground">手动发送屏幕文字</div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={screenText}
                      onChange={(event) => setScreenText(event.target.value)}
                      placeholder="手动输入设备屏幕显示的文字..."
                      className="text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleQuickCommand("screen_text", screenText)}
                      disabled={
                        mqttConnectionStatus !== "connected" ||
                        screenText.trim().length === 0
                      }
                    >
                      发送屏幕文字
                    </Button>
                  </div>
                </div>

                <div className="rounded-md border border-border bg-muted/20 p-2 text-xs text-muted-foreground">
                  这里会直接发送设备命令，适合硬件联调；普通发送优先使用上方 AI 评估后的主按钮。
                </div>

                {pendingCmd ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                    已发送，正在等待设备确认。命令编号：
                    <span className="font-mono">{pendingCmd.cmd_id}</span>
                  </div>
                ) : null}

                {lastCmdAck ? (
                  <div
                    className={`rounded-md border p-2 text-xs ${
                      lastCmdAck.status === 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-rose-200 bg-rose-50 text-rose-800"
                    }`}
                  >
                    最近设备回执：命令
                    <span className="font-mono">{lastCmdAck.cmd_id}</span>，
                    {lastCmdAck.status === 0 ? "成功" : "失败"}，状态码
                    <span className="font-mono">{lastCmdAck.status}</span>
                    {lastCmdAck.msg ? `，说明：${lastCmdAck.msg}` : ""}
                    {lastCmdAck.ts ? `，时间：${lastCmdAck.ts}` : ""}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  )
}
