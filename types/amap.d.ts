// types/amap.d.ts
/**
 * AMap (高德地图) TypeScript Declarations
 * Official Docs: https://lbs.amap.com/api/jsapi-v2/summary
 */

interface Window {
  _AMapSecurityConfig: {
    securityJsCode: string
  }
  AMap: any
}

declare namespace AMap {
  class Map {
    constructor(container: HTMLElement | string, opts?: MapOptions)
    add(overlays: any | any[]): void
    remove(overlays: any | any[]): void
    destroy(): void
    panTo(position: [number, number], duration?: number): void
    setCenter(center: [number, number]): void
    setZoom(zoom: number): void
    getCenter(): LngLat
    getZoom(): number
    addControl(control: any): void
    on(event: string, callback: (e?: any) => void): void
    off(event: string, callback: (e?: any) => void): void
  }

  interface MapOptions {
    viewMode?: '2D' | '3D'
    zoom?: number
    center?: [number, number]
    rotation?: number
    pitch?: number
    mapStyle?: string
    showLabel?: boolean
    features?: string[]
  }

  class Marker {
    constructor(opts: MarkerOptions)
    setPosition(position: [number, number]): void
    getPosition(): LngLat
    setMap(map: Map | null): void
    on(event: string, callback: (e?: any) => void): void
  }

  interface MarkerOptions {
    position: [number, number]
    icon?: Icon
    offset?: Pixel
    title?: string
    clickable?: boolean
    draggable?: boolean
  }

  class Icon {
    constructor(opts: IconOptions)
  }

  interface IconOptions {
    size: Size
    image: string
    imageSize: Size
    imageOffset?: Pixel
  }

  class Polyline {
    constructor(opts: PolylineOptions)
    setPath(path: [number, number][]): void
    getPath(): LngLat[]
    setMap(map: Map | null): void
  }

  interface PolylineOptions {
    path: [number, number][]
    strokeColor?: string
    strokeWeight?: number
    strokeOpacity?: number
    strokeStyle?: 'solid' | 'dashed'
    lineJoin?: 'miter' | 'round' | 'bevel'
    lineCap?: 'butt' | 'round' | 'square'
  }

  class LngLat {
    constructor(lng: number, lat: number)
    getLng(): number
    getLat(): number
  }

  class Pixel {
    constructor(x: number, y: number)
  }

  class Size {
    constructor(width: number, height: number)
  }

  class Scale {
    constructor(opts?: any)
  }

  class ToolBar {
    constructor(opts?: { position?: string })
  }

  function convertFrom(
    lnglat: [number, number] | [number, number][],
    type: 'gps' | 'baidu' | 'mapbar',
    callback: (status: string, result: any) => void
  ): void
}
