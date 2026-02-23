import { NextRequest, NextResponse } from 'next/server';
import { tenantInfoService } from '@/services/TenantInfoService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const gateways = await tenantInfoService.getPaymentGateways(id);
    
    return NextResponse.json({ success: true, gateways });
  } catch (error) {
    console.error('[Payment Gateways API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment gateways' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Route to appropriate method based on gateway type
    let result;
    if (body.gateway_type === 'paypal') {
      result = await tenantInfoService.savePayPalGateway(id, body);
    } else if (body.gateway_type === 'square') {
      result = await tenantInfoService.saveSquareGateway(id, body);
    } else {
      // For other gateway types, we might need to add a general method
      // For now, return an error for unsupported gateway types
      return NextResponse.json(
        { error: 'Unsupported gateway type' },
        { status: 400 }
      );
    }
    
    if (!result) {
      return NextResponse.json(
        { error: 'Failed to save payment gateway' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, gateway: result });
  } catch (error) {
    console.error('[Payment Gateways API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save payment gateway' },
      { status: 500 }
    );
  }
}
