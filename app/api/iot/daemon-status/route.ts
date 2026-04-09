import { NextResponse } from 'next/server'
import { getIoTDaemonStatus, startRedisBackedMqttDaemon } from '@/lib/iot/redis-mqtt-daemon'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  // Best-effort: attempt to start, but always return status.
  void startRedisBackedMqttDaemon()

  const status = getIoTDaemonStatus()

  let redisLastSeenAt: string | null = null
  let redisReadError: string | null = null

  if (process.env.REDIS_URL) {
    try {
      const { default: Redis } = await import('ioredis')
      const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true })
      const data = await redis.hgetall('bag:latest')
      redisLastSeenAt = data?.lastSeenAt ?? null
      try {
        await redis.quit()
      } catch {
        // ignore
      }
    } catch (e) {
      redisReadError = e instanceof Error ? e.message : 'redis_read_failed'
    }
  }

  return NextResponse.json({
    ok: true,
    env: {
      REDIS_URL: Boolean(process.env.REDIS_URL),
      MQTT_SERVER_URL: Boolean(process.env.MQTT_SERVER_URL),
    },
    daemon: status,
    redis: {
      bagLatestLastSeenAt: redisLastSeenAt,
      readError: redisReadError,
    },
  })
}

