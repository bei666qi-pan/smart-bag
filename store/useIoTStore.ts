// store/useIoTStore.ts
import { create } from 'zustand'

interface IoTState {
  // MQTT Connection Status
  lwtStatus: 'online' | 'offline'
  setLwtStatus: (status: 'online' | 'offline') => void

  // Sensor Data
  battery: number
  temp: number
  humid: number

  // GPS Coordinates [lng, lat]
  gpsCoords: [number, number] | null
  setGpsCoords: (coords: [number, number]) => void

  // Update Methods
  setBattery: (value: number) => void
  setTemp: (value: number) => void
  setHumid: (value: number) => void

  // Hydration
  fetchInitialState: () => Promise<void>
}

export const useIoTStore = create<IoTState>((set) => ({
  // Initial State
  lwtStatus: 'offline',
  battery: 85,
  temp: 24,
  humid: 45,
  gpsCoords: null,

  // Actions
  setLwtStatus: (status) => set({ lwtStatus: status }),
  setBattery: (value) => set({ battery: value }),
  setTemp: (value) => set({ temp: value }),
  setHumid: (value) => set({ humid: value }),
  setGpsCoords: (coords) => set({ gpsCoords: coords }),

  fetchInitialState: async () => {
    try {
      const res = await fetch('/api/iot/state')
      if (!res.ok) return

      const data = await res.json()
      console.log('[Store] Redis 初始状态:', data)

      const patch: Partial<IoTState> = {}
      if (data.status === 'online' || data.status === 'offline') {
        patch.lwtStatus = data.status
      }
      if (typeof data.battery === 'number') patch.battery = data.battery
      if (typeof data.temp === 'number') patch.temp = data.temp
      if (typeof data.humid === 'number') patch.humid = data.humid
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        patch.gpsCoords = [data.lng, data.lat]
      }

      set(patch)
    } catch (e) {
      console.warn('[Store] 初始状态获取失败:', e)
    }
  },
}))
