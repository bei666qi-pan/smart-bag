// app/api/camera/latest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import os from 'os'
import { getSessionUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Use /tmp for Docker-safe writable uploads
const UPLOAD_DIR = path.join(os.tmpdir(), 'smart-bag-uploads')
const LATEST_SNAPSHOT = path.join(UPLOAD_DIR, 'latest.jpg')
// 设备上传令牌：从环境变量读取，绝不硬编码（ESP32 侧需同步配置同一令牌）
const DEVICE_TOKEN = process.env.DEVICE_TOKEN?.trim() || ''

function createEmptySnapshotResponse(message = '暂无快照') {
  return NextResponse.json(
    {
      success: true,
      hasSnapshot: false,
      message,
      timestamp: null,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}

// Ensure upload directory exists (best-effort, tolerant of read-only failures)
async function ensureUploadDir() {
  try {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }
  } catch (error) {
    console.error('[Camera API] 创建上传目录失败:', error)
  }
}

// POST: ESP32 uploads snapshot
export async function POST(request: NextRequest) {
  try {
    // 设备静态令牌校验（未配置 DEVICE_TOKEN 时直接拒绝所有上传，避免裸奔）
    const deviceToken = request.headers.get('x-device-token')
    if (!DEVICE_TOKEN || deviceToken !== DEVICE_TOKEN) {
      if (!DEVICE_TOKEN) {
        console.error('[Camera API] DEVICE_TOKEN 未配置，已拒绝设备上传')
      }
      return NextResponse.json(
        { success: false, message: 'Unauthorized Device' },
        { status: 401 }
      )
    }

    await ensureUploadDir()

    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json(
        { success: false, message: '未找到图片文件' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(LATEST_SNAPSHOT, buffer)

    console.log('[Camera API] 快照已更新:', new Date().toISOString())

    return NextResponse.json({
      success: true,
      message: '快照上传成功',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Camera API] 上传错误:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误' },
      { status: 500 }
    )
  }
}

// GET: Web client fetches latest snapshot
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  try {
    // Gracefully handle missing or unreadable snapshot file
    try {
      if (!existsSync(LATEST_SNAPSHOT)) {
        return createEmptySnapshotResponse()
      }

      const buffer = await readFile(LATEST_SNAPSHOT)

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      })
    } catch (innerError) {
      console.error('[Camera API] 快照读取失败:', innerError)
      return createEmptySnapshotResponse('快照暂不可用')
    }
  } catch (error) {
    console.error('[Camera API] 读取错误:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误' },
      { status: 500 }
    )
  }
}
