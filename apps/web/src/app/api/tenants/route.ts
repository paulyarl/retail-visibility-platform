import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  // Get authenticated user
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const base = process.env.API_BASE_URL || 'http://localhost:4000';
  console.log('[API Proxy] Fetching tenants from:', `${base}/tenants`);
  console.log('[API Proxy] User ID:', user.id);
  console.log('[API Proxy] User Email:', user.email);
  
  // Pass user ID and email to backend for filtering
  const res = await fetch(`${base}/tenants`, {
    headers: {
      'X-User-Id': user.id,
      'X-User-Email': user.email || '',
      // Optional: Pass user role if available in metadata
      'X-User-Role': (user.user_metadata?.role || 'business_owner') as string,
    },
  });
  
  console.log('[API Proxy] Response status:', res.status);
  
  if (!res.ok) {
    const text = await res.text();
    console.error('[API Proxy] Error response:', text);
    return NextResponse.json({ error: 'upstream_failed', status: res.status, body: text }, { status: res.status });
  }
  
  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const base = process.env.API_BASE_URL || 'http://localhost:4000';
    const res = await fetch(`${base}/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (_e) {
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
