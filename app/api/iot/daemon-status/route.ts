import { NextResponse } from 'next/server'
import { getIoTDaemonStatus, startRedisBackedMqttDaemon } from '@/lib/iot/redis-mqtt-daemon'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    await startRedisBackedMqttDaemon()
  } catch (error) {
    console.error('[IoT Daemon Status] Failed to start daemon before status read:', error)
  }

  const status = getIoTDaemonStatus()

  return NextResponse.json({
    started: status.started,
    starting: status.starting,
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
