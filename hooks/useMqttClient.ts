// hooks/useMqttClient.ts
"use client"

import { useEffect, useRef } from 'react'
import mqtt, { MqttClient } from 'mqtt'
import { useIoTStore } from '@/store/useIoTStore'
import { toast } from 'sonner'

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
  // IMPORTANT:
  // - In production behind Traefik, prefer setting NEXT_PUBLIC_MQTT_URL to a public WS(S) endpoint.
  // - Mosquitto WebSocket listener commonly exposes MQTT over WS at path "/mqtt".
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

  const { setLwtStatus, setBattery, setTemp, setHumid, setGpsCoords } = useIoTStore()

  useEffect(() => {
    // Pattern B: Idempotency Check - Prevent Strict Mode zombie connections
    if (clientRef.current) {
      console.log('[MQTT] Client already exists, skipping initialization')
      return
    }

    // Hydrate from Redis before WebSocket takes over
    useIoTStore.getState().fetchInitialState()

    // Generate persistent session ID
    const clientId = `web_${Math.random().toString(16).slice(2, 8)}`

    console.log('[MQTT] Initializing client:', clientId)

    // Derive WS path:
    // - If brokerUrl already includes a non-root pathname (e.g. wss://host/ws), respect it.
    // - Otherwise use configured wsPath (default: /mqtt).
    let wsPath = finalConfig.wsPath || '/mqtt'
    try {
      const parsed = new URL(finalConfig.brokerUrl)
      if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname !== '') {
        wsPath = parsed.pathname
      }
    } catch {
      // Non-URL strings are allowed by mqtt.js; keep default wsPath.
    }

    // Initialize MQTT client
    const client = mqtt.connect(finalConfig.brokerUrl, {
      clientId,
      keepalive: 60,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 30000,
      // NOTE: only affects WS/WSS transports; safe for tcp URLs too.
      path: wsPath,
    })

    clientRef.current = client

    // Connection Events
    client.on('connect', () => {
      console.log('[MQTT] 连接成功')
      toast.success('MQTT 连接成功', {
        description: '设备通信已建立',
      })

      // Subscribe to topics
      const topics = Object.values(finalConfig.topics)
      client.subscribe(topics, (err) => {
        if (err) {
          console.error('[MQTT] 订阅失败:', err)
          toast.error('订阅失败', {
            description: err.message,
          })
        } else {
          console.log('[MQTT] 订阅成功:', topics)
        }
      })
    })

    // Message Handler
    client.on('message', (topic, payload) => {
      try {
        const message = payload.toString()
        console.log(`[MQTT] 收到消息 [${topic}]:`, message)

        // LWT Status Handler
        if (topic === finalConfig.topics.lwt) {
          const data = JSON.parse(message)
          
          if (data.status === 'offline') {
            setLwtStatus('offline')
            toast.warning('设备离线', {
              description: '智能书包已断开连接',
            })
          } else if (data.status === 'online') {
            setLwtStatus('online')
            toast.success('设备在线', {
              description: '智能书包已重新连接',
            })
          }
        }

        // Sensor Data Handler
        if (topic === finalConfig.topics.sensors) {
          const data = JSON.parse(message)
          
          if (typeof data.battery === 'number') {
            setBattery(data.battery)
          }
          if (typeof data.temp === 'number') {
            setTemp(data.temp)
          }
          if (typeof data.humid === 'number') {
            setHumid(data.humid)
          }
        }

        // GPS Data Handler
        if (topic === finalConfig.topics.gps) {
          const data = JSON.parse(message)
          
          // Expected format: { lat: number, lng: number } or { latitude: number, longitude: number }
          const lat = data.lat || data.latitude
          const lng = data.lng || data.longitude
          
          if (typeof lat === 'number' && typeof lng === 'number') {
            setGpsCoords([lng, lat]) // Mapbox uses [lng, lat] format
            console.log('[MQTT] GPS 更新:', { lng, lat })
          }
        }
      } catch (error) {
        console.error('[MQTT] 消息解析错误:', error)
      }
    })

    // Error Handler
    client.on('error', (error) => {
      console.error('[MQTT] 连接错误:', error)
      toast.error('MQTT 连接错误', {
        description: error.message,
      })
    })

    // Disconnect Handler
    client.on('close', () => {
      console.log('[MQTT] 连接断开')
      setLwtStatus('offline')
    })

    // Reconnect Handler
    client.on('reconnect', () => {
      console.log('[MQTT] 正在重新连接...')
      toast.info('正在重新连接', {
        description: '尝试恢复 MQTT 连接',
      })
    })

    // Offline Handler
    client.on('offline', () => {
      console.log('[MQTT] 客户端离线')
      setLwtStatus('offline')
    })

    // Cleanup: Critical for Strict Mode
    return () => {
      if (clientRef.current) {
        console.log('[MQTT] 清理连接...')
        clientRef.current.end(true) // Force close
        clientRef.current = null
      }
    }
  }, []) // Empty dependency array - run once per mount

  return clientRef.current
}
