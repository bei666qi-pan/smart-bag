"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Eye, Video, Brain, Clock } from "lucide-react"

const aiLogs = [
  { time: "14:32:05", message: "检测到：教科书 (数学)，置信度 0.96", type: "info" as const },
  { time: "14:32:03", message: "物体跟踪：画面中识别出 3 个物品", type: "info" as const },
  { time: "14:31:58", message: "姿态分析：正常坐姿", type: "success" as const },
  { time: "14:31:45", message: "光线条件：充足 (420 lux)", type: "info" as const },
  { time: "14:31:30", message: "警告：检测到短暂光线不足", type: "warning" as const },
  { time: "14:31:15", message: "场景分类：教室环境", type: "info" as const },
  { time: "14:31:00", message: "模型推理延迟：23ms", type: "info" as const },
]

export function VisionSection() {
  const [isWan, setIsWan] = useState(false)

  return (
    <>
      {/* <!-- SECTION:VISION --> */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold text-foreground">视觉</h2>
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
                    onCheckedChange={setIsWan}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                {/* Video placeholder */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
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
                <div className="absolute left-3 top-3">
                  <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-200 text-xs">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                    录制
                  </Badge>
                </div>
                <div className="absolute bottom-3 right-3">
                  <Badge variant="secondary" className="text-xs font-mono">
                    1920x1080 @ 30fps
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Analysis Log */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Brain className="h-4 w-4" />
                人工智能分析
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64 lg:h-72">
                <div className="flex flex-col gap-2 pr-3">
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
