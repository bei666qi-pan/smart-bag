import Redis from 'ioredis'
import { NextResponse } from 'next/server'
import { startRedisBackedMqttDaemon } from '@/lib/iot/redis-mqtt-daemon'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function createFallbackState(error?: string) {
  return {
    status: 'offline' as const,
    deviceOnline: false,
    battery: null,
    temp: null,
    humid: null,
    lat: null,
    lng: null,
    lastSeenAt: null,
    error,
  }
}

export async function GET() {
  // Best-effort: ensure server daemon is started in deployments where instrumentation is not triggered reliably.
  // Do not block response on daemon connectivity.
  void startRedisBackedMqttDaemon()

  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    console.warn('[API] REDIS_URL is not configured, returning fallback IoT state')
    return NextResponse.json(createFallbackState('redis_unconfigured'))
  }

  let redis: Redis | null = null

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })

    const data = await redis.hgetall('bag:latest')

    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json(createFallbackState())
    }

    const deviceOnline = data.status === 'online'

    return NextResponse.json({
      status: deviceOnline ? 'online' : 'offline',
      deviceOnline,
      battery: data.battery ? Number(data.battery) : null,
      temp: data.temp ? Number(data.temp) : null,
      humid: data.humid ? Number(data.humid) : null,
      lat: data.lat ? Number(data.lat) : null,
      lng: data.lng ? Number(data.lng) : null,
      lastSeenAt: data.lastSeenAt || null,
    })
  } catch (error) {
    console.error('[API] Failed to read IoT state from Redis:', error)
    return NextResponse.json(createFallbackState('redis_unavailable'))
  } finally {
    try {
      if (redis?.quit) {
        await redis.quit()
      } else {
        redis?.disconnect?.()
      }
    } catch (closeError) {
      console.warn('[API] Failed to close Redis client cleanly:', closeError)
    }
  }
}
