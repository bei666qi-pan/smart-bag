import 'server-only'

type DaemonStartResult =
  | { started: true }
  | {
      started: false
      reason:
        | 'not_nodejs_runtime'
        | 'redis_unconfigured'
        | 'mqtt_unconfigured'
        | 'import_failed'
    }

export type IoTDaemonStatus = {
  started: boolean
  starting: boolean
  redisConfigured: boolean
  mqttServerConfigured: boolean
  redisConnected: boolean
  mqttConnected: boolean
  subscribed: boolean
  lastMirroredAt: string | null
  lastMirroredTopic: string | null
  lastError: string | null
}

type DaemonRecord = {
  startPromise: Promise<DaemonStartResult> | null
  status: IoTDaemonStatus
}

function createDefaultStatus(): IoTDaemonStatus {
  return {
    started: false,
    starting: false,
    redisConfigured: Boolean(process.env.REDIS_URL),
    mqttServerConfigured: Boolean(process.env.MQTT_SERVER_URL),
    redisConnected: false,
    mqttConnected: false,
    subscribed: false,
    lastMirroredAt: null,
    lastMirroredTopic: null,
    lastError: null,
  }
}

function getDaemonRecord(): DaemonRecord {
  const g = globalThis as unknown as { __smartBagIotDaemon?: DaemonRecord }

  if (!g.__smartBagIotDaemon) {
    g.__smartBagIotDaemon = {
      startPromise: null,
      status: createDefaultStatus(),
    }
  }

  g.__smartBagIotDaemon.status.redisConfigured = Boolean(process.env.REDIS_URL)
  g.__smartBagIotDaemon.status.mqttServerConfigured = Boolean(process.env.MQTT_SERVER_URL)

  return g.__smartBagIotDaemon
}

function updateDaemonStatus(patch: Partial<IoTDaemonStatus>) {
  Object.assign(getDaemonRecord().status, patch)
}

function redactUrl(input: string) {
  try {
    const url = new URL(input)
    if (url.username) url.username = '***'
    if (url.password) url.password = '***'
    return url.toString()
  } catch {
    return input
  }
}

function sanitizeDiagnosticMessage(input: string) {
  let output = input
    .replace(/Bearer\s+[^\s"'`]+/gi, 'Bearer ***')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')

  const sensitiveValues = [process.env.REDIS_URL, process.env.MQTT_SERVER_URL].filter(
    (value): value is string => Boolean(value)
  )

  for (const value of sensitiveValues) {
    output = output.replaceAll(value, redactUrl(value))
  }

  return output
}

function getErrorMessage(error: unknown, prefix: string) {
  const message = error instanceof Error ? error.message : String(error)
  return sanitizeDiagnosticMessage(`${prefix}:${message}`)
}

export async function startRedisBackedMqttDaemon(): Promise<DaemonStartResult> {
  const record = getDaemonRecord()
  if (record.status.started) return { started: true }
  if (record.startPromise) return record.startPromise

  record.status.started = false
  record.status.starting = true
  record.status.redisConfigured = Boolean(process.env.REDIS_URL)
  record.status.mqttServerConfigured = Boolean(process.env.MQTT_SERVER_URL)
  record.status.lastError = null

  record.startPromise = (async (): Promise<DaemonStartResult> => {
    if (process.env.NEXT_RUNTIME === 'edge') {
      console.warn('[IoT Daemon] Edge runtime detected, skipping daemon start')
      updateDaemonStatus({
        starting: false,
        lastError: 'edge_runtime',
      })
      return { started: false, reason: 'not_nodejs_runtime' }
    }

    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      console.warn('[IoT Daemon] REDIS_URL not configured, skipping MQTT->Redis mirror')
      updateDaemonStatus({
        starting: false,
        redisConfigured: false,
        lastError: 'redis_unconfigured',
      })
      return { started: false, reason: 'redis_unconfigured' }
    }

    const mqttUrl = process.env.MQTT_SERVER_URL
    if (!mqttUrl) {
      console.warn('[IoT Daemon] MQTT_SERVER_URL not configured, skipping MQTT->Redis mirror')
      updateDaemonStatus({
        starting: false,
        mqttServerConfigured: false,
        lastError: 'mqtt_unconfigured',
      })
      return { started: false, reason: 'mqtt_unconfigured' }
    }

    try {
      const [{ default: Redis }, mqtt] = await Promise.all([import('ioredis'), import('mqtt')])

      const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true })
      redis.on('connect', () => {
        updateDaemonStatus({
          redisConnected: true,
          lastError: null,
        })
        console.log('[IoT Daemon] Redis connected:', redactUrl(redisUrl))
      })
      redis.on('ready', () => {
        updateDaemonStatus({
          redisConnected: true,
          lastError: null,
        })
      })
      redis.on('close', () => {
        updateDaemonStatus({ redisConnected: false })
      })
      redis.on('end', () => {
        updateDaemonStatus({ redisConnected: false })
      })
      redis.on('error', (error) => {
        updateDaemonStatus({
          redisConnected: false,
          lastError: getErrorMessage(error, 'redis_error'),
        })
        console.error('[IoT Daemon] Redis error:', error)
      })

      try {
        await redis.connect()
      } catch (error) {
        updateDaemonStatus({
          redisConnected: false,
          lastError: getErrorMessage(error, 'redis_connect_failed'),
        })
        console.error('[IoT Daemon] Redis initial connect failed:', error)
      }

      const client = mqtt.connect(mqttUrl, {
        clientId: `server_daemon_${Math.random().toString(16).slice(2, 10)}`,
        keepalive: 60,
        clean: true,
        reconnectPeriod: 5000,
      })

      client.on('connect', () => {
        updateDaemonStatus({
          mqttConnected: true,
          subscribed: false,
          lastError: null,
        })
        console.log('[IoT Daemon] MQTT connected:', redactUrl(mqttUrl))

        client.subscribe('v5/bag/#', (error) => {
          if (error) {
            updateDaemonStatus({
              subscribed: false,
              lastError: getErrorMessage(error, 'mqtt_subscribe_failed'),
            })
            console.error('[IoT Daemon] MQTT subscribe failed:', error.message)
            return
          }

          updateDaemonStatus({
            subscribed: true,
            lastError: null,
          })
          console.log('[IoT Daemon] Subscribed: v5/bag/#')
        })
      })

      client.on('reconnect', () => {
        updateDaemonStatus({
          mqttConnected: false,
          subscribed: false,
        })
      })
      client.on('offline', () => {
        updateDaemonStatus({
          mqttConnected: false,
          subscribed: false,
        })
      })
      client.on('close', () => {
        updateDaemonStatus({
          mqttConnected: false,
          subscribed: false,
        })
      })
      client.on('error', (error) => {
        updateDaemonStatus({
          mqttConnected: false,
          subscribed: false,
          lastError: getErrorMessage(error, 'mqtt_error'),
        })
        console.error('[IoT Daemon] MQTT error:', error.message)
      })

      client.on('message', async (topic: string, payload: Buffer) => {
        try {
          const data = JSON.parse(payload.toString())
          const mirroredAt = new Date().toISOString()

          if (topic === 'v5/bag/status' && data.status) {
            await redis.hset('bag:latest', 'status', data.status, 'lastSeenAt', mirroredAt)
          }

          if (topic === 'v5/bag/sensors') {
            const fields: string[] = ['lastSeenAt', mirroredAt]
            if (typeof data.battery === 'number') fields.push('battery', String(data.battery))
            if (typeof data.temp === 'number') fields.push('temp', String(data.temp))
            if (typeof data.humid === 'number') fields.push('humid', String(data.humid))
            await redis.hset('bag:latest', ...fields)
          }

          if (topic === 'v5/bag/gps') {
            const lat = data.lat ?? data.latitude
            const lng = data.lng ?? data.longitude
            if (typeof lat === 'number' && typeof lng === 'number') {
              await redis.hset(
                'bag:latest',
                'lat',
                String(lat),
                'lng',
                String(lng),
                'lastSeenAt',
                mirroredAt
              )
            }
          }

          updateDaemonStatus({
            lastMirroredAt: mirroredAt,
            lastMirroredTopic: topic,
            lastError: null,
          })
        } catch (error) {
          updateDaemonStatus({
            lastError: getErrorMessage(error, 'process_error'),
          })
          console.error('[IoT Daemon] Failed to process MQTT message:', error)
        }
      })

      updateDaemonStatus({
        started: true,
        starting: false,
      })
      console.log('[IoT Daemon] Started (async connect in progress)')
      return { started: true }
    } catch (error) {
      console.error('[IoT Daemon] Import/start failed:', error)
      updateDaemonStatus({
        started: false,
        starting: false,
        lastError: getErrorMessage(error, 'import_failed'),
      })
      return { started: false, reason: 'import_failed' }
    }
  })()

  const result = await record.startPromise
  record.startPromise = null
  updateDaemonStatus({
    started: result.started,
    starting: false,
  })

  return result
}

export function getIoTDaemonStatus(): IoTDaemonStatus {
  return { ...getDaemonRecord().status }
}
