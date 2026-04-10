# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Smart Schoolbag V5.0 — a single Next.js 16 (App Router) IoT Digital Twin Dashboard. No monorepo, no database, no Docker. All state is client-side (Zustand). See `docs/ARCHITECTURE.md` for full architecture details.

### Standard commands

| Task | Command |
|------|---------|
| Dev server | `pnpm dev` (port 3000) |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Start (prod) | `pnpm start` |

### MQTT broker for IoT testing

The app requires an MQTT broker with WebSocket support for real-time IoT data. To start a local Mosquitto broker:

```bash
cat > /tmp/mosquitto.conf << 'EOF'
listener 1883
listener 8083
protocol websockets
allow_anonymous true
EOF
mosquitto -c /tmp/mosquitto.conf -d
```

Then set `NEXT_PUBLIC_MQTT_URL` in `.env.local` to point to the local broker WebSocket endpoint (default: port 8083, path `/mqtt`).

To publish test sensor data:
```bash
mosquitto_pub -h localhost -t "v5/bag/status" -m '{"status":"online"}'
mosquitto_pub -h localhost -t "v5/bag/sensors" -m '{"battery":85,"temp":24,"humid":45}'
mosquitto_pub -h localhost -t "v5/bag/gps" -m '{"lat":31.2304,"lng":121.4737}'
```

See `docs/IOT_TESTING_GUIDE.md` for the full testing guide.

### Environment variables

Create `.env.local` (gitignored) with these keys. Only `NEXT_PUBLIC_MQTT_URL` is needed for core functionality; the rest are optional:

- `NEXT_PUBLIC_MQTT_URL` — MQTT broker WebSocket URL (set to local broker ws endpoint)
- `NEXT_PUBLIC_AMAP_KEY` / `NEXT_PUBLIC_AMAP_SECURITY_CODE` — AMap API keys (location page only)
- `NEWAPI_BASE_URL` / `NEWAPI_API_KEY` — NewAPI 服务端配置（视觉分析与文本分析共用，代码固定调用 `bag-image` / `bag-text`）
- `NEXT_PUBLIC_ESP32_STREAM_URL` — ESP32 camera stream URL (vision page only)

### Non-obvious caveats

- **ESLint config**: The project needs `eslint.config.mjs` (flat config format) to run `pnpm lint`. The config extends `eslint-config-next` with `next/core-web-vitals`.
- **No `next lint`**: Next.js 16 removed the built-in `next lint` CLI command. The project uses `eslint .` directly via the `lint` script in `package.json`.
- **Pre-existing lint errors**: The codebase has 3 pre-existing ESLint errors (react-hooks rules) and 5 warnings. These are not regressions.
- **Mosquitto must be installed separately**: `sudo apt-get install -y mosquitto mosquitto-clients` — it is not part of the Node.js dependency tree.
- **Map provider**: Despite `.cursorrules` mentioning Mapbox, the actual code uses AMap. See `docs/AMAP_MIGRATION.md`.
- **`typescript.ignoreBuildErrors: true`** is set in `next.config.mjs`, so `pnpm build` will succeed even with TS errors.
