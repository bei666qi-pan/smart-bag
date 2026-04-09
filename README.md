# Smart Schoolbag V5.0 - Digital Twin Dashboard

IoT 数字孪生仪表盘 — 实时传感器监测、视觉识别、位置追踪、交互中枢。

## 快速入口（联调必看）

- **软硬对接文档（主入口）**：`软硬对接文档.md`
- **架构**：`docs/ARCHITECTURE.md`
- **IoT 集成测试**：`docs/IOT_TESTING_GUIDE.md`
- **服务端守护进程状态（只读诊断）**：`/api/iot/daemon-status`

> 重要：**Broker 在线 ≠ 设备在线**。设备在线以 `v5/bag/status` 为准；页面刷新后的初始状态依赖 Redis/API。

## 技术栈

- **框架**: Next.js 16 (App Router) + React 19
- **状态管理**: Zustand
- **IoT 通信**: MQTT over WebSocket (mqtt.js)
- **地图**: 高德地图 JS API v2.0
- **UI**: shadcn/ui + Tailwind CSS v4 + Radix UI
- **AI**: Coze REST API v3

## 本地开发

```bash
pnpm install
pnpm dev
```

配置 `.env.local`（参考 `AGENTS.md` 中的环境变量说明）。

### 生产环境 MQTT 地址（标准写法）

- **硬件 MQTT（TCP）**：`mqtt.bag.versecraft.cn:1883`
- **浏览器 MQTT（WSS）**：`wss://mqtt.bag.versecraft.cn/mqtt`

## 🐳 Docker Deployment

### 环境要求

- Docker >= 20.10
- Docker Compose >= 2.0

### 快速启动

```bash
# 构建所有服务
docker compose build

# 启动完整 IoT 技术栈 (后台运行)
docker compose up -d
```

启动后访问:

| 服务 | 端口 | 说明 |
|------|------|------|
| Dashboard | 3000 | Next.js IoT 仪表盘 |
| MQTT (TCP) | 1883 | ESP32 硬件连接 |
| MQTT (WS) | 8083 | 前端 WebSocket |
| Redis | 6379 | 缓存服务 (Phase 3) |

### 传入环境变量

构建时的 `NEXT_PUBLIC_*` 变量通过 build args 传入:

```bash
NEXT_PUBLIC_AMAP_KEY=xxx NEXT_PUBLIC_AMAP_SECURITY_CODE=xxx docker compose build
```

运行时的服务端变量通过环境变量传入:

```bash
COZE_TOKEN=pat_xxx COZE_BOT_ID=7xxx docker compose up -d
```

### 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f web
docker compose logs -f mqtt

# 停止所有服务
docker compose down

# 停止并清除数据卷
docker compose down -v
```

### MQTT 测试

```bash
# 发送设备在线状态
docker compose exec mqtt mosquitto_pub -t "v5/bag/status" -m '{"status":"online"}'

# 发送传感器数据
docker compose exec mqtt mosquitto_pub -t "v5/bag/sensors" -m '{"battery":85,"temp":24,"humid":45}'

# 发送 GPS 坐标
docker compose exec mqtt mosquitto_pub -t "v5/bag/gps" -m '{"lat":31.2304,"lng":121.4737}'
```

## 项目文档

详细架构文档见 `docs/ARCHITECTURE.md`，IoT 测试指南见 `docs/IOT_TESTING_GUIDE.md`，软硬对接主文档见 `软硬对接文档.md`。
