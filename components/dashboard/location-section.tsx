"use client"

import { useEffect, useRef, useState } from "react"
import AMapLoader from "@amap/amap-jsapi-loader"
import { MapPin, Navigation, Clock, Loader2, Crosshair } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useIoTStore } from "@/store/useIoTStore"
import { convertWgs84ToGcj02Coords } from "@/lib/coord-transform"

const DEFAULT_CENTER: [number, number] = [121.4737, 31.2304]

function isValidCoords(coords: [number, number] | null): coords is [number, number] {
  if (!coords || coords.length !== 2) return false
  const [lng, lat] = coords
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    !Number.isNaN(lng) &&
    !Number.isNaN(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  )
}

function formatCoords(coords: [number, number] | null) {
  if (!isValidCoords(coords)) return "暂无坐标"
  return `${coords[1].toFixed(6)}°N, ${coords[0].toFixed(6)}°E`
}

function formatRecordedAt(timestamp: string | null) {
  if (!timestamp) return "—"

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp

  return date.toLocaleString("zh-CN")
}

export function LocationSection() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const pathPointsRef = useRef<any[]>([])
  const lastAppliedCoordsRef = useRef<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const gpsCoords = useIoTStore((state) => state.gpsCoords)
  const lastSeenAt = useIoTStore((state) => state.lastSeenAt)
  const key = process.env.NEXT_PUBLIC_AMAP_KEY
  const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE
  const mapConfigError = !key || key === "your_amap_key_here"
    ? "请在 .env.local 中配置 NEXT_PUBLIC_AMAP_KEY"
    : !securityCode || securityCode === "your_security_code_here"
      ? "请在 .env.local 中配置 NEXT_PUBLIC_AMAP_SECURITY_CODE"
      : null

  useEffect(() => {
    if (!mapConfigError) {
      return
    }

    toast.error("地图配置错误", {
      description: mapConfigError,
    })
  }, [mapConfigError])

  useEffect(() => {
    let disposed = false
    let resizeTimer: number | null = null
    const container = mapContainerRef.current

    if (mapConfigError) {
      return
    }

    if (!container || mapRef.current) {
      return
    }

    AMapLoader.load({
      key,
      version: "2.0",
      plugins: ["AMap.Scale", "AMap.ToolBar", "AMap.Polyline", "AMap.Marker"],
    })
      .then((AMap) => {
        if (disposed || !container || mapRef.current) {
          return
        }

        const map = new AMap.Map(container, {
          viewMode: "2D",
          zoom: 15,
          center: new AMap.LngLat(DEFAULT_CENTER[0], DEFAULT_CENTER[1]),
          mapStyle: "amap://styles/normal",
          showLabel: true,
          features: ["bg", "road", "building", "point"],
        })

        mapRef.current = map

        map.on("complete", () => {
          if (disposed || !mapRef.current) {
            return
          }

          const AMapGlobal = (window as any).AMap
          if (AMapGlobal) {
            try {
              mapRef.current.addControl(new AMapGlobal.Scale())
              mapRef.current.addControl(new AMapGlobal.ToolBar({ position: "RB" }))
            } catch (error) {
              console.error("[AMap] Failed to add controls:", error)
            }
          }

          const resizeMap = () => {
            try {
              mapRef.current?.resize()
            } catch (error) {
              console.error("[AMap] Map resize failed:", error)
            }
          }

          requestAnimationFrame(resizeMap)
          resizeTimer = window.setTimeout(resizeMap, 240)

          setIsLoading(false)
          setMapReady(true)
        })

        map.on("error", (error: any) => {
          if (disposed) return

          setIsLoading(false)
          toast.error("地图加载失败", {
            description: error?.message || "未知错误",
          })
        })
      })
      .catch((error) => {
        if (disposed) return

        console.error("[AMap] Failed to load JS API:", error)
        setIsLoading(false)
        toast.error("地图加载失败", {
          description: error?.message || "请检查网络连接",
        })
      })

    return () => {
      disposed = true
      if (resizeTimer !== null) {
        window.clearTimeout(resizeTimer)
      }

      try {
        markerRef.current?.setMap?.(null)
      } catch (error) {
        console.error("[AMap] Failed to cleanup marker:", error)
      }
      markerRef.current = null

      try {
        polylineRef.current?.setMap?.(null)
      } catch (error) {
        console.error("[AMap] Failed to cleanup polyline:", error)
      }
      polylineRef.current = null

      try {
        mapRef.current?.destroy?.()
      } catch (error) {
        console.error("[AMap] Failed to destroy map:", error)
      }
      mapRef.current = null

      container.innerHTML = ""

      pathPointsRef.current = []
      lastAppliedCoordsRef.current = null
    }
  }, [key, mapConfigError])

  useEffect(() => {
    if (!mapReady || !mapRef.current || !isValidCoords(gpsCoords)) {
      return
    }

    const AMapGlobal = (window as any).AMap
    if (!AMapGlobal) {
      return
    }

    const converted = convertWgs84ToGcj02Coords(gpsCoords)
    if (!converted || converted.length !== 2) {
      return
    }

    const coordKey = `${gpsCoords[0].toFixed(6)},${gpsCoords[1].toFixed(6)}`
    const lngLat = new AMapGlobal.LngLat(converted[0], converted[1])

    if (!markerRef.current) {
      markerRef.current = new AMapGlobal.Marker({
        position: lngLat,
        title: "智能书包",
      })
      mapRef.current.add(markerRef.current)
    } else {
      markerRef.current.setPosition(lngLat)
    }

    if (!polylineRef.current) {
      polylineRef.current = new AMapGlobal.Polyline({
        path: [],
        strokeColor: "#2563eb",
        strokeWeight: 4,
        strokeOpacity: 0.8,
        lineJoin: "round",
        lineCap: "round",
      })
      mapRef.current.add(polylineRef.current)
    }

    if (lastAppliedCoordsRef.current !== coordKey) {
      pathPointsRef.current.push(lngLat)
      polylineRef.current.setPath(pathPointsRef.current)
      lastAppliedCoordsRef.current = coordKey
    }

    mapRef.current.setCenter(lngLat)
  }, [gpsCoords, mapReady])

  useEffect(() => {
    if (!mapReady || !mapContainerRef.current) {
      return
    }

    if (typeof ResizeObserver === "undefined") {
      return
    }

    const container = mapContainerRef.current
    const observer = new ResizeObserver(() => {
      try {
        mapRef.current?.resize?.()
      } catch (error) {
        console.error("[AMap] ResizeObserver resize failed:", error)
      }
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [mapReady])

  const hasGpsData = isValidCoords(gpsCoords)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-foreground" />
        <h2 className="text-lg font-semibold text-foreground">位置追踪</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Navigation className="h-4 w-4" />
              实时地图
            </CardTitle>
          </CardHeader>
          <CardContent className="h-full">
            <div className="relative flex min-h-[400px] w-full flex-1 flex-col rounded-xl bg-muted md:min-h-[500px]">
              <div
                id="amap-container"
                ref={mapContainerRef}
                className="[&_.amap-layer_img]:max-w-none [&_.amap-marker_img]:max-w-none [&_canvas]:max-w-none"
                style={{
                  width: "100%",
                  height: "600px",
                  minHeight: "600px",
                  position: "relative",
                }}
              />

              {isLoading && !mapConfigError && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">地图加载中...</p>
                  </div>
                </div>
              )}

              {mapReady && (
                <>
                  <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
                    <Badge variant="secondary" className="bg-white/90 text-xs backdrop-blur-sm">
                      <Crosshair className="mr-1.5 h-3 w-3" />
                      {hasGpsData ? "定位状态: 已接入" : "定位状态: 等待 GPS"}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-white/90 text-xs text-muted-foreground backdrop-blur-sm"
                    >
                      {hasGpsData ? "地图中心已跟随最新坐标" : "当前显示默认中心"}
                    </Badge>
                  </div>

                  <div className="absolute bottom-3 right-3 z-10">
                    <Badge
                      variant="secondary"
                      className="bg-white/90 font-mono text-[10px] backdrop-blur-sm"
                    >
                      {formatCoords(gpsCoords)}
                    </Badge>
                  </div>

                  <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2">
                    <Badge variant="outline" className="bg-white/90 text-[10px] backdrop-blur-sm">
                      GCJ-02 地图显示坐标
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-white/90 font-mono text-[10px] backdrop-blur-sm"
                    >
                      LastSeen: {formatRecordedAt(lastSeenAt)}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Clock className="h-4 w-4" />
              最近坐标
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  当前坐标
                </div>
                <div className="mt-1 font-mono text-sm text-foreground">
                  {formatCoords(gpsCoords)}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  最近上报
                </div>
                <div className="mt-1 font-mono text-sm text-foreground">
                  {formatRecordedAt(lastSeenAt)}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  轨迹状态
                </div>
                <div className="mt-1 text-sm text-foreground">
                  {hasGpsData ? "实时跟随中" : "暂无实时轨迹"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
