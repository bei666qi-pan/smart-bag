"use client"

import { useEffect, useState } from "react"
import { KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type NewapiStatus = {
  activated: boolean
  maskedKey: string | null
  baseUrl: string | null
  hasServerFallback: boolean
}

export default function SettingsPage() {
  const [status, setStatus] = useState<NewapiStatus | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    try {
      const res = await fetch("/api/settings/newapi")
      const data = await res.json()
      if (data?.success) {
        setStatus(data)
        setBaseUrl(data.baseUrl ?? "")
      }
    } catch {
      toast.error("获取激活状态失败")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/settings/newapi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, baseUrl }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        toast.error(data?.message ?? "保存失败")
        return
      }
      toast.success("AI 功能已激活")
      setApiKey("")
      await refresh()
    } catch {
      toast.error("网络错误，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    try {
      const res = await fetch("/api/settings/newapi", { method: "DELETE" })
      const data = await res.json()
      if (data?.success) {
        toast.success("已清除个人 API key")
        await refresh()
      }
    } catch {
      toast.error("清除失败，请稍后重试")
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">设置</h1>
        <p className="text-sm text-muted-foreground">
          管理 AI 服务激活与账号相关配置
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                AI 服务激活（NewAPI key）
              </CardTitle>
              <CardDescription>
                填入你的 API key 以激活视觉分析与文本分析功能。key 仅保存在服务端，不会下发到浏览器。
              </CardDescription>
            </div>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : status?.activated ? (
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="secondary">
                <ShieldCheck className="mr-1 h-3 w-3" />
                已激活
              </Badge>
            ) : status?.hasServerFallback ? (
              <Badge className="bg-sky-50 text-sky-700 border-sky-200" variant="secondary">
                使用服务器默认配置
              </Badge>
            ) : (
              <Badge className="bg-amber-50 text-amber-700 border-amber-200" variant="secondary">
                未激活
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.activated && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2">
              <div className="text-sm">
                <span className="text-muted-foreground">当前 key：</span>
                <span className="font-mono">{status.maskedKey}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={remove} className="text-destructive">
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                清除
              </Button>
            </div>
          )}

          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="baseUrl">
                接口地址{" "}
                <span className="font-normal text-muted-foreground">
                  （可选，留空使用服务器默认）
                </span>
              </Label>
              <Input
                id="baseUrl"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-newapi.example.com/v1"
              />
            </div>
            <Button type="submit" disabled={saving || !apiKey.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存并激活
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
