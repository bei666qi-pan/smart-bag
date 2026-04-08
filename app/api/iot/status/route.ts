import { GET as getIoTState } from '../state/route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return getIoTState()
}
