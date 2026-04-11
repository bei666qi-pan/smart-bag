import { startRedisBackedMqttDaemon } from '@/lib/iot/redis-mqtt-daemon'

export async function register() {
  try {
    const result = await startRedisBackedMqttDaemon()
    if (!result.started) {
      console.warn('[Instrumentation] IoT daemon not started:', result.reason)
    }
  } catch (error) {
    console.error('[Instrumentation] IoT daemon start failed:', error)
  }
}
