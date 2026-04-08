type RedisClientLike = {
  on: (event: string, handler: (...args: unknown[]) => void) => void
  hset: (key: string, ...fields: string[]) => Promise<unknown>
}

type RedisConstructor = new (
  url: string,
  options: Record<string, unknown>
) => RedisClientLike

async function loadRedisConstructor(): Promise<RedisConstructor> {
  const dynamicImport = new Function('moduleName', 'return import(moduleName)')
  const redisModule = (await dynamicImport('ioredis')) as { default: RedisConstructor }
  return redisModule.default
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  if (!process.env.REDIS_URL) {
    console.warn('[Instrumentation] REDIS_URL is not configured, skipping Redis-backed IoT daemon')
    return
  }

  const mqtt = await import('mqtt')
  const Redis = await loadRedisConstructor()

  const redisUrl = process.env.REDIS_URL
  const mqttUrl = process.env.MQTT_SERVER_URL || 'mqtt://localhost:1883'
  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 })

  redis.on('connect', () => {
    console.log('[Instrumentation] Redis connected:', redisUrl)
  })

  redis.on('error', (err) => {
    console.error('[Instrumentation] Redis error:', err)
  })

  const client = mqtt.connect(mqttUrl, {
    clientId: `server_daemon_${Math.random().toString(16).slice(2, 10)}`,
    keepalive: 60,
    clean: true,
    reconnectPeriod: 5000,
  })

  client.on('connect', () => {
    console.log('[Instrumentation] MQTT daemon connected:', mqttUrl)
    client.subscribe('v5/bag/#', (err) => {
      if (err) {
        console.error('[Instrumentation] MQTT subscribe failed:', err.message)
      } else {
        console.log('[Instrumentation] Subscribed to v5/bag/#')
      }
    })
  })

  client.on('message', async (topic: string, payload: Buffer) => {
    try {
      const data = JSON.parse(payload.toString())
      const lastSeenAt = new Date().toISOString()

      if (topic === 'v5/bag/status' && data.status) {
        await redis.hset('bag:latest', 'status', data.status, 'lastSeenAt', lastSeenAt)
      }

      if (topic === 'v5/bag/sensors') {
        const fields: string[] = ['status', 'online', 'lastSeenAt', lastSeenAt]

        if (typeof data.battery === 'number') {
          fields.push('battery', String(data.battery))
        }
        if (typeof data.temp === 'number') {
          fields.push('temp', String(data.temp))
        }
        if (typeof data.humid === 'number') {
          fields.push('humid', String(data.humid))
        }
        if (fields.length > 0) {
          await redis.hset('bag:latest', ...fields)
        }
      }

      if (topic === 'v5/bag/gps') {
        const lat = data.lat ?? data.latitude
        const lng = data.lng ?? data.longitude

        if (typeof lat === 'number' && typeof lng === 'number') {
          await redis.hset(
            'bag:latest',
            'status',
            'online',
            'lat',
            String(lat),
            'lng',
            String(lng),
            'lastSeenAt',
            lastSeenAt
          )
        }
      }

      console.log(`[Instrumentation] Mirrored ${topic} to Redis`)
    } catch (error) {
      console.error('[Instrumentation] Failed to process MQTT message:', error)
    }
  })

  client.on('error', (err) => {
    console.error('[Instrumentation] MQTT error:', err.message)
  })
}
