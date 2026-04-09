import { GET as getIoTState } from '../state/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return getIoTState()
}
