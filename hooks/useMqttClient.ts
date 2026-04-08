"use client"

import { useEffect, useRef } from 'react'
import mqtt, { MqttClient } from 'mqtt'
import { toast } from 'sonner'
import { useIoTStore } from '@/store/useIoTStore'

interface MqttConfig {
  brokerUrl: string
  wsPath?: string
  topics: {
    lwt: string
    sensors: string
    gps: string
    cmdAck: string
  }
}

const DEFAULT_CONFIG: MqttConfig = {
  brokerUrl: process.env.NEXT_PUBLIC_MQTT_URL || 'ws://localhost:8083',
  wsPath: process.env.NEXT_PUBLIC_MQTT_PATH || '/mqtt',
  topics: {
    lwt: 'v5/bag/status',
    sensors: 'v5/bag/sensors',
    gps: 'v5/bag/gps',
    cmdAck: 'v5/bag/cmd/ack',
  },
}

export function useMqttClient(config: Partial<MqttConfig> = {}) {
  const clientRef = useRef<MqttClient | null>(null)
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  useEffect(() => {
    if (clientRef.current) {
      console.log('[MQTT] Client already exists, skipping initialization')
      return
    }

    const store = useIoTStore.getState()
    store.fetchInitialState()
    store.setMqttConnectionStatus('connecting')

    const clientId = `web_${Math.random().toString(16).slice(2, 8)}`
    console.log('[MQTT] Initializing client:', clientId)

    let wsPath = finalConfig.wsPath || '/mqtt'
    try {
      const parsed = new URL(finalConfig.brokerUrl)
      if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname !== '') {
        wsPath = parsed.pathname
      }
    } catch {
      // mqtt.js accepts non-URL broker strings.
    }

    const client = mqtt.connect(finalConfig.brokerUrl, {
      clientId,
      keepalive: 60,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      path: wsPath,
    })

    clientRef.current = client
    useIoTStore.getState().setMqttClient(client)

    client.on('connect', () => {
      console.log('[MQTT] Connected to broker')
      useIoTStore.getState().setMqttConnectionStatus('connected')
      toast.success('MQTT \u8fde\u63a5\u6210\u529f', {
        description: '\u5df2\u8fde\u63a5\u5230 MQTT Broker',
      })

      const topics = Object.values(finalConfig.topics)
      client.subscribe(topics, (error) => {
        if (error) {
          console.error('[MQTT] Subscribe failed:', error)
          toast.error('\u8ba2\u9605\u5931\u8d25', {
            description: error.message,
          })
          return
        }

        console.log('[MQTT] Subscribed topics:', topics)
      })
    })

    client.on('message', (topic, payload) => {
      try {
        const message = payload.toString()
        const data = JSON.parse(message)
        const currentStore = useIoTStore.getState()

        console.log(`[MQTT] Message received [${topic}]`, data)
        currentStore.markLastSeen()

        if (topic === finalConfig.topics.lwt) {
          if (data.status === 'offline') {
            currentStore.setDeviceOnline(false)
            toast.warning('\u8bbe\u5907\u79bb\u7ebf', {
              description: '\u667a\u80fd\u4e66\u5305\u5df2\u65ad\u5f00\u8fde\u63a5',
            })
          } else if (data.status === 'online') {
            currentStore.setDeviceOnline(true)
            toast.success('\u8bbe\u5907\u5728\u7ebf', {
              description: '\u667a\u80fd\u4e66\u5305\u5df2\u6062\u590d\u8fde\u63a5',
            })
          }
          return
        }

        if (topic === finalConfig.topics.sensors) {
          if (typeof data.battery === 'number') {
            currentStore.setBattery(data.battery)
          }
          if (typeof data.temp === 'number') {
            currentStore.setTemp(data.temp)
          }
          if (typeof data.humid === 'number') {
            currentStore.setHumid(data.humid)
          }
          return
        }

        if (topic === finalConfig.topics.gps) {
          const lat = data.lat ?? data.latitude
          const lng = data.lng ?? data.longitude

          if (typeof lat === 'number' && typeof lng === 'number') {
            currentStore.setGpsCoords([lng, lat])
            console.log('[MQTT] GPS updated:', { lng, lat })
          }
          return
        }

        if (topic === finalConfig.topics.cmdAck) {
          const cmd_id = data.cmd_id
          const status = data.status
          const msg = data.msg

          if (typeof cmd_id === 'string' && typeof status === 'number') {
            currentStore.setLastCmdAck({
              cmd_id,
              status,
              msg: typeof msg === 'string' ? msg : undefined,
              ts: new Date().toISOString(),
            })

            const pending = currentStore.pendingCmd
            if (pending?.cmd_id === cmd_id) {
              currentStore.setPendingCmd(null)
            }

            if (status === 0) {
              toast.success('命令执行成功', {
                description: msg || `cmd_id: ${cmd_id}`,
              })
            } else {
              toast.error('命令执行失败', {
                description: msg || `cmd_id: ${cmd_id}`,
              })
            }
          } else {
            console.warn('[MQTT] Invalid cmd/ack payload:', data)
          }
        }
      } catch (error) {
        console.error('[MQTT] Message parse error:', error)
      }
    })

    client.on('error', (error) => {
      console.error('[MQTT] Connection error:', error)
      useIoTStore.getState().setMqttConnectionStatus('error')
      toast.error('MQTT \u8fde\u63a5\u9519\u8bef', {
        description: error.message,
      })
    })

    client.on('close', () => {
      console.log('[MQTT] Connection closed')
      useIoTStore.getState().setMqttConnectionStatus('disconnected')
    })

    client.on('reconnect', () => {
      console.log('[MQTT] Reconnecting...')
      useIoTStore.getState().setMqttConnectionStatus('connecting')
      toast.info('\u6b63\u5728\u91cd\u65b0\u8fde\u63a5', {
        description: '\u6b63\u5728\u5c1d\u8bd5\u6062\u590d MQTT \u8fde\u63a5',
      })
    })

    client.on('offline', () => {
      console.log('[MQTT] Client went offline')
      useIoTStore.getState().setMqttConnectionStatus('disconnected')
    })

    return () => {
      if (clientRef.current) {
        console.log('[MQTT] Cleaning up client connection')
        clientRef.current.end(true)
        clientRef.current = null
        const state = useIoTStore.getState()
        state.setMqttClient(null)
        state.setMqttConnectionStatus('disconnected')
      }
    }
  }, [])
}
