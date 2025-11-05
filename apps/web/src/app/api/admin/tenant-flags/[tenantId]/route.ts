import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params
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
    
    console.log('[Tenant Flags API] Cookie check:', { 
      hasToken: !!token, 
      allCookies: req.cookies.getAll().map(c => c.name),
      hasCookieHeader: !!req.headers.get('cookie'),
      tenantId 
    })
    
    if (!token) {
      return NextResponse.json({ 
        success: false, 
        error: 'authentication_required', 
        debug: {
          message: 'no_token_in_cookies',
          availableCookies: req.cookies.getAll().map(c => c.name),
          hasCookieHeader: !!req.headers.get('cookie')
        }
      }, { status: 401 })
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
