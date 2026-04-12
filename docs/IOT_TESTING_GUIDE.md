# IoT 联调指南

本文档按当前仓库真实代码编写，适用于 Smart Schoolbag V5.0 的软硬件联调、AI 评估排障和 Camera WAN 快照测试。

## 1. MQTT 地址

- 硬件 MQTT（TCP）：`mqtt.bag.versecraft.cn:1883`
- 浏览器 MQTT（WSS）：`wss://bag.versecraft.cn/mqtt`

硬件只连接 TCP 地址；浏览器页面只使用 WSS 地址。不要把 `wss://.../mqtt` 交给 ESP32 或其他硬件客户端。

## 2. 本地 Broker 示例

Mosquitto 配置示例：

```conf
listener 1883
listener 8083
protocol websockets
allow_anonymous true
```

本地环境变量示例：

```bash
NEXT_PUBLIC_MQTT_URL=ws://localhost:8083/mqtt
NEXT_PUBLIC_MQTT_PATH=/mqtt
MQTT_SERVER_URL=mqtt://localhost:1883
REDIS_URL=redis://localhost:6379
```

## 3. 测试数据发布

### 设备在线 / 离线

```bash
mosquitto_pub -h localhost -t "v5/bag/status" -m '{"status":"online"}'
mosquitto_pub -h localhost -t "v5/bag/status" -m '{"status":"offline"}'
```

### 传感器数据

```bash
mosquitto_pub -h localhost -t "v5/bag/sensors" -m '{"battery":75,"temp":26,"humid":50}'
```

### GPS 数据

```bash
mosquitto_pub -h localhost -t "v5/bag/gps" -m '{"lat":31.2304,"lng":121.4737}'
mosquitto_pub -h localhost -t "v5/bag/gps" -m '{"lat":31.2310,"lng":121.4740}'
```

### 下行命令与设备回执

下行命令 topic：

```text
v5/bag/cmd
```

设备回执 topic：

```text
v5/bag/cmd/ack
```

命令示例：

```json
{ "id": "uuid", "action": "screen_text", "value": "记得带作业本" }
```

也支持：

```json
{ "id": "uuid", "action": "mode_switch", "value": "focus_mode" }
```

回执示例：

```json
{ "cmd_id": "uuid", "status": 0, "msg": "OK" }
```

前端会用 `cmd_id` 匹配正在等待设备确认的命令，匹配后更新最近设备回执。

## 4. UI 验证

### 仪表盘

- 连接状态只表示浏览器是否连上 Broker。
- 设备状态只以 `v5/bag/status` 为准。
- 传感器卡片显示真实数值或空态，不再用假 CPU / memory / bag item 占位。

### 位置页

- 坐标文本跟随 `gpsCoords`。
- Marker 跟随最新坐标移动。
- 地图中心跟随最新坐标移动。

### 交互页

- 标准流程：输入原始消息 -> `AI 评估` -> 生成适合设备屏幕显示的短文本 -> 用户确认 -> `发送到设备`。
- `AI 评估` 实际调用服务端 `bag-text`，依赖 `NEWAPI_BASE_URL` / `NEWAPI_API_KEY`。
- 当前代码不再依赖 Coze。
- `bag-text` 可能不支持 `response_format=json_object`。代码已对 `bag-text` 关闭强制 `response_format`，改用 system prompt 约束 JSON 输出，再用 `parseModelJSON()` 解析；`lib/newapi.ts` 也能在模型报“不支持 json_object”时去掉 `response_format` 重试一次。
- `发送到设备` 只有在连接已建立、设备在线、有可发送短文本且没有等待确认的命令时才会开启。
- 如果 `AI 评估` 失败，页面会在按钮附近提示“AI 暂时不可用”。这不代表设备通信链路损坏。
- AI 失败后，可展开 `高级调试与设备控制`，直接发送 `screen_text` 或 `mode_switch` 做硬件联调。

## 5. 部署诊断接口

### `/api/iot/state`

读取 Redis 中 `bag:latest` 的最新镜像值，并返回状态、传感器、GPS 和 `lastSeenAt`。如果 Redis 未配置或不可用，会返回离线空态和 `error` 字段，不会伪装成设备在线。

### `/api/iot/status`

`/api/iot/state` 的别名，便于旧调用路径继续工作。

### `/api/iot/daemon-status`

只读诊断接口，用来判断服务端守护进程是否启动、Redis/MQTT 是否配置并连接、是否订阅 `v5/bag/#`：

```json
{
  "started": true,
  "starting": false,
  "redisConfigured": true,
  "mqttServerConfigured": true,
  "redisConnected": true,
  "mqttConnected": true,
  "subscribed": true,
  "lastMirroredAt": "2026-04-11T10:20:30.000Z",
  "lastMirroredTopic": "v5/bag/gps",
  "lastError": null
}
```

这个接口用于观测部署状态，不会泄露 Redis URL、MQTT URL、API key 或 token。

## 6. 重要语义

- `Broker 在线 != 设备在线`。
- 页面刷新后的初始状态来自 Redis/API，不来自浏览器内存。
- 浏览器 MQTT 已连接，只说明浏览器连上了 Broker。
- `/api/iot/status` 缺数据时，优先检查 Redis 和服务端 daemon，不要直接判定前端订阅坏了。

## 7. 视频与 Camera WAN 测试

### LAN 模式

- 使用 `NEXT_PUBLIC_ESP32_STREAM_URL`。
- 只适合同网段联调。
- HTTPS 页面如果读取 HTTP 视频流，会被浏览器按 Mixed Content 拦截。
- 生产公网环境不建议直接依赖局域网地址。

### WAN 快照模式

- 设备上传快照：`POST /api/camera/latest`
- 浏览器读取快照：`GET /api/camera/latest`
- 适合远程环境或无法直连 ESP32 局域网视频流的场景。
- 上传 Header：`x-device-token: bag_secret_2026`
- `bag_secret_2026` 是当前代码默认设备令牌。
- 上传 Body：`multipart/form-data`，字段名必须是 `image`。
- 缺少或错误 token 返回 `401` 和 `{ "success": false, "message": "Unauthorized Device" }`。
- 暂无快照返回 `200` 和 `{ "success": true, "hasSnapshot": false, "message": "暂无快照", "timestamp": null }`。

## 8. 建议验证顺序

1. 打开 `/api/iot/daemon-status`，确认 `started=true` 且 `subscribed=true`。
2. 发布 `v5/bag/status`，确认 UI 设备状态变化。
3. 发布 `v5/bag/sensors`，确认仪表盘卡片更新。
4. 发布 `v5/bag/gps`，确认位置页坐标、marker 和地图中心更新。
5. 在交互页输入消息，点击 `AI 评估`，确认能生成设备屏幕短文本；如果 AI 失败，展开 `高级调试与设备控制` 手动输入并发送。
6. 发送 `screen_text` 后，发布 `v5/bag/cmd/ack`，确认等待确认状态清空，最近设备回执更新。
7. 测试 Camera WAN：用 `x-device-token: bag_secret_2026` 和 `image` 字段 POST 图片到 `/api/camera/latest`，再用 GET 拉取最新快照。
