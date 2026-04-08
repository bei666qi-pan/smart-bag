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
  }
}

const DEFAULT_CONFIG: MqttConfig = {
  brokerUrl: process.env.NEXT_PUBLIC_MQTT_URL || 'ws://localhost:8083',
  wsPath: process.env.NEXT_PUBLIC_MQTT_PATH || '/mqtt',
  topics: {
    lwt: 'v5/bag/status',
    sensors: 'v5/bag/sensors',
    gps: 'v5/bag/gps',
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

    client.on('connect', () => {
      console.log('[MQTT] Connected to broker')
      useIoTStore.getState().setMqttConnectionStatus('connected')
      toast.success('MQTT 连接成功', {
        description: '已连接到 MQTT Broker',
      })

      const topics = Object.values(finalConfig.topics)
      client.subscribe(topics, (error) => {
        if (error) {
          console.error('[MQTT] Subscribe failed:', error)
          toast.error('订阅失败', {
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
            toast.warning('设备离线', {
              description: '智能书包已断开连接',
            })
          } else if (data.status === 'online') {
            currentStore.setDeviceOnline(true)
            toast.success('设备在线', {
              description: '智能书包已恢复连接',
            })
          }
          return
        }

        if (topic === finalConfig.topics.sensors) {
          currentStore.setDeviceOnline(true)

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

          currentStore.setDeviceOnline(true)

          if (typeof lat === 'number' && typeof lng === 'number') {
            currentStore.setGpsCoords([lng, lat])
            console.log('[MQTT] GPS updated:', { lng, lat })
          }
        }
      } catch (error) {
        console.error('[MQTT] Message parse error:', error)
      }
    })

    client.on('error', (error) => {
      console.error('[MQTT] Connection error:', error)
      useIoTStore.getState().setMqttConnectionStatus('error')
      toast.error('MQTT 连接错误', {
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
      toast.info('正在重新连接', {
        description: '尝试恢复 MQTT 连接',
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
      }
    }
  }, [])

  return clientRef.current
}
