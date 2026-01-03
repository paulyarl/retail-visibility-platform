import { api } from '@/lib/api';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/tenants/[id]/tier
 * Proxy to backend tier endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    
    // Get auth token from request
    const authHeader = request.headers.get('authorization') || request.headers.get('cookie');
    
    const response = await api.get(`${apiUrl}/api/tenants/${tenantId}/tier`, {
      headers: {
        'Authorization': authHeader || '',
        'Cookie': request.headers.get('cookie') || '',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch tier information' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Tier API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
