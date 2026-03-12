import { NextRequest, NextResponse } from 'next/server';
import { itemsService } from '@/services/ItemsSingletonService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // Extract and validate tenant_id
    const tenantId = searchParams.get('tenant_id');
    if (!tenantId) {
      return NextResponse.json({ 
        error: 'tenant_id_required',
        message: 'Tenant ID is required' 
      }, { status: 400 });
    }

    // Build params for service
    const params = {
      tenant_id: tenantId,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '50'),
      q: searchParams.get('q') || undefined,
      status: searchParams.get('status') as any || undefined,
      visibility: searchParams.get('visibility') as any || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      categoryFilter: searchParams.get('categoryFilter') as any || undefined,
    };

    // Get items using service with automatic caching
    const itemsData = await itemsService.getItemsComplete(params);
    
    if (!itemsData) {
      return NextResponse.json({ 
        error: 'items_not_found',
        message: 'Unable to fetch items' 
      }, { status: 404 });
    }
    
    return NextResponse.json(itemsData);
  } catch (error) {
    console.error('[Items API] Error:', error);
    return NextResponse.json({ 
      error: 'internal_server_error',
      message: 'Failed to fetch items' 
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Extract tenant_id from body or query
    const tenantId = body.tenant_id || (new URL(req.url).searchParams.get('tenant_id'));
    if (!tenantId) {
      return NextResponse.json({ 
        error: 'tenant_id_required',
        message: 'Tenant ID is required' 
      }, { status: 400 });
    }

    // Create item using service with automatic cache invalidation
    const newItem = await itemsService.createItem(body, tenantId);
    
    if (!newItem) {
      return NextResponse.json({ 
        error: 'creation_failed',
        message: 'Failed to create item' 
      }, { status: 400 });
    }
    
    return NextResponse.json(newItem, { status: 201 });
  } catch (error) {
    console.error('[Items API POST] Error:', error);
    return NextResponse.json({ 
      error: 'internal_server_error',
      message: 'Failed to create item' 
    }, { status: 500 });
  }
}
