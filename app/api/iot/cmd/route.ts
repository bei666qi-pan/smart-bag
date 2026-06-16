import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { publishDeviceCommand } from '@/lib/iot/mqtt-command'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_ACTIONS = new Set(['mode_switch', 'screen_text', 'set_timetable'])
const MAX_VALUE_LEN = 200

// 下发设备指令到 v5/bag/cmd。
// 之前是浏览器匿名直连 MQTT 发布，任何知道 broker+topic 的人都能注入指令；
// 现改为：必须登录 -> 服务端用 server 账号下发。配合 broker ACL 收掉匿名写 cmd。
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: '未登录' }, { status: 401 })
  }

  if (!process.env.MQTT_SERVER_URL) {
    return NextResponse.json({ ok: false, error: 'mqtt_unconfigured' }, { status: 503 })
  }

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id.trim() : ''
  const action = typeof body?.action === 'string' ? body.action : ''
  const value = typeof body?.value === 'string' ? body.value : ''

  if (!id || !ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: 'invalid_command' }, { status: 400 })
  }
  if (value.length > MAX_VALUE_LEN) {
    return NextResponse.json({ ok: false, error: 'value_too_long' }, { status: 400 })
  }

  try {
    await publishDeviceCommand({ id, action, value })
    console.log('[CMD API] published by', user.username, { id, action })
    return NextResponse.json({ ok: true, cmd_id: id })
  } catch (error) {
    console.error('[CMD API] publish failed:', error)
    return NextResponse.json({ ok: false, error: 'publish_failed' }, { status: 502 })
  }
}
