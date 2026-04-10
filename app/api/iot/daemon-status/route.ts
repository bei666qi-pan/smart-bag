import { NextResponse } from 'next/server'
import { getIoTDaemonStatus, startRedisBackedMqttDaemon } from '@/lib/iot/redis-mqtt-daemon'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  await startRedisBackedMqttDaemon()

  const status = getIoTDaemonStatus()

  return NextResponse.json({
    started: status.started,
    redisConfigured: status.redisConfigured,
    mqttServerConfigured: status.mqttServerConfigured,
    redisConnected: status.redisConnected,
    mqttConnected: status.mqttConnected,
    subscribed: status.subscribed,
    lastMirroredAt: status.lastMirroredAt,
    lastMirroredTopic: status.lastMirroredTopic,
    lastError: status.lastError,
  })
}
