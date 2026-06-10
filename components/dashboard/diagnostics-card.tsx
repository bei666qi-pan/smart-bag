"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, CheckCircle2, ServerCog, XCircle } from "lucide-react"

type DaemonStatus = {
  started: boolean
  starting: boolean
  redisConfigured: boolean
  mqttServerConfigured: boolean
  redisConnected: boolean
  mqttConnected: boolean
  subscribed: boolean
  lastMirroredAt: string | null
  lastMirroredTopic: string | null
  lastError: string | null
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge
      variant="secondary"
      className={`gap-1 text-[10px] font-medium ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-gray-200 bg-gray-50 text-gray-600"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </Badge>
  )
}

function formatTimestamp(ts: string | null) {
  if (!ts) return "—"
  const date = new Date(ts)
  return Number.isNaN(date.getTime()) ? ts : date.toLocaleString("zh-CN")
}

/**
 * Surfaces the read-only `/api/iot/daemon-status` diagnostic endpoint in the UI
 * so deployment/link issues are visible without manually opening the URL.
 */
export function DiagnosticsCard() {
  const [status, setStatus] = useState<DaemonStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const res = await fetch("/api/iot/daemon-status", { cache: "no-store" })
        if (!res.ok) {
          throw new Error(`http_${res.status}`)
        }
        const data = (await res.json()) as DaemonStatus
        if (active) {
          setStatus(data)
          setError(null)
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "unknown_error")
        }
      }
    }

    load()
    const timer = window.setInterval(load, 10000)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
          <ServerCog className="h-4 w-4" />
          服务端守护进程
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill ok={status.started} label="已启动" />
              <StatusPill ok={status.redisConnected} label="Redis" />
              <StatusPill ok={status.mqttConnected} label="MQTT" />
              <StatusPill ok={status.subscribed} label="已订阅" />
            </div>
            <div className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
              <span>
                最近镜像：{formatTimestamp(status.lastMirroredAt)}
                {status.lastMirroredTopic ? ` · ${status.lastMirroredTopic}` : ""}
              </span>
              {status.lastError ? (
                <span className="text-rose-600">最近错误：{status.lastError}</span>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-4 w-4" />
            {error ? `诊断接口读取失败：${error}` : "正在读取守护进程状态…"}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
