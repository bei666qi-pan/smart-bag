# IoT Testing Guide

## 1. MQTT addresses

- Hardware MQTT (TCP): `mqtt.bag.versecraft.cn:1883`
- Browser MQTT (WSS): `wss://bag.versecraft.cn/mqtt`

Only the browser should use the WSS address. Hardware must connect to the TCP broker.

## 2. Local broker setup

Example Mosquitto config:

```conf
listener 1883
listener 8083
protocol websockets
allow_anonymous true
```

Local browser env example:

```bash
NEXT_PUBLIC_MQTT_URL=ws://localhost:8083/mqtt
NEXT_PUBLIC_MQTT_PATH=/mqtt
MQTT_SERVER_URL=mqtt://localhost:1883
REDIS_URL=redis://localhost:6379
```

## 3. Publish test data

### Device online/offline

```bash
mosquitto_pub -h localhost -t "v5/bag/status" -m '{"status":"online"}'
mosquitto_pub -h localhost -t "v5/bag/status" -m '{"status":"offline"}'
```

### Sensor data

```bash
mosquitto_pub -h localhost -t "v5/bag/sensors" -m '{"battery":75,"temp":26,"humid":50}'
```

### GPS data

```bash
mosquitto_pub -h localhost -t "v5/bag/gps" -m '{"lat":31.2304,"lng":121.4737}'
mosquitto_pub -h localhost -t "v5/bag/gps" -m '{"lat":31.2310,"lng":121.4740}'
```

### Command ACK

Command topic:

```text
v5/bag/cmd
```

ACK topic:

```text
v5/bag/cmd/ack
```

ACK example:

```json
{"cmd_id":"abc-123","status":0,"msg":"OK"}
```

## 4. What to verify in the UI

### Dashboard

- MQTT status reflects broker connectivity
- Device status reflects `v5/bag/status`
- Sensor cards show real values or `—`
- No fake CPU / memory / bag item placeholders remain

### Location page

- Coordinate text updates when `gpsCoords` changes
- Marker moves to the new point
- Map center follows the latest point
- No repeated 500ms resize heartbeat logs

### Interaction page

- `AI 评估` only prepares/reviews `screen_text`
- `发送到设备` is enabled only when MQTT is connected and the device is online
- Clicking `发送到设备` produces a real `v5/bag/cmd` command
- `pendingCmd` appears before ACK and clears after matching ACK

## 5. Deployment diagnostics

### `/api/iot/status`

- Alias of `/api/iot/state`
- Reads the last mirrored snapshot from Redis

### `/api/iot/daemon-status`

Use this to determine whether deployment wiring is correct:

```json
{
  "started": true,
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

This endpoint is for observability only. It does not hide broken deployments.

## 6. Important semantics

- `Broker 在线 != 设备在线`
- Page refresh depends on Redis/API initial state, not on the browser remembering previous MQTT data
- If Redis or the daemon is missing, `/api/iot/status` falls back to empty data instead of pretending the device is online

## 7. Video testing

### LAN mode

- Only suitable for same-LAN testing
- Uses `NEXT_PUBLIC_ESP32_STREAM_URL`
- If the page is HTTPS and the stream is HTTP, the browser will block it as Mixed Content

### WAN mode

- Upload snapshots to `POST /api/camera/latest`
- Read snapshots from `GET /api/camera/latest`
- Use this mode for remote environments where LAN streaming is not available

## 8. Suggested validation sequence

1. Confirm `/api/iot/daemon-status` shows `started=true` and `subscribed=true`
2. Publish `v5/bag/status` and confirm the UI switches device status
3. Publish `v5/bag/sensors` and confirm dashboard cards update
4. Publish `v5/bag/gps` and confirm the location page center, marker, and coordinate text all move
5. Use the interaction page to send `screen_text`, then publish an ACK and confirm `pendingCmd` clears
