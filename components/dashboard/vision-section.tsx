"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Eye, Video, Brain, Clock } from "lucide-react"

const aiLogs = [
  { time: "14:32:05", message: "Detected: textbook (Math), confidence 0.96", type: "info" as const },
  { time: "14:32:03", message: "Object tracking: 3 items identified in frame", type: "info" as const },
  { time: "14:31:58", message: "Posture analysis: Normal sitting position", type: "success" as const },
  { time: "14:31:45", message: "Lighting condition: Adequate (420 lux)", type: "info" as const },
  { time: "14:31:30", message: "Warning: Low light detected briefly", type: "warning" as const },
  { time: "14:31:15", message: "Scene classification: Classroom environment", type: "info" as const },
  { time: "14:31:00", message: "Model inference latency: 23ms", type: "info" as const },
]

export function VisionSection() {
  const [isWan, setIsWan] = useState(false)

  return (
    <>
      {/* <!-- SECTION:VISION --> */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Vision</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Video Feed */}
          <Card className="lg:col-span-2 border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Video className="h-4 w-4" />
                  Live Feed
                </CardTitle>
                <div className="flex items-center gap-3">
                  <Label htmlFor="stream-mode" className="text-xs text-muted-foreground">
                    {isWan ? "WAN" : "LAN"}
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
                      Camera Feed
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isWan ? "WAN Stream - Remote Access" : "LAN Stream - Local Network"}
                    </p>
                  </div>
                </div>
                {/* Status overlay */}
                <div className="absolute left-3 top-3">
                  <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-200 text-xs">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                    REC
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
                AI Analysis
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
