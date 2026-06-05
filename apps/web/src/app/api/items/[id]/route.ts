import { NextRequest, NextResponse } from 'next/server';
import { itemsService } from '@/services/ItemsSingletonService';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Get item using service with automatic caching
    const item = await itemsService.getItem(id);
    
    if (!item) {
      return NextResponse.json({ 
        error: 'item_not_found',
        message: 'Item not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json(item);
  } catch (error) {
    console.error('[Items API GET] Error:', error);
    return NextResponse.json({ 
      error: 'internal_server_error',
      message: 'Failed to fetch item' 
    }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    // Extract tenant_id from body or query
    const tenantId = body.tenant_id || (new URL(req.url).searchParams.get('tenant_id'));
    if (!tenantId) {
      return NextResponse.json({ 
        error: 'tenant_id_required',
        message: 'Tenant ID is required' 
      }, { status: 400 });
    }

    // Update item using service with automatic cache invalidation
    const updatedItem = await itemsService.updateItem(id, body, tenantId);
    
    if (!updatedItem) {
      return NextResponse.json({ 
        error: 'update_failed',
        message: 'Failed to update item' 
      }, { status: 400 });
    }
    
    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('[Items API PUT] Error:', error);
    return NextResponse.json({ 
      error: 'internal_server_error',
      message: 'Failed to update item' 
    }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    // Extract tenant_id from body or query
    const tenantId = body.tenant_id || (new URL(req.url).searchParams.get('tenant_id'));
    if (!tenantId) {
      return NextResponse.json({ 
        error: 'tenant_id_required',
        message: 'Tenant ID is required' 
      }, { status: 400 });
    }

    // PATCH is same as PUT for items - use updateItem method
    const updatedItem = await itemsService.updateItem(id, body, tenantId);
    
    if (!updatedItem) {
      return NextResponse.json({ 
        error: 'update_failed',
        message: 'Failed to update item' 
      }, { status: 400 });
    }
    
    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('[Items API PATCH] Error:', error);
    return NextResponse.json({ 
      error: 'internal_server_error',
      message: 'Failed to update item' 
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Extract tenant_id from query
    const tenantId = new URL(req.url).searchParams.get('tenant_id');
    if (!tenantId) {
      return NextResponse.json({ 
        error: 'tenant_id_required',
        message: 'Tenant ID is required' 
      }, { status: 400 });
    }

    // Delete item using service with automatic cache invalidation
    const success = await itemsService.deleteItem(id, tenantId);
    
    if (!success) {
      return NextResponse.json({ 
        error: 'delete_failed',
        message: 'Failed to delete item' 
      }, { status: 400 });
    }
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[Items API DELETE] Error:', error);
    return NextResponse.json({ 
      error: 'internal_server_error',
      message: 'Failed to delete item' 
    }, { status: 500 });
  }
}
