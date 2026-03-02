"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  { id: 1, sender: "parent", text: "Have you arrived at school?", time: "08:25" },
  { id: 2, sender: "child", text: "Yes, I just entered the classroom!", time: "08:26" },
  { id: 3, sender: "parent", text: "Good. Remember to drink water.", time: "08:27" },
  { id: 4, sender: "child", text: "Ok, got it!", time: "08:28" },
  { id: 5, sender: "system", text: "Focus Mode activated at 08:30", time: "08:30" },
]

export function InteractionSection() {
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [focusSeconds, setFocusSeconds] = useState(0)
  const [isFocusRunning, setIsFocusRunning] = useState(false)

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
          <h2 className="text-lg font-semibold text-foreground">Interaction</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Chat Interface */}
          <Card className="lg:col-span-2 border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MessageCircle className="h-4 w-4" />
                Messages
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
                    placeholder="Type a message..."
                    className="flex-1 text-sm"
                  />
                  <Button size="icon" className="shrink-0" aria-label="Send message">
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
                Focus Mode
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
                      {isFocusRunning ? "Focusing..." : "Ready"}
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
                    aria-label="Reset timer"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="lg"
                    className="h-12 w-12 rounded-full"
                    onClick={() => setIsFocusRunning(!isFocusRunning)}
                    aria-label={isFocusRunning ? "Pause timer" : "Start timer"}
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
      </div>
      {/* <!-- /SECTION:INTERACTION --> */}
    </>
  )
}
