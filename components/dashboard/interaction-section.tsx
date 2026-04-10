"use client"

import { useEffect, useState, useTransition } from "react"
import {
  reviewDeviceMessageAction,
  type DeviceMessageReview,
} from "@/app/actions/analyze-text"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useIoTStore } from "@/store/useIoTStore"
import {
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

export function InteractionSection() {
  const [messages, setMessages] = useState(initialMessages)
  const [draftMessage, setDraftMessage] = useState("")
  const [lastReview, setLastReview] = useState<DeviceMessageReview | null>(null)
  const [focusRemainingSeconds, setFocusRemainingSeconds] = useState(25 * 60)
  const [isFocusRunning, setIsFocusRunning] = useState(false)
  const [screenText, setScreenText] = useState("")
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

  const appendMessages = (...nextMessages: ChatMessage[]) => {
    setMessages((current) => [...current, ...nextMessages])
  }

  const resetFocus = () => {
    setIsFocusRunning(false)
    setFocusRemainingSeconds(25 * 60)
  }

  const handleReviewMessage = () => {
    const trimmed = draftMessage.trim()

    if (!trimmed) {
      toast.warning("请输入要处理的消息内容")
      return
    }

    startReviewTransition(async () => {
      try {
        const review = await reviewDeviceMessageAction({
          text: trimmed,
          context:
            "这段文本准备发送到智能书包设备屏幕，请先生成适合儿童设备显示的简体中文短句。",
        })

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
            description: "已生成可发送的 screen_text，请确认后发送到设备。",
          })
        } else {
          toast.warning("AI 建议先人工确认", {
            description: review.analysis,
          })
        }
      } catch (error) {
        toast.error("消息评估失败", {
          description: error instanceof Error ? error.message : "未知错误",
        })
      }
    })
  }

  const handlePublishScreenText = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      toast.warning("当前没有可发送的 screen_text")
      return
    }

    const result = publishCommand("screen_text", trimmed)
    if (!result.ok) {
      toast.error("命令下发失败", {
        description: result.error || "未知错误",
      })
      return
    }

    appendMessages({
      id: `live-system-send-${Date.now()}`,
      sender: "system",
      text: `已真实下发 screen_text，等待设备 ACK：${trimmed}`,
      time: nowTime(),
      source: "live",
    })

    toast.success("已发送到 v5/bag/cmd", {
      description: trimmed,
    })
  }

  const handleQuickCommand = (action: "mode_switch" | "screen_text", value: string) => {
    const result = publishCommand(action, value)
    if (!result.ok) {
      toast.error("命令下发失败", {
        description: result.error || "未知错误",
      })
      return
    }

    toast.success("命令已下发", {
      description: `${action}: ${value}`,
    })
  }

  const focusMinutes = Math.floor(focusRemainingSeconds / 60)
  const focusSeconds = focusRemainingSeconds % 60
  const canSendToDevice =
    mqttConnectionStatus === "connected" &&
    deviceOnline &&
    screenText.trim().length > 0 &&
    !pendingCmd

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
                真实发送走 v5/bag/cmd
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-2 text-[11px] leading-5 text-muted-foreground">
                “AI 评估”只负责生成和检查屏显文案；“发送到设备”按钮只会在 MQTT 已连接且设备在线时开启，
                点击后会真实调用 `publishCommand()` 把 `screen_text` 下发到 `v5/bag/cmd`。
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
                    <div className="text-sm font-medium text-foreground">最近一次 bag-text 评估</div>
                    <Badge variant={lastReview.should_send ? "secondary" : "destructive"}>
                      {lastReview.should_send ? "建议可直发" : "需人工确认"}
                    </Badge>
                  </div>
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="rounded-md border border-border bg-background p-2">
                      <div className="text-[10px] uppercase tracking-wide">原始文本</div>
                      <div className="mt-1 text-foreground">{lastReview.original_text}</div>
                    </div>
                    <div className="rounded-md border border-border bg-background p-2">
                      <div className="text-[10px] uppercase tracking-wide">建议下发</div>
                      <div className="mt-1 text-foreground">{lastReview.screen_text}</div>
                    </div>
                    <div className="rounded-md border border-border bg-background p-2">
                      <div className="text-[10px] uppercase tracking-wide">分析结论</div>
                      <div className="mt-1 text-foreground">{lastReview.analysis}</div>
                    </div>
                    <div className="rounded-md border border-border bg-background p-2">
                      <div className="text-[10px] uppercase tracking-wide">处理建议</div>
                      <div className="mt-1 text-foreground">{lastReview.suggestion}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              {lastCmdAck ? (
                <div
                  className={`rounded-lg border p-3 text-xs ${
                    lastCmdAck.status === 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  最近设备 ACK：{lastCmdAck.status === 0 ? "成功" : "失败"} {lastCmdAck.cmd_id}
                  {lastCmdAck.msg ? `，${lastCmdAck.msg}` : ""}
                  {lastCmdAck.ts ? `，${lastCmdAck.ts}` : ""}
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
                  onClick={() => setIsFocusRunning((running) => !running)}
                  aria-label={isFocusRunning ? "暂停计时器" : "开始计时器"}
                >
                  {isFocusRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-foreground">IoT 命令调试面板</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/20 p-2">
                <div className="text-[10px] text-muted-foreground">MQTT Broker</div>
                <div className="mt-0.5 font-mono text-xs text-foreground">
                  {mqttConnectionStatus}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-2">
                <div className="text-[10px] text-muted-foreground">设备状态</div>
                <div className="mt-0.5 text-xs font-medium text-foreground">
                  {deviceOnline ? "在线" : "离线"}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-2">
                <div className="text-[10px] text-muted-foreground">API 初始化</div>
                <div className="mt-0.5 font-mono text-xs text-foreground">
                  {iotApiFetchStatus}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">LastSeen: {lastSeenAt ?? "-"}</span>
              <Separator orientation="vertical" className="h-4" />
              <span className="font-mono">
                待确认命令: {pendingCmd ? pendingCmd.cmd_id : "-"}
              </span>
              <Separator orientation="vertical" className="h-4" />
              <span className="font-mono">
                最近 ACK:{" "}
                {lastCmdAck
                  ? `${lastCmdAck.status === 0 ? "成功" : "失败"} ${lastCmdAck.cmd_id}${
                      lastCmdAck.ts ? ` @ ${lastCmdAck.ts}` : ""
                    }`
                  : "-"}
              </span>
            </div>

            {cmdError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                命令发送失败：{cmdError}
              </div>
            ) : null}

            {mqttConnectionStatus !== "connected" ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                MQTT 未连接，发送入口已禁用。请先确认 Broker 连接状态为 connected。
              </div>
            ) : null}

            {mqttConnectionStatus === "connected" && !deviceOnline ? (
              <div className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-800">
                Broker 已连接，但设备仍离线。可以先做 AI 评估，但“发送到设备”会保持禁用。
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleQuickCommand("mode_switch", "focus_mode")}
                disabled={mqttConnectionStatus !== "connected"}
              >
                发送 mode_switch(focus_mode)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleQuickCommand("mode_switch", "normal_mode")}
                disabled={mqttConnectionStatus !== "connected"}
              >
                发送 mode_switch(normal_mode)
              </Button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={screenText}
                onChange={(event) => setScreenText(event.target.value)}
                placeholder="输入或编辑 screen_text ..."
                className="text-sm"
              />
              <Button
                size="sm"
                onClick={() => handleQuickCommand("screen_text", screenText)}
                disabled={mqttConnectionStatus !== "connected" || screenText.trim().length === 0}
              >
                发送当前 screen_text
              </Button>
            </div>

            <div className="rounded-md border border-border bg-muted/20 p-2 text-xs text-muted-foreground">
              上方发送入口会真实下发 MQTT 命令；消息区只保留 AI 评估结果和设备 ACK，不再保留“看起来可发、实际不发”的假入口。
            </div>

            {pendingCmd ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                命令已下发，等待 ACK。cmd_id:{" "}
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
                ACK: <span className="font-mono">{lastCmdAck.cmd_id}</span>，
                {lastCmdAck.status === 0 ? "成功" : "失败"}，status=
                <span className="font-mono">{lastCmdAck.status}</span>
                {lastCmdAck.msg ? `，msg=${lastCmdAck.msg}` : ""}
                {lastCmdAck.ts ? `，时间=${lastCmdAck.ts}` : ""}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
