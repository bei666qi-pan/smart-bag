export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { default: Redis } = await import('ioredis')
    const mqtt = await import('mqtt')

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    const mqttUrl = process.env.MQTT_SERVER_URL || 'mqtt://localhost:1883'

    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3 })

    redis.on('connect', () => {
      console.log('[Instrumentation] Redis 连接成功:', redisUrl)
    })

    redis.on('error', (err) => {
      console.error('[Instrumentation] Redis 错误:', err.message)
    })

    const client = mqtt.connect(mqttUrl, {
      clientId: `server_daemon_${process.pid}`,
      keepalive: 60,
      clean: true,
      reconnectPeriod: 5000,
    })

    client.on('connect', () => {
      console.log('[Instrumentation] MQTT Daemon 连接成功:', mqttUrl)
      client.subscribe('v5/bag/#', (err) => {
        if (err) {
          console.error('[Instrumentation] MQTT 订阅失败:', err.message)
        } else {
          console.log('[Instrumentation] 已订阅 v5/bag/#')
        }
      })
    })

    client.on('message', async (topic: string, payload: Buffer) => {
      try {
        const data = JSON.parse(payload.toString())

        if (topic === 'v5/bag/status' && data.status) {
          await redis.hset('bag:latest', 'status', data.status)
        }

        if (topic === 'v5/bag/sensors') {
          const fields: string[] = []
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
            await redis.hset('bag:latest', 'lat', String(lat), 'lng', String(lng))
          }
        }

        console.log(`[Instrumentation] ${topic} → Redis OK`)
      } catch (e) {
        console.error('[Instrumentation] 消息处理失败:', e)
      }
    })

    client.on('error', (err) => {
      console.error('[Instrumentation] MQTT 错误:', err.message)
    })
  }
}
