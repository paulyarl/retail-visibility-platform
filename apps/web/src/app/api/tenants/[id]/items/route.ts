import { NextResponse } from 'next/server';
import { itemsService } from '@/services/ItemsSingletonService';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    
    if (!tenantId) {
      return NextResponse.json({ 
        error: 'tenant_id_required',
        message: 'Tenant ID is required' 
      }, { status: 400 });
    }

    // Get items for this tenant using service with automatic caching
    const itemsData = await itemsService.getItemsComplete({
      tenant_id: tenantId,
      page: 1,
      limit: 100, // Default limit for tenant items
      status: 'all',
      visibility: 'all'
    });
    
    if (!itemsData) {
      return NextResponse.json([]);
    }
    
    return NextResponse.json(itemsData.items);
  } catch (error) {
    console.error('[Tenant Items API] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to fetch tenant items' 
      },
      { status: 500 }
    );
  }
}
