import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await redis.hgetall('bag:latest')

    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json({
        status: 'offline',
        battery: null,
        temp: null,
        humid: null,
        lat: null,
        lng: null,
      })
    }

    return NextResponse.json({
      status: data.status || 'offline',
      battery: data.battery ? Number(data.battery) : null,
      temp: data.temp ? Number(data.temp) : null,
      humid: data.humid ? Number(data.humid) : null,
      lat: data.lat ? Number(data.lat) : null,
      lng: data.lng ? Number(data.lng) : null,
    })
  } catch (error) {
    console.error('[API] Redis 读取失败:', error)
    return NextResponse.json(
      { error: '无法获取设备状态' },
      { status: 500 }
    )
  }
}
