import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    // Preserve query parameters (e.g. includeArchived, status) when proxying to the API
    const url = new URL(req.url);
    const query = url.searchParams.toString();
    
    // Get tenants using the singleton service
    const tenants = await platformHomeService.getTenants();
    
    return NextResponse.json(tenants);
  } catch (error) {
    console.error('[API Proxy] Error response:', error);
    return NextResponse.json({ error: 'upstream_failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Create tenant using the singleton service
    const tenant = await platformHomeService.createTenant({
      name: body.name,
      slug: body.slug,
      city: body.city,
      state: body.state,
      country_code: body.country_code || body.country
    });
    
    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    console.error('[API Proxy] Error creating tenant:', error);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}
