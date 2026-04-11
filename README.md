# Smart Schoolbag V5.0

单仓库 Next.js 16 智能书包数字孪生面板，包含仪表盘、视觉、定位、交互，以及服务端 MQTT -> Redis 镜像链路。

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

## MQTT 地址约定

- 硬件 MQTT（TCP）：`mqtt.bag.versecraft.cn:1883`
- 浏览器 MQTT（WSS）：`wss://bag.versecraft.cn/mqtt`

不要把浏览器用的 `wss://.../mqtt` 直接交给硬件；硬件必须连接 TCP MQTT 端口。

## 关键环境变量

参考 [.env.example](C:/Users/21276/OneDrive/Desktop/智能书包/.env.example)：

- `NEXT_PUBLIC_MQTT_URL`
- `NEXT_PUBLIC_MQTT_PATH`
- `MQTT_SERVER_URL`
- `REDIS_URL`
- `NEXT_PUBLIC_AMAP_KEY`
- `NEXT_PUBLIC_AMAP_SECURITY_CODE`
- `NEXT_PUBLIC_ESP32_STREAM_URL`
- `NEWAPI_BASE_URL`
- `NEWAPI_API_KEY`

## 真实链路说明

- 浏览器实时状态来自 MQTT over WebSocket。
- 页面刷新后的初始状态来自 Redis/API，而不是浏览器内存。
- `/api/iot/status` 是 `/api/iot/state` 的别名。
- `/api/iot/daemon-status` 用于排查服务端守护进程是否已启动、Redis/MQTT 是否已连通、是否已订阅 `v5/bag/#`。
- `Broker 在线 != 设备在线`。设备在线只以 `v5/bag/status` 为准。

## 视频链路说明

- LAN 模式只适合同网段联调，直接读取 `NEXT_PUBLIC_ESP32_STREAM_URL`。
- HTTPS 页面下如果视频流还是 HTTP，会被浏览器按 Mixed Content 拦截。
- WAN 模式走 `/api/camera/latest` 快照上传与拉取。
- WAN 上传必须带 `x-device-token: bag_secret_2026`，并使用 `multipart/form-data` 字段 `image`。
- WAN 暂无快照时返回 `200 + JSON` 空态，不再用 404 表示“接口不存在”。

## 命令闭环

- 下行 topic：`v5/bag/cmd`
- ACK topic：`v5/bag/cmd/ack`
- 交互页里的“发送到设备”会真实调用 `publishCommand()` 下发 `screen_text`。
- 如果 AI 评估失败，IoT 调试面板仍可直接下发 `screen_text` / `mode_switch` 做硬件联调。
- 收到 ACK 后，调试面板和交互页状态都会更新。

## 相关文档

- [架构说明](C:/Users/21276/OneDrive/Desktop/智能书包/docs/ARCHITECTURE.md)
- [IoT 联调指南](C:/Users/21276/OneDrive/Desktop/智能书包/docs/IOT_TESTING_GUIDE.md)
- [软硬件对接文档](C:/Users/21276/OneDrive/Desktop/智能书包/软硬件对接文档.md)
