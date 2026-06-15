"use client"

import { useState } from "react"
import { CalendarClock, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useIoTStore } from "@/store/useIoTStore"
import { GBK_COURSES, buildTimetablePayload, type TimetableSlot } from "@/lib/gbk-courses"

// Radix Select 不允许空字符串作为 item value，用哨兵代表"该格留空"。
const NONE = "__none__"

const DEFAULT_SLOTS: TimetableSlot[] = [
  { course: "语文", time: "08:00" },
  { course: "数学", time: "09:40" },
  { course: "英语", time: "10:30" },
  { course: "科学", time: "14:00" },
]

export function TimetableEditor() {
  const [slots, setSlots] = useState<TimetableSlot[]>(DEFAULT_SLOTS)
  const mqttConnectionStatus = useIoTStore((s) => s.mqttConnectionStatus)
  const deviceOnline = useIoTStore((s) => s.deviceOnline)
  const publishCommand = useIoTStore((s) => s.publishCommand)

  const connected = mqttConnectionStatus === "connected"

  const setSlot = (i: number, patch: Partial<TimetableSlot>) =>
    setSlots((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  const handleSend = () => {
    if (!connected) {
      toast.error("MQTT 未连接，暂时无法下发课表")
      return
    }
    // 离线确认：broker 连着但设备未上报在线时，命令可能进不了设备——先让用户确认再发
    if (
      !deviceOnline &&
      !window.confirm("设备当前离线，课表可能不会立即送达。确定仍要下发吗？")
    ) {
      return
    }

    const payload = buildTimetablePayload(slots)
    const result = publishCommand("set_timetable", payload)
    if (!result.ok) {
      toast.error("下发失败", { description: result.error || "设备连接暂时不可用" })
      return
    }
    toast.success("课表已下发到书包", {
      description: slots
        .filter((s) => s.course && s.course !== NONE)
        .map((s) => `${s.course} ${s.time}`)
        .join("　"),
    })
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarClock className="h-4 w-4" />
            今日课表
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            下发到书包屏幕
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          选择课程与上课时间后下发，书包屏幕的"今日课表"会实时更新（最多 4 节）。
        </p>

        {slots.map((slot, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-xs text-muted-foreground">第 {i + 1} 节</span>
            <Select
              value={slot.course || NONE}
              onValueChange={(v) => setSlot(i, { course: v === NONE ? "" : v })}
            >
              <SelectTrigger className="h-9 flex-1 text-sm">
                <SelectValue placeholder="选择课程" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>（留空）</SelectItem>
                {GBK_COURSES.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="time"
              value={slot.time}
              onChange={(e) => setSlot(i, { time: e.target.value })}
              className="h-9 w-28 text-sm"
            />
          </div>
        ))}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-muted-foreground">
            {connected
              ? deviceOnline
                ? "设备在线，可直接下发"
                : "设备离线，下发前会再确认"
              : "连接未建立，暂不能下发"}
          </span>
          <Button size="sm" onClick={handleSend} disabled={!connected}>
            <Send className="mr-1 h-3.5 w-3.5" />
            下发课表
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
