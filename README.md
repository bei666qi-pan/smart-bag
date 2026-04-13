# Smart Schoolbag V5.0

智能书包 V5.0 是一个面向儿童安全与家校协同场景的 IoT 数字孪生仪表盘。项目把真实硬件上报的电量、温湿度、GPS、摄像头画面与设备指令回执接入到 Web 端，并通过 AI 对图像和文字进行辅助分析，形成“硬件 -> 云端 -> 前端 -> AI -> 设备反馈”的完整闭环。

在线地址：[https://bag.versecraft.cn](https://bag.versecraft.cn)

## 项目速览

| 维度 | 内容 |
| --- | --- |
| 项目定位 | Next.js 16 App Router 单体应用，作为智能书包硬件的实时数字孪生面板 |
| 核心价值 | 帮助家长/老师查看书包在线状态、环境数据、定位轨迹、摄像头快照与屏幕消息下发结果 |
| 技术栈 | Next.js 16、React 19、TypeScript、Zustand、MQTT.js、Redis、AMap、NewAPI、Tailwind CSS、shadcn/ui |
| 实时链路 | ESP32/硬件通过 MQTT TCP 上报，浏览器通过 MQTT over WebSocket 订阅，服务端守护进程把最新状态镜像到 Redis |
| AI 能力 | `bag-image` 识别书包相关图像，`bag-text` 生成中文分析、建议与设备屏幕短文案 |
| 工程亮点 | 实时 IoT、刷新后状态恢复、定位坐标转换、AI 结构化输出校验、设备命令 ACK 闭环、生产环境 WSS/Mixed Content 处理 |

## 解决的问题

传统“智能硬件系统”容易停留在硬件串口或静态页面，使用者很难直观看到整条链路是否真的打通。这个项目把硬件状态、地图定位、摄像头快照、AI 分析和命令下发都放在同一个可访问的 Web 面板里，重点体现工程落地能力：

- 真实设备数据通过 MQTT Topic 进入系统，而不是前端假数据。
- 页面刷新后仍可通过 Redis/API 恢复最近一次设备状态。
- 浏览器连接 Broker 和设备本身在线状态分开展示，避免误判。
- AI 结果经过 JSON 解析和 Zod 校验，失败时返回可读的中文错误。
- 下发给设备的 `screen_text` / `mode_switch` 命令会等待硬件 ACK，形成可追踪闭环。

## 功能模块

| 模块 | 能力 | 设计要点 |
| --- | --- | --- |
| 仪表盘总览 | 展示 Broker 连接、设备在线、电量、温度、湿度、GPS、最近上报时间、最近 ACK | 解释“连接到 Broker 不等于设备在线”的状态建模 |
| 位置追踪 | 接收 WGS-84 GPS 坐标，转换为 GCJ-02 后在 AMap 展示，并维护轨迹线 | 展示国内地图坐标系适配与动态加载地图 SDK |
| 视觉中心 | 支持局域网 ESP32 视频流与广域网快照接口，触发 `bag-image` + `bag-text` 双模型分析 | 展示真实图像输入、结构化结果校验和空状态处理 |
| 互动中心 | 输入家长消息，AI 润色为适合设备屏幕展示的短文案，再通过 MQTT 下发 | 展示 AI 不是直接控制硬件，而是经过用户确认和 ACK |
| 专注模式 | 提供专注计时和 `mode_switch` 调试命令 | 展示硬件联调入口与命令抽象 |
| 诊断接口 | `/api/iot/daemon-status` 输出 Redis、MQTT、订阅状态和最近镜像 Topic | 展示线上排障能力 |

## 系统架构

```text
ESP32 / 智能书包硬件
  -> MQTT TCP: mqtt.bag.versecraft.cn:1883
  -> topics: v5/bag/status, v5/bag/sensors, v5/bag/gps, v5/bag/cmd/ack

Browser / Dashboard
  -> MQTT WSS: wss://bag.versecraft.cn/mqtt
  -> Zustand 保存实时 UI 状态
  -> 可发布 v5/bag/cmd 下行命令

Next.js Server
  -> Server Actions 调用 NewAPI: bag-image / bag-text
  -> API Routes 提供 IoT 状态、摄像头快照和守护进程诊断

MQTT -> Redis Mirror
  -> instrumentation.ts 启动守护进程
  -> 订阅 v5/bag/#
  -> 写入 Redis Hash: bag:latest
  -> 页面刷新时由 /api/iot/state 恢复最近状态
```

## 数据与 Topic 约定

| Topic | 方向 | 示例含义 |
| --- | --- | --- |
| `v5/bag/status` | 设备 -> 系统 | `{ "status": "online" }` 或 `{ "status": "offline" }` |
| `v5/bag/sensors` | 设备 -> 系统 | `{ "battery": 85, "temp": 24, "humid": 45 }` |
| `v5/bag/gps` | 设备 -> 系统 | `{ "lat": 31.2304, "lng": 121.4737 }` |
| `v5/bag/cmd` | 系统 -> 设备 | `{ "id": "uuid", "action": "screen_text", "value": "记得喝水" }` |
| `v5/bag/cmd/ack` | 设备 -> 系统 | `{ "cmd_id": "uuid", "status": 0, "msg": "OK" }` |

## AI 分析链路

```text
摄像头画面 / 快照
  -> bag-image 输出 objects、scene、risks、confidence、raw_summary
  -> Zod 校验结构化结果
  -> bag-text 生成中文 analysis、suggestion、screen_text、severity
  -> 页面展示结论，必要时将 screen_text 下发到设备屏幕
```

文字互动链路：

```text
用户输入家长消息
  -> bag-text 润色和风险判断
  -> 用户确认
  -> MQTT publish 到 v5/bag/cmd
  -> 设备执行并发布 v5/bag/cmd/ack
  -> UI 清理 pending command 并展示最近 ACK
```

## 线上体验路径

可以按这个顺序体验核心链路：

1. 打开 [https://bag.versecraft.cn](https://bag.versecraft.cn)，进入智能书包硬件的数字孪生面板。
2. 在仪表盘总览中说明 Broker 连接、设备在线、电量/温湿度、GPS、ACK 是不同层级的状态。
3. 用 MQTT 发布一条 `v5/bag/sensors` 或 `v5/bag/gps` 测试数据，展示前端实时更新。
4. 切到位置追踪页，说明 WGS-84 上报坐标会转换为高德地图使用的 GCJ-02。
5. 切到视觉中心，说明局域网视频流和广域网快照两种模式，以及 `bag-image -> bag-text` 的 AI 链路。
6. 切到互动中心，输入一句家长消息，展示 AI 生成设备屏幕短文案，再下发到硬件并等待 ACK。
7. 最后打开 `/api/iot/daemon-status`，查看生产环境可观测性和故障定位信息。

## 快速开始

```bash
pnpm install
pnpm dev
```

常用命令：

```bash
pnpm dev
pnpm build
pnpm lint
pnpm start
```

项目默认开发端口为 `3000`。

## 环境变量

只填写你自己的密钥或服务地址，不要把真实密钥提交到仓库。

| 变量 | 说明 | 是否必需 |
| --- | --- | --- |
| `NEXT_PUBLIC_MQTT_URL` | 浏览器连接的 MQTT WebSocket 地址，例如 `wss://bag.versecraft.cn/mqtt` | 核心功能必需 |
| `NEXT_PUBLIC_MQTT_PATH` | MQTT WebSocket path，默认 `/mqtt` | 可选 |
| `MQTT_SERVER_URL` | 服务端守护进程连接的 MQTT TCP 地址，例如 `mqtt://mqtt.bag.versecraft.cn:1883` | Redis 镜像必需 |
| `REDIS_URL` | Redis 连接地址，用于保存最新设备快照 | Redis 镜像必需 |
| `NEXT_PUBLIC_AMAP_KEY` | 高德地图 Web JS API Key | 位置页必需 |
| `NEXT_PUBLIC_AMAP_SECURITY_CODE` | 高德地图安全密钥 | 位置页必需 |
| `NEXT_PUBLIC_ESP32_STREAM_URL` | 局域网 ESP32 摄像头视频流地址 | 视觉页 LAN 模式可选 |
| `NEWAPI_BASE_URL` | NewAPI 服务地址 | AI 功能必需 |
| `NEWAPI_API_KEY` | NewAPI 密钥 | AI 功能必需 |

## 本地 IoT 联调

本地需要安装 Mosquitto，并启动同时支持 TCP 与 WebSocket 的 Broker：

```bash
mosquitto -c mosquitto.conf
```

然后在 `.env.local` 中配置：

```bash
NEXT_PUBLIC_MQTT_URL=ws://localhost:8083/mqtt
NEXT_PUBLIC_MQTT_PATH=/mqtt
MQTT_SERVER_URL=mqtt://localhost:1883
REDIS_URL=redis://localhost:6379
```

发布测试数据：

```bash
mosquitto_pub -h localhost -t "v5/bag/status" -m '{"status":"online"}'
mosquitto_pub -h localhost -t "v5/bag/sensors" -m '{"battery":85,"temp":24,"humid":45}'
mosquitto_pub -h localhost -t "v5/bag/gps" -m '{"lat":31.2304,"lng":121.4737}'
```

下发设备屏幕消息：

```bash
mosquitto_pub -h localhost -t "v5/bag/cmd" -m '{"id":"demo-1","action":"screen_text","value":"记得喝水"}'
mosquitto_pub -h localhost -t "v5/bag/cmd/ack" -m '{"cmd_id":"demo-1","status":0,"msg":"OK"}'
```

## 摄像头链路

视觉中心支持两种输入：

- LAN 模式：直接读取 `NEXT_PUBLIC_ESP32_STREAM_URL`。适合同一局域网调试；如果页面是 HTTPS，而视频流是 HTTP，浏览器会因为 Mixed Content 拦截。
- WAN 模式：硬件上传快照到 `POST /api/camera/latest`，浏览器轮询 `GET /api/camera/latest`。上传需要请求头 `x-device-token`，表单字段名为 `image`。

## 相关文档

- [架构说明](docs/ARCHITECTURE.md)
- [IoT 联调指南](docs/IOT_TESTING_GUIDE.md)
- [软硬件对接文档](软硬件对接文档.md)
- [AMap 迁移说明](docs/AMAP_MIGRATION.md)
