import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type RedisClientLike = {
  hgetall: (key: string) => Promise<Record<string, string>>
  disconnect?: () => void
  quit?: () => Promise<unknown>
}

type RedisConstructor = new (
  url: string,
  options: Record<string, unknown>
) => RedisClientLike

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

async function loadRedisConstructor(): Promise<RedisConstructor> {
  const dynamicImport = new Function('moduleName', 'return import(moduleName)')
  const redisModule = (await dynamicImport('ioredis')) as { default: RedisConstructor }
  return redisModule.default
}

export async function GET() {
  if (!process.env.REDIS_URL) {
    console.warn('[API] REDIS_URL is not configured, returning fallback IoT state')
    return NextResponse.json(createFallbackState('redis_unconfigured'))
  }

  let redis: RedisClientLike | null = null

  try {
    const Redis = await loadRedisConstructor()
    redis = new Redis(process.env.REDIS_URL, {
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
