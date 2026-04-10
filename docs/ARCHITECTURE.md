# Smart Schoolbag V5.0 - IoT 核心架构文档

## 🏗️ 系统架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 15)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │   Dashboard  │───▶│    Vision    │───▶│   Location   │     │
│  │     Page     │    │     Page     │    │     Page     │     │
│  └──────────────┘    └──────────────┘    └──────────────┘     │
│         │                    │                    │             │
│         └────────────────────┼────────────────────┘             │
│                              ▼                                  │
│                    ┌──────────────────┐                         │
│                    │  Zustand Store   │                         │
│                    │  (Global State)  │                         │
│                    └──────────────────┘                         │
│                              ▲                                  │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│  ┌──────▼──────┐    ┌────────▼──────┐    ┌───────▼──────┐     │
│  │ useMqttClient│    │ AMap JS API   │    │ Server Action│     │
│  │   (Hook)     │    │(Zero-Render)  │    │  (NewAPI)    │     │
│  └──────────────┘    └───────────────┘    └──────────────┘     │
│         ▲                    ▲                    ▲             │
└─────────┼────────────────────┼────────────────────┼─────────────┘
          │                    │                    │
          │                    │                    │
┌─────────▼────────┐  ┌────────▼────────┐  ┌───────▼──────┐
│   MQTT Broker    │  │  GPS Module     │  │ NewAPI 网关  │
│  (Mosquitto/EMQ) │  │  (BeiDou/GPS)   │  │ (bag-image/  │
└──────────────────┘  └─────────────────┘  │  bag-text)   │
                                           └──────────────┘
          ▲                    ▲                    
          │                    │                    
┌─────────▼────────────────────▼────────┐
│         ESP32 IoT Device              │
│  ┌──────────┐  ┌──────────┐           │
│  │  Sensors │  │  Camera  │           │
│  └──────────┘  └──────────┘           │
└───────────────────────────────────────┘
```

---

## 🔌 1. MQTT 通信层

### 架构设计原则

**Golden Pattern B: Strict-Mode Safe MQTT Hook**

#### 关键实现点

1. **Singleton Lock (防止僵尸连接)**
```typescript
const clientRef = useRef<MqttClient | null>(null)

useEffect(() => {
  // Idempotency Check
  if (clientRef.current) return
  
  const client = mqtt.connect(...)
  clientRef.current = client
  
  return () => {
    if (clientRef.current) {
      client.end(true) // 强制关闭
      clientRef.current = null
    }
  }
}, []) // 空依赖数组
```

2. **Topic 订阅架构**
```typescript
topics: {
  lwt: 'v5/bag/status',      // 设备在线/离线状态
  sensors: 'v5/bag/sensors', // 传感器数据 (温湿度/电量)
  gps: 'v5/bag/gps',         // GPS 坐标
  cmd: 'v5/bag/cmd',         // 下发命令 (id/action/value)
  cmdAck: 'v5/bag/cmd/ack',  // ACK (cmd_id/status/msg)
}
```

3. **消息格式规范**

**LWT Status:**
```json
{
  "status": "online" | "offline"
}
```

**Sensor Data:**
```json
{
  "battery": 85,  // 0-100
  "temp": 24,     // 摄氏度
  "humid": 45     // 百分比
}
```

**GPS Coordinates:**
```json
{
  "lat": 31.2304,  // 纬度
  "lng": 121.4737  // 经度
}
```

**Downlink Command (v5/bag/cmd):**
```json
{
  "id": "uuid",
  "action": "mode_switch" | "screen_text",
  "value": "focus_mode" | "normal_mode" | "..."
}
```

**Command ACK (v5/bag/cmd/ack):**
```json
{
  "cmd_id": "same-as-id",
  "status": 0,
  "msg": "OK"
}
```

### 状态管理集成

```typescript
// MQTT Hook 直接更新 Zustand Store
client.on('message', (topic, payload) => {
  const data = JSON.parse(payload.toString())
  
  if (topic === 'v5/bag/sensors') {
    setBattery(data.battery)
    setTemp(data.temp)
    setHumid(data.humid)
  }
})
```

> 重要：**MQTT Broker 连接成功 ≠ 设备在线**。设备在线仅以 `v5/bag/status` 的 `online/offline` 为准；API 初始化状态仅用于展示“初始拉取是否成功”，不应覆盖前两者语义。

### 错误处理

- **连接失败**: Toast 提示 "MQTT 连接错误"
- **重连机制**: `reconnectPeriod: 5000`
- **离线检测**: `client.on('offline')` → 更新 UI 状态

---

## 📹 2. Vision Pipeline

### Dual-Mode Architecture

#### 模式 A: 局域网 (LAN)
```
ESP32-CAM → MJPEG Stream → <img src="http://esp32_ip:81/stream" />
```

**优势:**
- 零延迟
- 高帧率 (30fps)
- 无服务器成本

**限制:**
- 需要同一局域网
- 无法远程访问

#### 模式 B: 广域网 (WAN)
```
ESP32-CAM → HTTP POST → Next.js API → 
  File System → React Polling → <img src="/api/camera/latest" />
```

**优势:**
- 公网访问
- NAT 穿透解决方案

**限制:**
- 延迟 ~2s (polling interval)
- 服务器存储开销

### AI Analysis Pipeline

```
User Click "AI 分析" → 
  Capture Frame → 
    FormData → 
      Server Action → 
        Buffer.from(arrayBuffer()) → 
          Base64 Encode →
            bag-image (NewAPI / chat/completions) →
              Structured JSON →
                bag-text (NewAPI / chat/completions) →
                  Analysis Result →
                    Update UI
```

#### NewAPI 调用 (Native Fetch)

**CRITICAL: 不使用 SDK，直接 fetch OpenAI-compatible 接口**

```typescript
const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.NEWAPI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'bag-image',
    messages,
    response_format: { type: 'json_object' },
  }),
})
```

### Body Size Limit 配置

```javascript
// next.config.mjs
experimental: {
  serverActions: {
    bodySizeLimit: '10mb', // 支持高分辨率图片
  },
}
```

---

## 🗺️ 3. Zero-Render AMap Integration

### Golden Pattern D: Imperative Updates

#### 架构核心原则

**❌ 错误方式 (导致重渲染):**
```typescript
const [coords, setCoords] = useState([lng, lat])

useEffect(() => {
  marker.setLngLat(coords) // React 重渲染整个组件!
}, [coords])
```

**✅ 正确方式 (零渲染):**
```typescript
// 直接订阅 Zustand Store
useEffect(() => {
  const unsubscribe = useIoTStore.subscribe(
    (state) => state.gpsCoords, // Selector
    (coords) => {
      // 命令式更新 (不触发 React 渲染)
      markerRef.current?.setLngLat(coords)
      mapRef.current?.flyTo({ center: coords })
    }
  )
  return unsubscribe
}, [])
```

### 关键技术细节

1. **初始化 (仅一次)**
```typescript
const mapRef = useRef<any | null>(null)
const markerRef = useRef<any | null>(null)

useEffect(() => {
  if (mapRef.current) return // 防止重复初始化
  
  const map = new (window as any).AMap.Map(mapContainerRef.current, { zoom: 15 })
  
  mapRef.current = map
}, [])
```

2. **安全检查**
```typescript
const key = process.env.NEXT_PUBLIC_AMAP_KEY
const security = process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE

if (!key || !security) {
  toast.error('地图配置错误')
  return
}
```

---

## 🏪 4. Zustand Global State

### State Schema

```typescript
interface IoTState {
  // MQTT Connection
  lwtStatus: 'online' | 'offline'
  setLwtStatus: (status: 'online' | 'offline') => void

  // Sensors
  battery: number
  temp: number
  humid: number
  setBattery: (value: number) => void
  setTemp: (value: number) => void
  setHumid: (value: number) => void

  // GPS
  gpsCoords: [number, number] | null // [lng, lat]
  setGpsCoords: (coords: [number, number]) => void
}
```

### 消费方式

#### 方式 A: React Hook (会触发重渲染)
```typescript
const { battery, temp, humid } = useIoTStore()
```

#### 方式 B: Direct Subscribe (零渲染)
```typescript
useEffect(() => {
  const unsub = useIoTStore.subscribe(
    (state) => state.gpsCoords,
    (coords) => {
      // Imperative update
    }
  )
  return unsub
}, [])
```

---

## 🌐 5. 环境变量配置

### 必需变量

```bash
# MQTT
NEXT_PUBLIC_MQTT_URL=wss://mqtt.bag.versecraft.cn/mqtt
NEXT_PUBLIC_MQTT_PATH=/mqtt

# MQTT (Server daemon, TCP)
MQTT_SERVER_URL=mqtt://mqtt.bag.versecraft.cn:1883

# AMap
NEXT_PUBLIC_AMAP_KEY=your_key
NEXT_PUBLIC_AMAP_SECURITY_CODE=your_security_code

# NewAPI AI
NEWAPI_BASE_URL=https://newkey.versecraft.cn
NEWAPI_API_KEY=sk_xxx...

# ESP32
NEXT_PUBLIC_ESP32_STREAM_URL=http://<YOUR_STREAM_HOST>/stream
```

### 安全规范

1. **Public vs Private:**
   - `NEXT_PUBLIC_*`: 暴露给客户端 (AMap, MQTT URL)
   - 无前缀: 仅服务器端 (NewAPI API Key 等敏感配置)

2. **Token 管理:**
   - NewAPI API Key: 服务器端专用
   - AMap Key: Public,但需要配置域名白名单与安全密钥

---

## 🎨 6. UI 本地化规范

### Toast 消息 (简体中文)

```typescript
// ✅ 正确
toast.success('MQTT 连接成功', {
  description: '设备通信已建立',
})

// ❌ 错误
toast.success('MQTT Connected', {
  description: 'Device communication established',
})
```

### 错误消息

```typescript
return {
  success: false,
  message: 'NewAPI 配置缺失', // ✅ 中文
}
```

### UI 标签

```typescript
// ✅ 所有用户可见文本为中文
<Label>广域网</Label>
<Button>AI 分析</Button>
<Badge>设备在线</Badge>
```

---

## 🔧 7. 技术栈总结

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **框架** | Next.js | 16.1.6 | App Router + Server Actions |
| **状态管理** | Zustand | 5.0.11 | 全局 IoT 状态 |
| **IoT 通信** | mqtt.js | Latest | WebSocket MQTT 客户端 |
| **地图渲染** | AMap JS API | Latest | 零渲染地图更新 |
| **AI 推理** | NewAPI | OpenAI-compatible | `bag-image` + `bag-text` 双模型 |
| **UI 组件** | shadcn/ui | - | Radix UI 封装 |
| **提示组件** | sonner | 1.7.1 | Toast 通知 |

---

## 📊 8. 性能指标

### 目标性能

- **MQTT 延迟**: < 50ms
- **GPS 更新频率**: 1-2 Hz
- **地图渲染**: 0 React re-renders
- **Vision 流**: 30 fps (LAN) / 0.5 fps (WAN)
- **AI 分析**: < 3s（目标值，取决于 NewAPI 后台模型与网络）

### 监控要点

1. **React DevTools Profiler**
   - Location 页面 GPS 更新时无 Commit
   - Vision 页面切换模式时仅一次渲染

2. **Network Tab**
   - MQTT WebSocket 保持连接
   - WAN 模式每 2s 一次 GET 请求
   - AI 分析 POST body size < 5MB

3. **Console Logs**
```
[MQTT] 连接成功
[MQTT] GPS 更新: [121.4737, 31.2304]
[AMap] 地图加载完成
[NewAPI] 正在调用 bag-image / bag-text...
```

---

## 🚀 9. 部署检查清单

### 开发环境
- [x] 安装 Mosquitto (本地 MQTT Broker)
- [x] 配置 `.env.local`
- [x] 配置 AMap Key
- [x] 配置可用的 NewAPI 网关与别名模型

### 生产环境
- [ ] 使用云端 MQTT (HiveMQ Cloud / EMQ X Cloud)
- [ ] 配置 MQTT TLS 加密
- [ ] 配置 AMap Key 域名白名单
- [ ] NewAPI 调用限流与告警
- [ ] Nginx 反向代理 ESP32 流
- [ ] 日志收集 (Winston)
- [ ] 错误监控 (Sentry)

---

## 📖 10. 下一步增强

### Phase 3 计划

1. **地理围栏 (Geofencing)**
   - Turf.js `@turf/boolean-point-in-polygon`
   - 安全区域越界警报

2. **历史轨迹回放**
   - 时间轴控件
   - 平滑动画插值

3. **离线缓存**
   - IndexedDB 存储最近 GPS 点
   - PWA Service Worker

4. **多设备支持**
   - 设备 ID 动态切换
   - MQTT Topic 前缀匹配

5. **实时视频 (WebRTC)**
   - 替代 MJPEG Polling
   - 双向语音对讲

---

**文档版本:** v2.0  
**最后更新:** 2026-03-02  
**维护者:** Smart Schoolbag Team
