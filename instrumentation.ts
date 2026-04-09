import { startRedisBackedMqttDaemon } from '@/lib/iot/redis-mqtt-daemon'

export async function register() {
  const result = await startRedisBackedMqttDaemon()
  if (!result.started) {
    console.warn('[Instrumentation] IoT daemon not started:', result.reason)
  }
}
