import 'server-only'

type DaemonStartResult =
  | { started: true }
  | { started: false; reason: 'not_nodejs_runtime' | 'redis_unconfigured' | 'mqtt_unconfigured' | 'import_failed' }

function redactUrl(input: string) {
  try {
    const url = new URL(input)
    if (url.password) url.password = '***'
    return url.toString()
  } catch {
    return input
  }
}

export async function startRedisBackedMqttDaemon(): Promise<DaemonStartResult> {
  const g = globalThis as unknown as {
    __smartBagIotDaemon?: { started: boolean; starting?: Promise<DaemonStartResult> }
  }

  if (g.__smartBagIotDaemon?.started) return { started: true }
  if (g.__smartBagIotDaemon?.starting) return g.__smartBagIotDaemon.starting

  const starting = (async (): Promise<DaemonStartResult> => {
    // Next sets NEXT_RUNTIME in some contexts; do not assume it is always present.
    if (process.env.NEXT_RUNTIME === 'edge') {
      console.warn('[IoT Daemon] Edge runtime detected, skipping daemon start')
      return { started: false, reason: 'not_nodejs_runtime' }
    }

    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      console.warn('[IoT Daemon] REDIS_URL 未配置，跳过 Redis 持久化')
      return { started: false, reason: 'redis_unconfigured' }
    }

    const mqttUrl = process.env.MQTT_SERVER_URL
    if (!mqttUrl) {
      console.warn('[IoT Daemon] MQTT_SERVER_URL 未配置，跳过 MQTT->Redis 持久化')
      return { started: false, reason: 'mqtt_unconfigured' }
    }

    try {
      const [{ default: Redis }, mqtt] = await Promise.all([import('ioredis'), import('mqtt')])

      const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true })
      redis.on('connect', () => console.log('[IoT Daemon] Redis connected:', redactUrl(redisUrl)))
      redis.on('error', (err) => console.error('[IoT Daemon] Redis error:', err))

      const client = mqtt.connect(mqttUrl, {
        clientId: `server_daemon_${Math.random().toString(16).slice(2, 10)}`,
        keepalive: 60,
        clean: true,
        reconnectPeriod: 5000,
      })

      client.on('connect', () => {
        console.log('[IoT Daemon] MQTT connected:', redactUrl(mqttUrl))
        client.subscribe('v5/bag/#', (err) => {
          if (err) console.error('[IoT Daemon] MQTT subscribe failed:', err.message)
          else console.log('[IoT Daemon] Subscribed: v5/bag/#')
        })
      })

      client.on('error', (err) => {
        console.error('[IoT Daemon] MQTT error:', err.message)
      })

      client.on('message', async (topic: string, payload: Buffer) => {
        try {
          const data = JSON.parse(payload.toString())
          const lastSeenAt = new Date().toISOString()

          if (topic === 'v5/bag/status' && data.status) {
            await redis.hset('bag:latest', 'status', data.status, 'lastSeenAt', lastSeenAt)
          }

          if (topic === 'v5/bag/sensors') {
            const fields: string[] = ['lastSeenAt', lastSeenAt]
            if (typeof data.battery === 'number') fields.push('battery', String(data.battery))
            if (typeof data.temp === 'number') fields.push('temp', String(data.temp))
            if (typeof data.humid === 'number') fields.push('humid', String(data.humid))
            if (fields.length > 0) await redis.hset('bag:latest', ...fields)
          }

          if (topic === 'v5/bag/gps') {
            const lat = data.lat ?? data.latitude
            const lng = data.lng ?? data.longitude
            if (typeof lat === 'number' && typeof lng === 'number') {
              await redis.hset(
                'bag:latest',
                'lat',
                String(lat),
                'lng',
                String(lng),
                'lastSeenAt',
                lastSeenAt
              )
            }
          }
        } catch (error) {
          console.error('[IoT Daemon] Failed to process MQTT message:', error)
        }
      })

      console.log('[IoT Daemon] Started (async connect in progress)')
      return { started: true }
    } catch (error) {
      console.error('[IoT Daemon] Import/start failed:', error)
      return { started: false, reason: 'import_failed' }
    }
  })()

  g.__smartBagIotDaemon = { started: false, starting }
  const result = await starting
  g.__smartBagIotDaemon = { started: result.started }
  return result

}
