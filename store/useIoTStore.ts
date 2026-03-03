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
}

export const useIoTStore = create<IoTState>((set) => ({
  // Initial State
  lwtStatus: 'offline',
  battery: 85,
  temp: 24,
  humid: 45,
  gpsCoords: null, // Will be updated by MQTT

  // Actions
  setLwtStatus: (status) => set({ lwtStatus: status }),
  setBattery: (value) => set({ battery: value }),
  setTemp: (value) => set({ temp: value }),
  setHumid: (value) => set({ humid: value }),
  setGpsCoords: (coords) => set({ gpsCoords: coords }),
}))
