import { NextRequest, NextResponse } from 'next/server';
import { tenantInfoService } from '@/services/TenantInfoSingletonService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gatewayId: string }> }
) {
  try {
    const { id, gatewayId } = await params;
    
    const result = await tenantInfoService.setDefaultPaymentGateway(id, gatewayId);
    
    if (!result) {
      return NextResponse.json(
        { error: 'Failed to set default payment gateway' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, gateway: result });
  } catch (error) {
    console.error('[Payment Gateways API] Set default error:', error);
    return NextResponse.json(
      { error: 'Failed to set default payment gateway' },
      { status: 500 }
    );
  }
}
