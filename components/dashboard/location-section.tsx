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
          center: DEFAULT_CENTER, // HARDCODED - Safe on mount
          mapStyle: 'amap://styles/normal',
          showLabel: true,
          features: ['bg', 'road', 'building', 'point'],
        })

        mapRef.current = map

        map.addControl(new AMap.Scale())
        map.addControl(new AMap.ToolBar({ position: 'RB' }))

        map.on('complete', () => {
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

  // BULLETPROOF Store Subscription
  useEffect(() => {
    if (!mapReady || !mapRef.current) return

    console.log('[AMap] 订阅 GPS 更新...')

    const unsub = useIoTStore.subscribe(
      (state) => state.gpsCoords,
      (coords) => {
        // ✅ BULLETPROOF Type and NaN Guard (EXACT as specified)
        if (!coords || !Array.isArray(coords) || coords.length !== 2) {
          console.warn('[AMap] 坐标无效: 非数组或长度错误', coords)
          return
        }
        
        if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number') {
          console.warn('[AMap] 坐标无效: 非数字类型', coords)
          return
        }
        
        if (Number.isNaN(coords[0]) || Number.isNaN(coords[1])) {
          console.warn('[AMap] 坐标无效: NaN 检测到', coords)
          return
        }

        // ✅ Additional range validation
        const [lng, lat] = coords
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          console.warn('[AMap] 坐标超出有效范围:', coords)
          return
        }

        // ✅ Safe to interact with AMap
        console.log('[AMap] 收到有效 GPS 坐标 (WGS-84):', coords)

        try {
          // WGS-84 to GCJ-02 conversion
          const converted = convertWgs84ToGcj02Coords(coords)
          
          // Validate conversion result
          if (!converted || !Array.isArray(converted) || converted.length !== 2) {
            console.error('[AMap] 坐标转换失败: 结果无效', converted)
            return
          }

          if (Number.isNaN(converted[0]) || Number.isNaN(converted[1])) {
            console.error('[AMap] 坐标转换失败: NaN 结果', converted)
            return
          }

          console.log('[AMap] 转换后坐标 (GCJ-02):', converted)

          const map = mapRef.current
          if (!map) return

          // Create marker if not exists
          if (!markerRef.current) {
            const AMap = (window as any).AMap
            if (!AMap) {
              console.error('[AMap] AMap 全局对象未找到')
              return
            }

            markerRef.current = new AMap.Marker({
              position: converted,
              icon: new AMap.Icon({
                size: new AMap.Size(32, 32),
                image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
                imageSize: new AMap.Size(32, 32),
              }),
              offset: new AMap.Pixel(-16, -32),
              title: '智能书包',
            })

            map.add(markerRef.current)

            // Initialize polyline
            polylineRef.current = new AMap.Polyline({
              path: [converted],
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
            markerRef.current.setPosition(converted)
          }

          // Update trace path
          pathPointsRef.current.push(converted)
          if (polylineRef.current) {
            polylineRef.current.setPath(pathPointsRef.current)
          }

          // Synchronous center update (no animations - prevents unmount race conditions)
          map.setCenter(converted)

        } catch (e) {
          console.error('[AMap] Marker Update Error:', e)
          toast.error('位置更新失败', {
            description: '坐标处理异常',
          })
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
            <CardContent>
              <div className="relative h-80 w-full overflow-hidden rounded-lg bg-muted">
                {/* AMap Container */}
                <div ref={mapContainerRef} className="absolute inset-0" />

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
                        31.2304°N, 121.4737°E
                      </Badge>
                    </div>

                    <div className="absolute bottom-3 left-3 z-10">
                      <Badge variant="outline" className="text-[10px] bg-white/90 backdrop-blur-sm">
                        GCJ-02 (火星坐标系)
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
