// lib/coord-transform.ts
/**
 * WGS-84 to GCJ-02 (火星坐标系) Coordinate Transformation
 * 用于 GPS 原始坐标转换为高德地图使用的 GCJ-02 坐标系
 * 
 * Reference: https://en.wikipedia.org/wiki/Restrictions_on_geographic_data_in_China
 */

const PI = Math.PI
const X_PI = (PI * 3000.0) / 180.0
const A = 6378245.0 // 长半轴
const EE = 0.00669342162296594323 // 扁率

/**
 * 判断坐标是否在中国境外
 */
function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

/**
 * 转换纬度
 */
function transformLat(lng: number, lat: number): number {
  let ret =
    -100.0 +
    2.0 * lng +
    3.0 * lat +
    0.2 * lat * lat +
    0.1 * lng * lat +
    0.2 * Math.sqrt(Math.abs(lng))
  ret +=
    ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0
  ret +=
    ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) / 3.0
  ret +=
    ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) * 2.0) / 3.0
  return ret
}

/**
 * 转换经度
 */
function transformLng(lng: number, lat: number): number {
  let ret =
    300.0 +
    lng +
    2.0 * lat +
    0.1 * lng * lng +
    0.1 * lng * lat +
    0.1 * Math.sqrt(Math.abs(lng))
  ret +=
    ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0
  ret +=
    ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) / 3.0
  ret +=
    ((150.0 * Math.sin((lng / 12.0) * PI) + 300.0 * Math.sin((lng / 30.0) * PI)) * 2.0) / 3.0
  return ret
}

/**
 * WGS-84 转 GCJ-02 (火星坐标系)
 * @param wgsLng WGS-84 经度
 * @param wgsLat WGS-84 纬度
 * @returns [gcjLng, gcjLat] GCJ-02 坐标
 */
export function wgs84ToGcj02(wgsLng: number, wgsLat: number): [number, number] {
  // 中国境外不做偏移
  if (outOfChina(wgsLng, wgsLat)) {
    return [wgsLng, wgsLat]
  }

  let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0)
  let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0)

  const radLat = (wgsLat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)

  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)

  const gcjLat = wgsLat + dLat
  const gcjLng = wgsLng + dLng

  return [gcjLng, gcjLat]
}

/**
 * GCJ-02 转 WGS-84 (粗略逆转换)
 * 注意: 这是近似算法,精度约 1-2 米
 */
export function gcj02ToWgs84(gcjLng: number, gcjLat: number): [number, number] {
  if (outOfChina(gcjLng, gcjLat)) {
    return [gcjLng, gcjLat]
  }

  let dLat = transformLat(gcjLng - 105.0, gcjLat - 35.0)
  let dLng = transformLng(gcjLng - 105.0, gcjLat - 35.0)

  const radLat = (gcjLat / 180.0) * PI
  let magic = Math.sin(radLat)
  magic = 1 - EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)

  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI)
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI)

  const wgsLat = gcjLat - dLat
  const wgsLng = gcjLng - dLng

  return [wgsLng, wgsLat]
}

/**
 * 辅助函数: 转换坐标数组 [lng, lat]
 */
export function convertWgs84ToGcj02Coords(coords: [number, number]): [number, number] {
  return wgs84ToGcj02(coords[0], coords[1])
}
