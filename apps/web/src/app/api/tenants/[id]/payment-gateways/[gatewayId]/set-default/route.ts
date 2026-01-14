import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gatewayId: string }> }
) {
  try {
    const { id, gatewayId } = await params;
    
    // Forward Authorization header
    const authHeader = request.headers.get('authorization');
    const headers: HeadersInit = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(
      `${API_BASE_URL}/api/tenants/${id}/payment-gateways/${gatewayId}/set-default`,
      {
        method: 'POST',
        headers,
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Payment Gateways API] Set default error:', error);
    return NextResponse.json(
      { error: 'proxy_failed' },
      { status: 500 }
    );
  }
}
