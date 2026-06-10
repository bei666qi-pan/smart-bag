"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mic, MessageSquare } from "lucide-react"
import { useIoTStore } from "@/store/useIoTStore"

function formatTimestamp(ts: string | null) {
  if (!ts) return "—"
  const date = new Date(ts)
  return Number.isNaN(date.getTime()) ? ts : date.toLocaleString("zh-CN")
}

// [语音联动] 把语音发起的控制命令转成中文可读文案
function describeVoiceCmd(cmd: { action: string; value?: string }) {
  const v = cmd.value || ""
  if (cmd.action === "mode_switch") {
    if (v === "focus_mode") return "进入专注模式"
    if (v === "normal_mode") return "切换普通模式"
    return `模式切换：${v}`
  }
  if (cmd.action === "indicator") {
    if (v === "listening") return "唤醒（正在聆听）"
    if (v === "thinking") return "思考中"
    if (v === "idle") return "休眠"
    return `指示灯：${v}`
  }
  if (cmd.action === "screen_text") return `屏显：${v}`
  return `${cmd.action}：${v}`
}

/**
 * 语音助手（Jetson「小乐」）状态卡。
 * 数据来自 store：实时经 MQTT v5/bag/voice/* 更新，刷新后由 /api/iot/state 恢复。
 */
export function VoiceAssistantCard() {
  const voiceOnline = useIoTStore((s) => s.voiceOnline)
  const voiceLastSeenAt = useIoTStore((s) => s.voiceLastSeenAt)
  const lastVoiceEvent = useIoTStore((s) => s.lastVoiceEvent)
  const lastVoiceCmd = useIoTStore((s) => s.lastVoiceCmd) // [语音联动]

  const isDialog = lastVoiceEvent?.type === "dialog"

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-foreground">
          <span className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            语音助手（小乐）
          </span>
          <Badge
            variant="secondary"
            className={`text-[10px] ${
              voiceOnline
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-gray-200 bg-gray-50 text-gray-600"
            }`}
          >
            {voiceOnline ? "在线" : "离线"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {lastVoiceEvent ? (
          <div className="flex flex-col gap-2 text-xs">
            {isDialog ? (
              <>
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-muted-foreground">孩子说</span>
                  <span className="text-foreground">{lastVoiceEvent.user || "—"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="text-foreground">{lastVoiceEvent.reply || "—"}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">最近事件</span>
                <Badge variant="outline" className="text-[10px]">
                  {lastVoiceEvent.type}
                </Badge>
              </div>
            )}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {isDialog && lastVoiceEvent.route ? `路由：${lastVoiceEvent.route}` : ""}
              </span>
              <span>{formatTimestamp(voiceLastSeenAt)}</span>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
            {voiceOnline
              ? "语音助手在线，等待对话…"
              : "语音助手离线。设备上的小乐上线后，这里会显示在线状态与最近一次语音对话。"}
          </div>
        )}

        {/* [语音联动] 最近一条语音发起的书包控制命令（来自 v5/bag/voice/cmd） */}
        {lastVoiceCmd ? (
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-2 text-[11px]">
            <Badge variant="outline" className="shrink-0 text-[10px]">
              语音指令
            </Badge>
            <span className="text-foreground">{describeVoiceCmd(lastVoiceCmd)}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
