import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(req: Request) {
  try {
    const secret = process.env.REVALIDATE_SECRET || ''
    const hdr = req.headers.get('x-revalidate-secret') || ''
    if (!secret || hdr !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { tenantId?: string, paths?: string[] }
    const tenantId = body?.tenantId
    const paths = Array.isArray(body?.paths) ? body.paths : []

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId_required' }, { status: 400 })
    }

    // Default set of public paths to refresh
    const defaults = [
      `/t/${tenantId}`,
      `/t/${tenantId}/items`,
      `/t/${tenantId}/categories`,
      `/t/${tenantId}/feed-validation`,
    ]

    const targets = [...new Set([...(paths || []), ...defaults])]
    for (const p of targets) {
      try { revalidatePath(p) } catch {}
    }

    return NextResponse.json({ success: true, revalidated: targets }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: 'revalidate_failed' }, { status: 500 })
  }
}
