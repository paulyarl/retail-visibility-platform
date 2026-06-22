/**
 * Admin BSaaS Catalog API Route (Proxy)
 *
 * Forwards requests to the API server with Auth0 session authentication.
 * Real CRUD operations are handled by apps/api/src/routes/admin/bsaas-catalog.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { accessToken } = authResult;
    const url = new URL(request.url);
    const queryParams = url.searchParams.toString();
    const endpoint = `/api/admin/bsaas-catalog${queryParams ? `?${queryParams}` : ''}`;

    const response = await authenticatedFetch(endpoint, accessToken, { method: 'GET' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[BSaaS Catalog Proxy GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch BSaaS catalog' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { accessToken } = authResult;
    const requestBody = await request.json();

    const response = await authenticatedFetch('/api/admin/bsaas-catalog', accessToken, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[BSaaS Catalog Proxy POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create BSaaS catalog entry' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { accessToken } = authResult;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const requestBody = await request.json();

    const endpoint = `/api/admin/bsaas-catalog${id ? `?id=${id}` : ''}`;

    const response = await authenticatedFetch(endpoint, accessToken, {
      method: 'PUT',
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[BSaaS Catalog Proxy PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update BSaaS catalog entry' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { accessToken } = authResult;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    const endpoint = `/api/admin/bsaas-catalog${id ? `?id=${id}` : ''}`;

    const response = await authenticatedFetch(endpoint, accessToken, { method: 'DELETE' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[BSaaS Catalog Proxy DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to delete BSaaS catalog entry' }, { status: 500 });
  }
}
