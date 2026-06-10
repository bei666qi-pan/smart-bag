// app/api/camera/status/route.ts
// Read-only observability for the WAN snapshot pipeline. Lets the dashboard show
// whether a snapshot exists and when it last arrived, without changing the
// upload contract in /api/camera/latest (device token + `image` field stay as-is).
import { NextResponse } from 'next/server'
import { stat } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import os from 'os'
import { getSessionUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Must match the snapshot path used by /api/camera/latest.
const UPLOAD_DIR = path.join(os.tmpdir(), 'smart-bag-uploads')
const LATEST_SNAPSHOT = path.join(UPLOAD_DIR, 'latest.jpg')

function emptyStatus() {
  return NextResponse.json(
    { success: true, hasSnapshot: false, lastSnapshotAt: null },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ success: false, message: '未登录' }, { status: 401 })
  }

  try {
    if (!existsSync(LATEST_SNAPSHOT)) {
      return emptyStatus()
    }

    const info = await stat(LATEST_SNAPSHOT)

    return NextResponse.json(
      {
        success: true,
        hasSnapshot: true,
        lastSnapshotAt: new Date(info.mtimeMs).toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    )
  } catch (error) {
    console.error('[Camera Status API] 读取快照状态失败:', error)
    return emptyStatus()
  }
}
