# IoT 集成测试指南

## 1. MQTT 测试

### 线上/现网 MQTT 地址说明

- **硬件 MQTT (TCP)**: `mqtt.bag.versecraft.cn:1883`
- **前端 MQTT (WebSocket)**: `wss://mqtt.bag.versecraft.cn`（如有路径以服务端实际配置为准）

### 安装 Mosquitto (本地测试)

**Windows:**
```bash
# 使用 Chocolatey
choco install mosquitto

# 启动 Broker (支持 WebSocket)
mosquitto -c mosquitto.conf
```

**mosquitto.conf 示例:**
```conf
listener 1883
listener 8083
protocol websockets
allow_anonymous true
```

### 发布测试消息

#### LWT Status (设备在线/离线)
```bash
# 设备在线
mosquitto_pub -h localhost -t "v5/bag/status" -m '{"status":"online"}'

# 设备离线
mosquitto_pub -h localhost -t "v5/bag/status" -m '{"status":"offline"}'
```

#### 传感器数据
```bash
mosquitto_pub -h localhost -t "v5/bag/sensors" -m '{"battery":75,"temp":26,"humid":50}'
```

#### GPS 坐标
```bash
# 上海人民广场
mosquitto_pub -h localhost -t "v5/bag/gps" -m '{"lat":31.2304,"lng":121.4737}'

# 学校位置示例
mosquitto_pub -h localhost -t "v5/bag/gps" -m '{"lat":31.2400,"lng":121.4800}'
```

#### 命令下发与 ACK（最小闭环）

- **下发**: `v5/bag/cmd`
- **ACK**: `v5/bag/cmd/ack`

下发命令结构（与软硬对接协议一致）：

```json
{"id":"<uuid>","action":"mode_switch","value":"focus_mode"}
```

```json
{"id":"<uuid>","action":"mode_switch","value":"normal_mode"}
```

```json
{"id":"<uuid>","action":"screen_text","value":"上课专注模式已开启"}
```

ACK 结构兼容示例:

```json
{"cmd_id":"abc-123","status":0,"msg":"OK"}
```

> 说明：前端内部会把 `id` 作为 `cmd_id` 跟踪 pending 命令；**Broker 已连接 ≠ 设备在线**（设备在线以 `v5/bag/status` 为准）。

---

## 2. Vision Pipeline 测试

### ESP32 局域网模式

**硬件准备:**
- ESP32-CAM 模块
- 固件: [ESP32-CAM MJPEG Streamer](https://github.com/espressif/esp32-camera)

**配置 ESP32:**
```cpp
// 设置 MJPEG 流端点
server.on("/stream", HTTP_GET, handle_jpg_stream);
```

**测试:**
```bash
# 浏览器访问
http://<ESP32_IP>:81/stream
```

> 说明: **局域网直连仅适合开发/同网段测试**。生产环境不应默认依赖 `192.168.x.x`，建议通过公网代理/中转或使用“广域网模式”走 `/api/camera/latest` 快照链路。

### 广域网模式 (ESP32 上传快照)

**ESP32 POST 请求示例 (Arduino):**
```cpp
#include <HTTPClient.h>

void uploadSnapshot() {
  HTTPClient http;
  http.begin("http://your-domain.com/api/camera/latest");
  http.addHeader("Content-Type", "multipart/form-data");
  
  // Capture image
  camera_fb_t *fb = esp_camera_fb_get();
  
  // Create form data
  String boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
  String formData = "--" + boundary + "\r\n";
  formData += "Content-Disposition: form-data; name=\"image\"; filename=\"snapshot.jpg\"\r\n";
  formData += "Content-Type: image/jpeg\r\n\r\n";
  
  // Send POST
  http.POST((uint8_t*)formData.c_str(), fb->len);
  
  esp_camera_fb_return(fb);
  http.end();
}
```

**测试上传:**
```bash
curl -X POST http://localhost:3000/api/camera/latest \
  -F "image=@test.jpg"
```

**获取快照:**
```bash
curl http://localhost:3000/api/camera/latest > latest.jpg
```

---

## 3. Coze AI 集成测试

### 获取 Coze Token

1. 访问 [Coze 开放平台](https://www.coze.cn/open/oauth/apps)
2. 创建应用获取 `Access Token`
3. 创建 Bot 获取 `Bot ID`
4. 配置环境变量:

```bash
COZE_TOKEN=pat_xxx...
COZE_BOT_ID=7xxx...
```

### 测试 Server Action

**前端触发 (在 Vision 页面点击 "AI 分析" 按钮)**

**手动测试 API:**
```bash
curl -X POST https://api.coze.cn/v3/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bot_id": "YOUR_BOT_ID",
    "user_id": "test_user",
    "stream": false,
    "additional_messages": [
      {
        "role": "user",
        "content": "请分析这张图片",
        "content_type": "text"
      }
    ]
  }'
```

---

## 4. AMap(高德) 地图测试

### 配置 AMap Key 与安全密钥

在 `.env.local` 配置:

```bash
NEXT_PUBLIC_AMAP_KEY=your_key
NEXT_PUBLIC_AMAP_SECURITY_CODE=your_security_code
```

### 域名白名单说明（解决 INVALID_USER_DOMAIN）

请在高德控制台为 Key 配置域名白名单，至少包含:

- `localhost`
- `bag.versecraft.cn`

### 测试 GPS 实时更新

**模拟移动轨迹:**
```bash
# 连续发送 GPS 点形成路径
mosquitto_pub -h localhost -t "v5/bag/gps" -m '{"lat":31.2304,"lng":121.4737}'
sleep 2
mosquitto_pub -h localhost -t "v5/bag/gps" -m '{"lat":31.2310,"lng":121.4740}'
sleep 2
mosquitto_pub -h localhost -t "v5/bag/gps" -m '{"lat":31.2315,"lng":121.4745}'
```

**验证 Zero-Render:**
- 打开浏览器 DevTools -> Performance
- 开始录制
- 发送 10+ 个 GPS 点
- 停止录制
- **预期结果:** 地图标记移动,但 React 组件无重新渲染 (Zustand 订阅直接更新 DOM)

---

## 5. 集成测试脚本

### 完整端到端测试

**test-iot-pipeline.sh:**
```bash
#!/bin/bash

echo "=== 智能书包 IoT 集成测试 ==="

# 1. MQTT 连接测试
echo "1️⃣ 测试 MQTT 连接..."
mosquitto_pub -h localhost -t "v5/bag/status" -m '{"status":"online"}'
sleep 1

# 2. 传感器数据
echo "2️⃣ 发送传感器数据..."
mosquitto_pub -h localhost -t "v5/bag/sensors" -m '{"battery":90,"temp":25,"humid":48}'
sleep 1

# 3. GPS 轨迹
echo "3️⃣ 模拟 GPS 轨迹..."
for i in {1..5}; do
  lat=$(echo "31.2304 + $i * 0.001" | bc)
  lng=$(echo "121.4737 + $i * 0.001" | bc)
  mosquitto_pub -h localhost -t "v5/bag/gps" -m "{\"lat\":$lat,\"lng\":$lng}"
  sleep 2
done

# 4. 上传测试图片
echo "4️⃣ 测试图片上传..."
curl -X POST http://localhost:3000/api/camera/latest \
  -F "image=@test-image.jpg"

echo "✅ 测试完成!"
```

---

## 6. 预期行为

### ✅ 成功指标

1. **MQTT 连接**
   - TopBar 显示 "MQTT 在线" 绿色徽章
   - Toast 提示 "MQTT 连接成功"
   - TopBar 额外显示 **API 拉取状态** 与 **设备在线状态**（三态区分）

2. **传感器数据**
   - TopBar 实时更新温度、湿度、电量
   - Dashboard 卡片同步更新

3. **Vision Pipeline**
   - 局域网模式: 显示 ESP32 实时流
   - 广域网模式: 每 2 秒刷新快照
   - AI 分析: 点击按钮后显示 Coze 返回结果

4. **Location Tracking**
   - 地图加载 AMap(高德) 底图
   - GPS 点发布后,蓝色 Marker 移动
   - 轨迹线实时绘制
   - **关键**: React DevTools 不显示组件重渲染

5. **UI 本地化**
   - 所有 Toast 消息为简体中文
   - 错误提示为中文

---

## 7. 故障排查

### MQTT 连接失败
```
错误: WebSocket connection failed
解决: 检查 Mosquitto 是否配置 WebSocket listener (端口 8083)
```

### AMap 不加载 / INVALID_USER_DOMAIN
```
错误: INVALID_USER_DOMAIN
解决:
1) 确认 NEXT_PUBLIC_AMAP_KEY 与 NEXT_PUBLIC_AMAP_SECURITY_CODE 已配置
2) 在高德控制台为 Key 配置域名白名单（localhost / bag.versecraft.cn）
```

### Coze API 401
```
错误: Authorization failed
解决: 检查 COZE_TOKEN 是否过期,重新生成 Token
```

### ESP32 流无法访问
```
错误: Failed to load resource
解决: 
1. 确认 ESP32 与电脑在同一局域网
2. ping ESP32 IP 地址验证连通性
3. 检查 NEXT_PUBLIC_ESP32_STREAM_URL 配置
```

---

## 8. 生产部署检查清单

- [ ] 配置真实 MQTT Broker (EMQ X / HiveMQ Cloud)
- [ ] 配置 AMap Key 域名白名单
- [ ] Coze Token 加密存储 (环境变量)
- [ ] ESP32 固件 OTA 更新机制
- [ ] HTTPS 强制 (Nginx 反向代理)
- [ ] MQTT TLS 加密连接
- [ ] API Rate Limiting (Coze 调用限制)
- [ ] 日志监控 (Winston / Sentry)
