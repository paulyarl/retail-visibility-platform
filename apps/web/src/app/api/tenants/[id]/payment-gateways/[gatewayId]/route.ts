import { NextRequest, NextResponse } from 'next/server';
import { tenantInfoService } from '@/services/TenantInfoSingletonService';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; gatewayId: string }> }
) {
  try {
    const { id, gatewayId } = await params;
    const body = await request.json();
    
    // Handle different update scenarios
    let result;
    if (body.hasOwnProperty('is_active')) {
      // Update active status
      result = await tenantInfoService.updatePaymentGatewayStatus(id, gatewayId, body.is_active);
    } else {
      // For other updates, we might need to add a general update method
      // For now, return an error for unsupported update types
      return NextResponse.json(
        { error: 'Unsupported update type' },
        { status: 400 }
      );
    }
    
    if (!result) {
      return NextResponse.json(
        { error: 'Failed to update payment gateway' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, gateway: result });
  } catch (error) {
    console.error('[Payment Gateways API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update payment gateway' },
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
    
    const result = await tenantInfoService.deletePaymentGateway(id, gatewayId);
    
    if (!result) {
      return NextResponse.json(
        { error: 'Failed to delete payment gateway' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Payment Gateways API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete payment gateway' },
      { status: 500 }
    );
  }
}
