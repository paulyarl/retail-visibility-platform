/**
 * Admin Capability Types API Route (Proxy)
 * 
 * Forwards requests to the API server with Auth0 session authentication.
 * Real CRUD operations are handled by apps/api/src/routes/admin/capability-types.ts
 * which queries capability_type_list, capability_features_list, and features_list tables.
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
    const endpoint = `/api/admin/capability-types${queryParams ? `?${queryParams}` : ''}`;

    const response = await authenticatedFetch(endpoint, accessToken, { method: 'GET' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Capability Types Proxy GET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch capability types' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { accessToken } = authResult;
    const requestBody = await request.json();

    const response = await authenticatedFetch('/api/admin/capability-types', accessToken, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Capability Types Proxy POST] Error:', error);
    return NextResponse.json({ error: 'Failed to create capability type' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { accessToken } = authResult;
    const requestBody = await request.json();

    const response = await authenticatedFetch('/api/admin/capability-types', accessToken, {
      method: 'PUT',
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Capability Types Proxy PUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update capability type' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const { accessToken } = authResult;
    const url = new URL(request.url);
    const queryParams = url.searchParams.toString();
    const endpoint = `/api/admin/capability-types${queryParams ? `?${queryParams}` : ''}`;

    const response = await authenticatedFetch(endpoint, accessToken, { method: 'DELETE' });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Capability Types Proxy DELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to delete capability type' }, { status: 500 });
  }
}
