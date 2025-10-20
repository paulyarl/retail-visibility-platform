import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId') ?? 'demo-tenant';
  const res = await fetch(`http://localhost:4000/items?tenantId=${encodeURIComponent(tenantId)}`);
  const data = await res.json();
  return NextResponse.json(data);
}
