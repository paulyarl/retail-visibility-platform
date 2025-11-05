import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params
    const base = process.env.API_BASE_URL || 'http://localhost:4000'

    // Get auth token from request cookies
    const token = req.cookies.get('access_token')?.value
    
    console.log('[Tenant Flags API] Cookie check:', { 
      hasToken: !!token, 
      allCookies: req.cookies.getAll().map(c => c.name),
      tenantId 
    })
    
    if (!token) {
      return NextResponse.json({ success: false, error: 'authentication_required', debug: 'no_token_in_cookies' }, { status: 401 })
    }

    const headers: HeadersInit = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }

    const res = await fetch(`${base}/api/admin/tenant-flags/${encodeURIComponent(tenantId)}`, { headers, cache: 'no-store' })
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

export async function PUT(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params
    const body = await req.json()
    const base = process.env.API_BASE_URL || 'http://localhost:4000'
    
    // Get auth token from request cookies
    const token = req.cookies.get('access_token')?.value
    
    if (!token) {
      return NextResponse.json({ success: false, error: 'authentication_required' }, { status: 401 })
    }

    const headers: HeadersInit = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
    const url = `${base}/api/admin/tenant-flags/${encodeURIComponent(tenantId)}/${encodeURIComponent((body?.flag)||'')}`
    const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) })
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
