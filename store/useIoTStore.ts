import { create } from 'zustand'

export type MqttConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'error'

interface IoTState {
  mqttConnectionStatus: MqttConnectionStatus
  setMqttConnectionStatus: (status: MqttConnectionStatus) => void

  deviceOnline: boolean
  setDeviceOnline: (online: boolean) => void

  lastSeenAt: string | null
  setLastSeenAt: (timestamp: string | null) => void
  markLastSeen: () => void

  battery: number
  temp: number
  humid: number

  gpsCoords: [number, number] | null
  setGpsCoords: (coords: [number, number]) => void

  setBattery: (value: number) => void
  setTemp: (value: number) => void
  setHumid: (value: number) => void

  fetchInitialState: () => Promise<void>
}

function logStateTransition(label: string, previous: unknown, next: unknown) {
  if (previous !== next) {
    console.log(`[Store] ${label}:`, previous, '->', next)
  }
}

export const useIoTStore = create<IoTState>((set) => ({
  mqttConnectionStatus: 'disconnected',
  deviceOnline: false,
  lastSeenAt: null,
  battery: 85,
  temp: 24,
  humid: 45,
  gpsCoords: null,

  setMqttConnectionStatus: (status) =>
    set((state) => {
      logStateTransition('MQTT connection status', state.mqttConnectionStatus, status)
      return { mqttConnectionStatus: status }
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

  fetchInitialState: async () => {
    try {
      const res = await fetch('/api/iot/status', { cache: 'no-store' })
      if (!res.ok) {
        console.warn('[Store] Initial IoT state request failed:', res.status)
        return
      }

      const data = await res.json()
      console.log('[Store] Initial IoT state:', data)

      const patch: Partial<IoTState> = {}

      if (typeof data.deviceOnline === 'boolean') {
        patch.deviceOnline = data.deviceOnline
      } else if (data.status === 'online' || data.status === 'offline') {
        patch.deviceOnline = data.status === 'online'
      }

      if (typeof data.battery === 'number') patch.battery = data.battery
      if (typeof data.temp === 'number') patch.temp = data.temp
      if (typeof data.humid === 'number') patch.humid = data.humid
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        patch.gpsCoords = [data.lng, data.lat]
      }
      if (typeof data.lastSeenAt === 'string' || data.lastSeenAt === null) {
        patch.lastSeenAt = data.lastSeenAt
      }

      set(patch)
    } catch (error) {
      console.warn('[Store] Failed to fetch initial IoT state:', error)
    }
  },
}))
