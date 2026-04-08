"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useIoTStore } from "@/store/useIoTStore"
import {
  MessageCircle,
  Send,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Focus,
} from "lucide-react"

const mockMessages = [
  { id: 1, sender: "parent", text: "你到学校了吗？", time: "08:25" },
  { id: 2, sender: "child", text: "是的，我刚进教室！", time: "08:26" },
  { id: 3, sender: "parent", text: "好的。记得喝水。", time: "08:27" },
  { id: 4, sender: "child", text: "好的，收到！", time: "08:28" },
  { id: 5, sender: "system", text: "专注模式已在 08:30 启动", time: "08:30" },
]

export function InteractionSection() {
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [focusSeconds, setFocusSeconds] = useState(0)
  const [isFocusRunning, setIsFocusRunning] = useState(false)
  const [screenText, setScreenText] = useState("上课专注模式已开启")

  const mqttConnectionStatus = useIoTStore((s) => s.mqttConnectionStatus)
  const deviceOnline = useIoTStore((s) => s.deviceOnline)
  const iotApiFetchStatus = useIoTStore((s) => s.iotApiFetchStatus)
  const lastSeenAt = useIoTStore((s) => s.lastSeenAt)
  const pendingCmd = useIoTStore((s) => s.pendingCmd)
  const lastCmdAck = useIoTStore((s) => s.lastCmdAck)
  const cmdError = useIoTStore((s) => s.cmdError)
  const publishCommand = useIoTStore((s) => s.publishCommand)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    if (isFocusRunning && (focusMinutes > 0 || focusSeconds > 0)) {
      interval = setInterval(() => {
        if (focusSeconds === 0) {
          if (focusMinutes > 0) {
            setFocusMinutes((m) => m - 1)
            setFocusSeconds(59)
          }
        } else {
          setFocusSeconds((s) => s - 1)
        }
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isFocusRunning, focusMinutes, focusSeconds])

  const resetFocus = () => {
    setIsFocusRunning(false)
    setFocusMinutes(25)
    setFocusSeconds(0)
  }

  return (
    <>
      {/* <!-- SECTION:INTERACTION --> */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold text-foreground">交互</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Chat Interface */}
          <Card className="lg:col-span-2 border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MessageCircle className="h-4 w-4" />
                消息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <ScrollArea className="h-64">
                  <div className="flex flex-col gap-3 pr-3">
                    {mockMessages.map((msg) => {
                      if (msg.sender === "system") {
                        return (
                          <div
                            key={msg.id}
                            className="flex justify-center"
                          >
                            <Badge variant="secondary" className="text-[10px] font-normal">
                              {msg.text}
                            </Badge>
                          </div>
                        )
                      }
                      const isParent = msg.sender === "parent"
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isParent ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                              isParent
                                ? "rounded-tl-sm bg-muted text-foreground"
                                : "rounded-tr-sm bg-primary text-primary-foreground"
                            }`}
                          >
                            <p className="text-sm leading-relaxed">{msg.text}</p>
                            <p
                              className={`mt-1 text-right text-[10px] ${
                                isParent
                                  ? "text-muted-foreground"
                                  : "text-primary-foreground/70"
                              }`}
                            >
                              {msg.time}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>

                {/* Input area */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="输入消息..."
                    className="flex-1 text-sm"
                  />
                  <Button size="icon" className="shrink-0" aria-label="发送消息">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Focus Mode Timer */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Focus className="h-4 w-4" />
                专注模式
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-6">
                {/* Timer circle */}
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
                  {/* Progress ring indicator */}
                  {isFocusRunning && (
                    <div className="absolute -inset-1 animate-pulse rounded-full border-2 border-primary/20" />
                  )}
                </div>

                {/* Controls */}
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
                    onClick={() => setIsFocusRunning(!isFocusRunning)}
                    aria-label={isFocusRunning ? "暂停计时器" : "开始计时器"}
                  >
                    {isFocusRunning ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
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
                  <div className="mt-0.5 font-mono text-xs text-foreground">{mqttConnectionStatus}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-2">
                  <div className="text-[10px] text-muted-foreground">设备状态</div>
                  <div className="mt-0.5 text-xs font-medium text-foreground">{deviceOnline ? "在线" : "离线"}</div>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-2">
                  <div className="text-[10px] text-muted-foreground">API 初始化</div>
                  <div className="mt-0.5 font-mono text-xs text-foreground">{iotApiFetchStatus}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">LastSeen: {lastSeenAt ?? "-"}</span>
                <Separator orientation="vertical" className="h-4" />
                <span className="font-mono">待回执命令: {pendingCmd ? pendingCmd.cmd_id : "-"}</span>
                <Separator orientation="vertical" className="h-4" />
                <span className="font-mono">
                  最近 ACK:{" "}
                  {lastCmdAck
                    ? `${lastCmdAck.status === 0 ? "成功" : "失败"} ${lastCmdAck.cmd_id}${lastCmdAck.ts ? ` @ ${lastCmdAck.ts}` : ""}`
                    : "-"}
                </span>
              </div>

              {cmdError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                  命令发送失败：{cmdError}
                </div>
              )}

              {mqttConnectionStatus !== "connected" && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  MQTT 未连接，命令下发已禁用。请先确认 Broker 连接状态为 connected。
                </div>
              )}

              {mqttConnectionStatus === "connected" && !deviceOnline && (
                <div className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-800">
                  Broker 已连接，但设备仍离线（未收到 v5/bag/status=online）。下发命令可能不会被设备处理。
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => publishCommand("mode_switch", "focus_mode")}
                  disabled={mqttConnectionStatus !== "connected"}
                >
                  发送 mode_switch(focus_mode)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => publishCommand("mode_switch", "normal_mode")}
                  disabled={mqttConnectionStatus !== "connected"}
                >
                  发送 mode_switch(normal_mode)
                </Button>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={screenText}
                  onChange={(e) => setScreenText(e.target.value)}
                  placeholder="输入 screen_text 文本..."
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => publishCommand("screen_text", screenText)}
                  disabled={mqttConnectionStatus !== "connected" || screenText.trim().length === 0}
                >
                  发送 screen_text
                </Button>
              </div>

              {pendingCmd && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                  命令已下发，等待 ACK。cmd_id: <span className="font-mono">{pendingCmd.cmd_id}</span>
                </div>
              )}

              {lastCmdAck && (
                <div
                  className={`rounded-md border p-2 text-xs ${
                    lastCmdAck.status === 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  ACK：<span className="font-mono">{lastCmdAck.cmd_id}</span>，
                  {lastCmdAck.status === 0 ? "成功" : "失败"}（status=
                  <span className="font-mono">{lastCmdAck.status}</span>）
                  {lastCmdAck.msg ? `，msg=${lastCmdAck.msg}` : ""}
                  {lastCmdAck.ts ? `，时间=${lastCmdAck.ts}` : ""}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* <!-- /SECTION:INTERACTION --> */}
    </>
  )
}
