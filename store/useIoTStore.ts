import { create } from 'zustand'
import type { MqttClient } from 'mqtt'

export type MqttConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'error'

export type IoTApiFetchStatus = 'idle' | 'loading' | 'success' | 'error'

export type IoTCmdType = 'mode_switch' | 'screen_text'

export type IoTCmdAck = {
  cmd_id: string
  status: number
  msg?: string
  ts?: string
}

export type PendingCommand = {
  cmd_id: string
  type: IoTCmdType
  value: string
  sentAt: string
}

interface IoTState {
  mqttConnectionStatus: MqttConnectionStatus
  setMqttConnectionStatus: (status: MqttConnectionStatus) => void

  iotApiFetchStatus: IoTApiFetchStatus
  iotApiError: string | null
  setIoTApiFetchStatus: (status: IoTApiFetchStatus, error?: string | null) => void

  deviceOnline: boolean
  setDeviceOnline: (online: boolean) => void

  lastSeenAt: string | null
  setLastSeenAt: (timestamp: string | null) => void
  markLastSeen: () => void

  battery: number | null
  temp: number | null
  humid: number | null

  gpsCoords: [number, number] | null
  setGpsCoords: (coords: [number, number]) => void

  setBattery: (value: number | null) => void
  setTemp: (value: number | null) => void
  setHumid: (value: number | null) => void

  mqttClient: MqttClient | null
  setMqttClient: (client: MqttClient | null) => void

  pendingCmd: PendingCommand | null
  lastCmdAck: IoTCmdAck | null
  cmdError: string | null
  setPendingCmd: (cmd: PendingCommand | null) => void
  setLastCmdAck: (ack: IoTCmdAck | null) => void
  setCmdError: (error: string | null) => void
  publishCommand: (action: IoTCmdType, value: string) => { ok: boolean; cmd_id?: string; error?: string }

  fetchInitialState: () => Promise<void>
}

function logStateTransition(label: string, previous: unknown, next: unknown) {
  if (previous !== next) {
    console.log(`[Store] ${label}:`, previous, '->', next)
  }
}

export const useIoTStore = create<IoTState>()((set) => ({
    mqttConnectionStatus: 'disconnected',
    iotApiFetchStatus: 'idle',
    iotApiError: null,
    deviceOnline: false,
    lastSeenAt: null,
    battery: null,
    temp: null,
    humid: null,
    gpsCoords: null,
    mqttClient: null,
    pendingCmd: null,
    lastCmdAck: null,
    cmdError: null,

    setMqttConnectionStatus: (status) =>
      set((state) => {
        logStateTransition('MQTT connection status', state.mqttConnectionStatus, status)
        return { mqttConnectionStatus: status }
      }),

    setIoTApiFetchStatus: (status, error = null) =>
      set((state) => {
        logStateTransition('IoT API fetch status', state.iotApiFetchStatus, status)
        return { iotApiFetchStatus: status, iotApiError: error }
      }),

    setDeviceOnline: (online) =>
      set((state) => {
        logStateTransition('Device online', state.deviceOnline, online)
        return { deviceOnline: online }
      }),

    setLastSeenAt: (timestamp) =>
      set((state) => {
        logStateTransition('Last seen at', state.lastSeenAt, timestamp)
        return { lastSeenAt: timestamp }
      }),

    markLastSeen: () =>
      set((state) => {
        const timestamp = new Date().toISOString()
        logStateTransition('Last seen at', state.lastSeenAt, timestamp)
        return { lastSeenAt: timestamp }
      }),

    setBattery: (value) => set({ battery: value }),
    setTemp: (value) => set({ temp: value }),
    setHumid: (value) => set({ humid: value }),
    setGpsCoords: (coords) => set({ gpsCoords: coords }),

    setMqttClient: (client) => set({ mqttClient: client }),

    setPendingCmd: (cmd) => set({ pendingCmd: cmd }),
    setLastCmdAck: (ack) => set({ lastCmdAck: ack }),
    setCmdError: (error) => set({ cmdError: error }),

    publishCommand: (action, value) => {
      const state = useIoTStore.getState()
      const client = state.mqttClient

      if (!client) {
        return { ok: false, error: 'MQTT 客户端尚未初始化' }
      }

      if (state.mqttConnectionStatus !== 'connected') {
        return { ok: false, error: 'MQTT 未连接，无法下发命令' }
      }

      const cmd_id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `cmd_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`
      const sentAt = new Date().toISOString()
      const body = JSON.stringify({ id: cmd_id, action, value })

      try {
        state.setCmdError(null)
        state.setPendingCmd({ cmd_id, type: action, value, sentAt })

        client.publish('v5/bag/cmd', body, { qos: 1 }, (error) => {
          if (error) {
            console.error('[MQTT] Publish command failed:', error)
            const currentState = useIoTStore.getState()
            currentState.setPendingCmd(null)
            currentState.setCmdError(error.message)
            return
          }

          console.log('[MQTT] Command published:', { cmd_id, action, value })
        })

        return { ok: true, cmd_id }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown_error'
        state.setCmdError(message)
        state.setPendingCmd(null)
        return { ok: false, error: message }
      }
    },

    fetchInitialState: async () => {
      useIoTStore.getState().setIoTApiFetchStatus('loading')
      try {
        const res = await fetch('/api/iot/status', { cache: 'no-store' })
        if (!res.ok) {
          console.warn('[Store] Initial IoT state request failed:', res.status)
          useIoTStore.getState().setIoTApiFetchStatus('error', `http_${res.status}`)
          return
        }

        const data = await res.json()
        console.log('[Store] Initial IoT state:', data)
        useIoTStore.getState().setIoTApiFetchStatus('success', null)

        const patch: Partial<IoTState> = {
          battery: typeof data.battery === 'number' ? data.battery : null,
          temp: typeof data.temp === 'number' ? data.temp : null,
          humid: typeof data.humid === 'number' ? data.humid : null,
          gpsCoords:
            typeof data.lat === 'number' && typeof data.lng === 'number'
              ? [data.lng, data.lat]
              : null,
        }
        // NOTE: deviceOnline is strictly derived from v5/bag/status on the client side.
        // API initial state should not override deviceOnline to avoid mixing semantics.

        if (typeof data.lastSeenAt === 'string' || data.lastSeenAt === null) {
          patch.lastSeenAt = data.lastSeenAt
        }

        set(patch)
      } catch (error) {
        console.warn('[Store] Failed to fetch initial IoT state:', error)
        useIoTStore
          .getState()
          .setIoTApiFetchStatus('error', error instanceof Error ? error.message : 'unknown_error')
      }
    },
}))
