import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gatewayId: string }> }
) {
  try {
    const { id, gatewayId } = await params;
    const body = await request.json();
    
    // Forward Authorization header
    const authHeader = request.headers.get('authorization');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(
      `${API_BASE_URL}/api/tenants/${id}/payment-gateways/${gatewayId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Payment Gateways API] PATCH error:', error);
    return NextResponse.json(
      { error: 'proxy_failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
      `${API_BASE_URL}/api/tenants/${id}/payment-gateways/${gatewayId}`,
      {
        method: 'DELETE',
        headers,
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('[Payment Gateways API] DELETE error:', error);
    return NextResponse.json(
      { error: 'proxy_failed' },
      { status: 500 }
    );
  }
}
