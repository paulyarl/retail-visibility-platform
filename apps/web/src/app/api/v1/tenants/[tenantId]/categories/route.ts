import { NextRequest, NextResponse } from 'next/server';
import { getAuth0Session, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;

    // Forward query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    
    // Get optional Auth0 session
    const auth = await getAuth0Session(request);
    const accessToken = auth?.accessToken || null;

    // Backend uses /api/tenant/:tenantId/categories (not /api/v1/tenants)
    const response = await authenticatedFetch(`/api/tenant/${tenantId}/categories${queryString ? `?${queryString}` : ''}`, accessToken, {
      method: 'GET',
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API Proxy] Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const body = await request.json();

    // Get optional Auth0 session
    const auth = await getAuth0Session(request);
    const accessToken = auth?.accessToken || null;

    // Backend uses /api/tenant/:tenantId/categories (not /api/v1/tenants)
    const response = await authenticatedFetch(`/api/tenant/${tenantId}/categories`, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[API Proxy] Error creating category:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
