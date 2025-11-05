import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function PUT(req: NextRequest, context: { params: Promise<{ tenantId: string, flag: string }> }) {
  try {
    const { tenantId, flag } = await context.params
    const base = process.env.API_BASE_URL || 'http://localhost:4000'
    
    // Get auth token from request cookies - try multiple methods
    let token = req.cookies.get('access_token')?.value
    
    // Fallback: parse from cookie header directly
    if (!token) {
      const cookieHeader = req.headers.get('cookie')
      if (cookieHeader) {
        const match = cookieHeader.match(/access_token=([^;]+)/)
        if (match) {
          token = match[1]
        }
      }
    }
    
    if (!token) {
      return NextResponse.json({ success: false, error: 'authentication_required' }, { status: 401 })
    }

    const headers: HeadersInit = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
    const body = await req.json()
    // Forward to API
    const res = await fetch(`${base}/api/admin/tenant-flags/${encodeURIComponent(tenantId)}/${encodeURIComponent(flag)}` , {
      method: 'PUT',
      headers,
      body: JSON.stringify(body || {}),
    })
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      const text = await res.text()
      return NextResponse.json({ success: false, error: text || `HTTP ${res.status}` }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'proxy_failed' }, { status: 500 })
  }
}
