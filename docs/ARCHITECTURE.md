# Smart Schoolbag V5.0 Architecture

## Overview

Smart Schoolbag V5.0 is a single Next.js 16 App Router application.

- Frontend state is client-side only and managed by Zustand.
- Browser realtime data arrives through MQTT over WebSocket.
- Server-side persistence comes from a lightweight MQTT -> Redis mirror daemon.
- No database is required; Redis stores the latest mirrored device snapshot.

## Runtime Topology

```text
Hardware (TCP MQTT)
  -> mqtt.bag.versecraft.cn:1883
  -> topics: v5/bag/status, v5/bag/sensors, v5/bag/gps, v5/bag/cmd/ack

Browser (WSS MQTT)
  -> wss://bag.versecraft.cn/mqtt
  -> consumes realtime data and command ACKs

Server Daemon
  instrumentation.ts
  -> lib/iot/redis-mqtt-daemon.ts
  -> subscribes v5/bag/#
  -> mirrors latest values into Redis hash bag:latest

API
  /api/iot/state
  /api/iot/status   (alias of /api/iot/state)
  /api/iot/daemon-status
```

## MQTT Responsibilities

### Hardware

- Connect to `mqtt.bag.versecraft.cn:1883`
- Publish:
  - `v5/bag/status`
  - `v5/bag/sensors`
  - `v5/bag/gps`
  - `v5/bag/cmd/ack`
- Subscribe:
  - `v5/bag/cmd`

### Browser

- Connect to `wss://bag.versecraft.cn/mqtt`
- Subscribe to:
  - `v5/bag/status`
  - `v5/bag/sensors`
  - `v5/bag/gps`
  - `v5/bag/cmd/ack`
- Publish commands to:
  - `v5/bag/cmd`

## Redis Mirror

The daemon writes the latest device snapshot into Redis hash `bag:latest`.

Mirrored fields currently include:

- `status`
- `battery`
- `temp`
- `humid`
- `lat`
- `lng`
- `lastSeenAt`

This matters because page refreshes do not recover browser memory. Initial data must come from Redis/API if you want a fresh page load to show the latest known state.

## API Semantics

### `/api/iot/state`

Reads `bag:latest` from Redis and returns the last mirrored payload.

### `/api/iot/status`

Alias of `/api/iot/state`.

### `/api/iot/daemon-status`

Returns diagnostic-only daemon state without leaking secrets:

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
  "lastMirroredTopic": "v5/bag/sensors",
  "lastError": null
}
```

Use this endpoint to debug deployment issues such as:

- instrumentation not starting
- Redis env missing
- `MQTT_SERVER_URL` misconfigured
- daemon subscribed but not receiving device traffic

## Important State Semantics

- `Broker 在线 != 设备在线`
- Browser MQTT connected means only that the browser reached the broker.
- Device online is derived from `v5/bag/status`.
- API success means only that Redis/API is readable.

These are intentionally shown as separate signals in the UI.

## Location Flow

- Hardware sends WGS-84 `lat/lng` to `v5/bag/gps`
- Browser store keeps `gpsCoords` as `[lng, lat]`
- Location page converts WGS-84 to GCJ-02 for AMap display
- Map center, marker, and coordinate text all follow `gpsCoords`

## Command Flow

```text
User reviews text -> screen_text prepared
-> publish to v5/bag/cmd
-> pendingCmd shown in UI
-> hardware publishes v5/bag/cmd/ack
-> lastCmdAck updates UI
```

Command payload:

```json
{ "id": "uuid", "action": "screen_text", "value": "记得带作业本" }
```

The standard interaction flow is user input -> `AI 评估` with `bag-text` -> confirm `screen_text` -> `发送到设备`.
If NewAPI or `bag-text` fails, the IoT debug panel can still publish `screen_text` and `mode_switch` directly for hardware validation.

ACK payload:

```json
{ "cmd_id": "uuid", "status": 0, "msg": "OK" }
```

## Vision Flow

### LAN mode

- Uses `NEXT_PUBLIC_ESP32_STREAM_URL`
- Suitable only for same-LAN development or testing
- HTTPS page + HTTP stream will fail due to Mixed Content

### WAN mode

- Device uploads snapshots to `POST /api/camera/latest`
- Browser reads snapshots from `GET /api/camera/latest`
- This is the supported remote fallback when direct LAN streaming is unavailable
- Snapshot upload requires `x-device-token: bag_secret_2026`
- Snapshot upload uses `multipart/form-data` field name `image`
- If no snapshot has been uploaded, `GET /api/camera/latest` returns `200` with JSON empty state instead of `404`

Empty snapshot response:

```json
{
  "success": true,
  "hasSnapshot": false,
  "message": "暂无快照",
  "timestamp": null
}
```

## Environment Summary

```bash
NEXT_PUBLIC_MQTT_URL=wss://bag.versecraft.cn/mqtt
NEXT_PUBLIC_MQTT_PATH=/mqtt
MQTT_SERVER_URL=mqtt://mqtt.bag.versecraft.cn:1883
REDIS_URL=redis://localhost:6379
NEXT_PUBLIC_AMAP_KEY=...
NEXT_PUBLIC_AMAP_SECURITY_CODE=...
NEXT_PUBLIC_ESP32_STREAM_URL=http://<lan-host>/stream
NEWAPI_BASE_URL=https://newkey.versecraft.cn
NEWAPI_API_KEY=...
```
