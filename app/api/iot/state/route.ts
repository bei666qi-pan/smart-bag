import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

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
  if (!process.env.REDIS_URL) {
    console.warn('[API] REDIS_URL is not configured, returning fallback IoT state')
    return NextResponse.json(createFallbackState('redis_unconfigured'))
  }

  try {
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
  }
}
