// components/dashboard/location-section.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Navigation, Shield, Clock, Loader2 } from "lucide-react"
import AMapLoader from "@amap/amap-jsapi-loader"
import { useIoTStore } from "@/store/useIoTStore"
import { toast } from "sonner"
import { convertWgs84ToGcj02Coords } from "@/lib/coord-transform"

// STRICT: Hardcoded default center (Shanghai People's Square - GCJ-02)
const DEFAULT_CENTER: [number, number] = [121.4737, 31.2304]

const recentLocations = [
  { time: "14:30", location: "教室 3-B", status: "current" as const },
  { time: "12:15", location: "食堂", status: "past" as const },
  { time: "10:00", location: "图书馆", status: "past" as const },
  { time: "08:30", location: "学校门口", status: "past" as const },
]

export function LocationSection() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const pathPointsRef = useRef<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [mapReady, setMapReady] = useState(false)
  const gpsCoords = useIoTStore((state) => state.gpsCoords)
  const lastSeenAt = useIoTStore((state) => state.lastSeenAt)

  // Map Initialization with STRICT RULES + Async Race Condition Fix
  useEffect(() => {
    // ✅ Unmount flag to prevent async race condition
    let isUnmounted = false

    const key = process.env.NEXT_PUBLIC_AMAP_KEY
    const securityCode = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE

    if (!key || key === 'your_amap_key_here') {
      console.error('[AMap] Key 未配置')
      setIsLoading(false)
      toast.error('地图配置错误', {
        description: '请在 .env.local 中配置 NEXT_PUBLIC_AMAP_KEY',
      })
      return
    }

    if (!securityCode || securityCode === 'your_security_code_here') {
      console.error('[AMap] Security Code 未配置')
      setIsLoading(false)
      toast.error('地图安全配置错误', {
        description: '请在 .env.local 中配置 NEXT_PUBLIC_AMAP_SECURITY_CODE',
      })
      return
    }

    // Strict Mode Guard
    if (!mapContainerRef.current || mapRef.current) {
      console.log('[AMap] 跳过重复初始化 (Strict Mode)')
      return
    }

    console.log('[AMap] 开始初始化地图...')

    // Security Config is injected globally by AMapSecurityConfig (root layout)

    // Initialize AMap
    AMapLoader.load({
      key: key,
      version: '2.0',
      plugins: ['AMap.Scale', 'AMap.ToolBar', 'AMap.Polyline', 'AMap.Marker'],
    })
      .then((AMap) => {
        // ✅ CRITICAL: Check if component was unmounted during async load
        if (isUnmounted) {
          console.log('[AMap] 组件已卸载,取消地图创建 (Async Race Condition 防护)')
          return
        }

        if (mapRef.current) {
          console.log('[AMap] 地图已存在,取消创建')
          return
        }

        // ✅ Double-check container still exists
        if (!mapContainerRef.current) {
          console.log('[AMap] 容器已销毁,取消创建')
          return
        }

        console.log('[AMap] 高德地图 JS API 加载成功')

        // STRICT: 2D mode to bypass WebGL context conflicts in Strict Mode
        const map = new AMap.Map(mapContainerRef.current, {
          viewMode: '2D',
          zoom: 15,
          // Use explicit LngLat instance to avoid LngLat(NaN, NaN) crash in prod
          center: new AMap.LngLat(DEFAULT_CENTER[0], DEFAULT_CENTER[1]),
          mapStyle: 'amap://styles/normal',
          showLabel: true,
          features: ['bg', 'road', 'building', 'point'],
        })

        mapRef.current = map

        // Delay control creation until map complete to avoid race conditions
        map.on('complete', () => {
          const AMapGlobal = (window as any).AMap
          if (AMapGlobal && mapRef.current) {
            try {
              mapRef.current.addControl(new AMapGlobal.Scale())
              mapRef.current.addControl(new AMapGlobal.ToolBar({ position: 'RB' }))
            } catch (controlError) {
              console.error('[AMap] 控件初始化失败:', controlError)
            }
          }

          // Force resize every 500ms for ~3s to覆盖首屏布局抖动
          let attempt = 0
          const resizeInterval = setInterval(() => {
            if (mapRef.current) {
              try {
                console.log('[AMap] Forcing resize heartbeat...')
                mapRef.current.resize()
              } catch (resizeError) {
                console.error('[AMap] Heartbeat resize 失败:', resizeError)
              }
            }
            attempt++
            if (attempt > 6) {
              clearInterval(resizeInterval)
            }
          }, 500)
          console.log('[AMap] 地图加载完成')
          
          // ✅ Check unmount flag before setState
          if (!isUnmounted) {
            setIsLoading(false)
            setMapReady(true)

            toast.success('高德地图初始化完成', {
              description: '等待 GPS 数据',
            })
          }
        })

        map.on('error', (error: any) => {
          console.error('[AMap] 地图错误:', error)
          
          if (!isUnmounted) {
            setIsLoading(false)
            toast.error('地图加载失败', {
              description: error?.message || '未知错误',
            })
          }
        })
      })
      .catch((error) => {
        console.error('[AMap] 加载失败:', error)
        
        // ✅ Check unmount flag before setState
        if (!isUnmounted) {
          setIsLoading(false)
          toast.error('高德地图加载失败', {
            description: error?.message || '请检查网络连接',
          })
        }
      })

    // STRICT Cleanup
    return () => {
      // ✅ Set unmount flag FIRST to prevent async callbacks
      isUnmounted = true
      
      console.log('[AMap] 清理地图实例...')
      
      if (markerRef.current) {
        try {
          markerRef.current.setMap(null)
          markerRef.current = null
        } catch (error) {
          console.error('[AMap] Marker 清理失败:', error)
        }
      }

      if (polylineRef.current) {
        try {
          polylineRef.current.setMap(null)
          polylineRef.current = null
        } catch (error) {
          console.error('[AMap] Polyline 清理失败:', error)
        }
      }

      if (mapRef.current) {
        try {
          mapRef.current.destroy()
          mapRef.current = null
        } catch (error) {
          console.error('[AMap] Map 销毁失败:', error)
        }
      }

      // Force-clear DOM container to prevent residual Canvas nodes
      if (mapContainerRef.current) {
        mapContainerRef.current.innerHTML = ''
      }

      setIsLoading(true)
      setMapReady(false)
      pathPointsRef.current = []
    }
  }, [])

  // 使用 ResizeObserver 监听容器物理尺寸，驱动 AMap resize，避免 Tailwind/布局变更导致的灰屏
  useEffect(() => {
    if (!mapContainerRef.current || !mapRef.current) return

    const container = mapContainerRef.current
    const map = mapRef.current

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container && mapRef.current) {
          try {
            mapRef.current.resize()
            console.log('[AMap] ResizeObserver: map resize triggered')
          } catch (error) {
            console.error('[AMap] ResizeObserver resize 失败:', error)
          }
        }
      }
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [mapReady])

  // BULLETPROOF Store Subscription with Zustand v5 transient updates
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    console.log('[AMap] 订阅 GPS 更新 (Zustand v5)...')

    const unsub = useIoTStore.subscribe(
      (state) => state.gpsCoords,
      (currentCoords, prevCoords) => {
        const map = mapRef.current
        if (!map) return

        // 1. Strict Validation (Defense in Depth)
        if (!currentCoords || !Array.isArray(currentCoords) || currentCoords.length !== 2) {
          return
        }

        const [lng, lat] = currentCoords

        if (typeof lng !== 'number' || typeof lat !== 'number') {
          return
        }

        if (Number.isNaN(lng) || Number.isNaN(lat)) {
          return
        }

        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          return
        }

        // 2. Precise Value Diff Check (Prevent reference traps)
        const isSameLocation =
          Array.isArray(prevCoords) &&
          prevCoords.length === 2 &&
          prevCoords[0] === lng &&
          prevCoords[1] === lat

        if (isSameLocation) return

        // 3. Update Map Imperatively
        try {
          const converted = convertWgs84ToGcj02Coords(currentCoords)

          if (
            !converted ||
            !Array.isArray(converted) ||
            converted.length !== 2 ||
            Number.isNaN(converted[0]) ||
            Number.isNaN(converted[1])
          ) {
            return
          }

          const AMapGlobal = (window as any).AMap
          if (!AMapGlobal) {
            console.error('[AMap] AMap 全局对象未找到')
            return
          }

          const lngLat = new AMapGlobal.LngLat(converted[0], converted[1])

          // Create marker if not exists
          if (!markerRef.current) {
            markerRef.current = new AMapGlobal.Marker({
              position: lngLat,
              icon: new AMapGlobal.Icon({
                size: new AMapGlobal.Size(32, 32),
                image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
                imageSize: new AMapGlobal.Size(32, 32),
              }),
              offset: new AMapGlobal.Pixel(-16, -32),
              title: '智能书包',
            })

            map.add(markerRef.current)

            // Initialize polyline
            const initialPathPoint = lngLat
            pathPointsRef.current = [initialPathPoint]

            polylineRef.current = new AMapGlobal.Polyline({
              path: pathPointsRef.current,
              strokeColor: '#3b82f6',
              strokeWeight: 4,
              strokeOpacity: 0.8,
              lineJoin: 'round',
              lineCap: 'round',
            })

            map.add(polylineRef.current)

            console.log('[AMap] Marker 和轨迹线已创建')
          } else {
            // Update existing marker
            markerRef.current.setPosition(lngLat)
          }

          // Update trace path
          pathPointsRef.current.push(lngLat)
          if (polylineRef.current) {
            polylineRef.current.setPath(pathPointsRef.current)
          }

          // STRICT RULE: Use setCenter instead of panTo for high-frequency MQTT stability
          map.setCenter(lngLat)
        } catch (e) {
          console.error('AMap Update Error:', e)
        }
      }
    )

    return () => {
      console.log('[AMap] 取消 GPS 订阅')
      unsub()
    }
  }, [mapReady])

  return (
    <>
      {/* <!-- SECTION:LOCATION --> */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold text-foreground">位置追踪</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Map */}
          <Card className="lg:col-span-2 border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Navigation className="h-4 w-4" />
                实时地图
              </CardTitle>
            </CardHeader>
            <CardContent className="h-full">
              {/* 上层容器仍然自适应，但不直接负责地图核心高度 */}
              <div className="w-full flex-1 min-h-[400px] md:min-h-[500px] rounded-xl relative bg-muted flex flex-col">
                {/* AMap Container */}
                <div
                  id="amap-container"
                  ref={mapContainerRef}
                  className="[&_.amap-layer_img]:max-w-none [&_.amap-marker_img]:max-w-none [&_canvas]:max-w-none"
                  style={{
                    width: '100%',
                    height: '600px',
                    minHeight: '600px',
                    position: 'relative',
                  }}
                />

                {/* Loading Overlay */}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted z-20">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">高德地图加载中...</p>
                    </div>
                  </div>
                )}

                {/* Overlay stats */}
                {mapReady && (
                  <>
                    <div className="absolute left-3 top-3 flex flex-col gap-2 z-10">
                      <Badge variant="secondary" className="text-xs font-mono bg-white/90 backdrop-blur-sm">
                        <Navigation className="mr-1.5 h-3 w-3" />
                        速度: 0 km/h
                      </Badge>
                      <Badge variant="secondary" className="bg-emerald-50/90 text-emerald-700 border-emerald-200 text-xs backdrop-blur-sm">
                        <Shield className="mr-1.5 h-3 w-3" />
                        区域: 安全
                      </Badge>
                    </div>

                    <div className="absolute bottom-3 right-3 z-10">
                      <Badge variant="secondary" className="font-mono text-[10px] bg-white/90 backdrop-blur-sm">
                        {gpsCoords
                          ? `${gpsCoords[1].toFixed(6)}°N, ${gpsCoords[0].toFixed(6)}°E`
                          : '等待 GPS...'}
                      </Badge>
                    </div>

                    <div className="absolute bottom-3 left-3 z-10">
                      <Badge variant="outline" className="text-[10px] bg-white/90 backdrop-blur-sm">
                        GCJ-02 (火星坐标系)
                      </Badge>
                      <Badge variant="secondary" className="mt-2 text-[10px] font-mono bg-white/90 backdrop-blur-sm">
                        LastSeen: {lastSeenAt ?? '-'}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Location History */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4" />
                位置历史
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {recentLocations.map((loc, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`mt-1 h-2.5 w-2.5 rounded-full ${
                          loc.status === "current"
                            ? "bg-primary ring-4 ring-primary/10"
                            : "bg-muted-foreground/30"
                        }`}
                      />
                      {i < recentLocations.length - 1 && (
                        <div className="mt-1 h-8 w-px bg-border" />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {loc.location}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {loc.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* <!-- /SECTION:LOCATION --> */}
    </>
  )
}
