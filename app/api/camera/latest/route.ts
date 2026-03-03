// app/api/camera/latest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const LATEST_SNAPSHOT = path.join(UPLOAD_DIR, 'latest.jpg')

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true })
  }
}

// POST: ESP32 uploads snapshot
export async function POST(request: NextRequest) {
  try {
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
  try {
    await ensureUploadDir()

    if (!existsSync(LATEST_SNAPSHOT)) {
      return NextResponse.json(
        { success: false, message: '暂无快照' },
        { status: 404 }
      )
    }

    const buffer = await readFile(LATEST_SNAPSHOT)
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    console.error('[Camera API] 读取错误:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误' },
      { status: 500 }
    )
  }
}
