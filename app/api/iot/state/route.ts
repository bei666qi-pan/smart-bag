import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { startRedisBackedMqttDaemon } from '@/lib/iot/redis-mqtt-daemon'
import { getSessionUser } from '@/lib/auth'

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
    voiceOnline: false,
    voiceLastSeenAt: null,
    lastVoiceEvent: null,
    lastVoiceCmd: null, // [语音联动]
    error,
  }
}

// 解析 Redis 里以 JSON 字符串存储的语音子系统对象（voice event / voice cmd 通用）。
function parseVoiceEvent(raw: string | undefined) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function GET() {
  // 鉴权：设备状态（GPS/电量等）属敏感数据，仅登录用户可读
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  // Best-effort: ensure server daemon is started in deployments where instrumentation is not triggered reliably.
  // Do not block response on daemon connectivity.
  void startRedisBackedMqttDaemon()

  // Read through the shared Redis singleton (lib/redis.ts) instead of opening a
  // new connection per request. When REDIS_URL is unset we never touch Redis and
  // return an honest offline empty state.
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
      voiceOnline: data.voiceStatus === 'online',
      voiceLastSeenAt: data.voiceLastSeenAt || null,
      lastVoiceEvent: parseVoiceEvent(data.lastVoiceEvent),
      lastVoiceCmd: parseVoiceEvent(data.lastVoiceCmd), // [语音联动]
    })
  } catch (error) {
    console.error('[API] Failed to read IoT state from Redis:', error)
    return NextResponse.json(createFallbackState('redis_unavailable'))
  }
  // NOTE: the shared singleton stays connected across requests — do not quit it here.
}
