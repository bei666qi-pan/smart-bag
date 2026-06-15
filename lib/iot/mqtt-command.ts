import 'server-only'
import type { MqttClient } from 'mqtt'

// Server-side MQTT publisher for device commands.
//
// 指令下发从「浏览器匿名直连 MQTT 发 v5/bag/cmd」改为「服务端用授权账号下发」，
// 这样可以在 broker 侧把匿名写 cmd 的权限收掉，杜绝任意匿名客户端注入指令。
// 复用 MQTT_SERVER_URL（已带 server 账号凭证），与 redis 镜像守护进程同一身份。

let clientPromise: Promise<MqttClient> | null = null

function getPublisher(): Promise<MqttClient> {
  if (clientPromise) return clientPromise

  const url = process.env.MQTT_SERVER_URL
  if (!url) return Promise.reject(new Error('mqtt_server_url_unconfigured'))

  clientPromise = (async () => {
    const { default: mqtt } = await import('mqtt')
    return await new Promise<MqttClient>((resolve, reject) => {
      const client = mqtt.connect(url, {
        clientId: `server_cmd_${Math.random().toString(16).slice(2, 10)}`,
        keepalive: 60,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      })

      let settled = false

      // Persistent error handler so later disconnects never throw as "unhandled".
      client.on('error', (err) => {
        console.error('[CMD MQTT] error:', err?.message)
        if (!settled && !client.connected) {
          settled = true
          clientPromise = null
          try {
            client.end(true)
          } catch {}
          reject(err)
        }
      })

      client.once('connect', () => {
        if (!settled) {
          settled = true
          console.log('[CMD MQTT] publisher connected')
          resolve(client)
        }
      })
    })
  })()

  return clientPromise
}

/** Publish a device command to v5/bag/cmd using the server account. */
export async function publishDeviceCommand(payload: unknown): Promise<void> {
  const client = await getPublisher()
  await new Promise<void>((resolve, reject) => {
    client.publish('v5/bag/cmd', JSON.stringify(payload), { qos: 1 }, (err) =>
      err ? reject(err) : resolve()
    )
  })
}
