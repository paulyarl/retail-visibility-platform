import { NextRequest, NextResponse } from 'next/server';
import { tenantInfoService } from '@/services/TenantInfoService';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json({ 
        error: 'tenant_id_required',
        message: 'Tenant ID is required' 
      }, { status: 400 });
    }

    // Get tenant info using service with automatic caching
    const tenantInfo = await tenantInfoService.getTenantInfo(id);
    
    if (!tenantInfo) {
      return NextResponse.json({ 
        error: 'tenant_not_found',
        message: 'Tenant not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json(tenantInfo);
  } catch (error) {
    console.error('[Tenant API GET] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to fetch tenant information' 
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    
    if (!id) {
      return NextResponse.json({ 
        error: 'tenant_id_required',
        message: 'Tenant ID is required' 
      }, { status: 400 });
    }

    // Update tenant using service with automatic cache invalidation
    // Use appropriate update method based on data provided
    let updatedTenant;
    
    if (body.subdomain !== undefined) {
      updatedTenant = await tenantInfoService.updateTenantSubdomain(id, body.subdomain);
    } else if (body.status !== undefined) {
      updatedTenant = await tenantInfoService.updateTenantStatus(id, body.status);
    } else {
      // For general tenant updates, use getCompleteTenantInfo and update specific fields
      // This is a fallback for now - could be enhanced with a general update method
      return NextResponse.json({ 
        error: 'unsupported_update',
        message: 'Please specify subdomain or status for updates' 
      }, { status: 400 });
    }
    
    if (!updatedTenant) {
      return NextResponse.json({ 
        error: 'update_failed',
        message: 'Failed to update tenant' 
      }, { status: 400 });
    }
    
    return NextResponse.json(updatedTenant);
  } catch (error) {
    console.error('[Tenant API PUT] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to update tenant' 
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    
    if (!id) {
      return NextResponse.json({ 
        error: 'tenant_id_required',
        message: 'Tenant ID is required' 
      }, { status: 400 });
    }

    console.log('[PATCH /api/tenants/:id] Updating tenant:', id, body);
    
    // Update tenant using service with automatic cache invalidation
    // Use appropriate update method based on data provided
    let updatedTenant;
    
    if (body.subdomain !== undefined) {
      updatedTenant = await tenantInfoService.updateTenantSubdomain(id, body.subdomain);
    } else if (body.status !== undefined) {
      updatedTenant = await tenantInfoService.updateTenantStatus(id, body.status);
    } else {
      // For partial updates, we could enhance this later
      return NextResponse.json({ 
        error: 'unsupported_update',
        message: 'Please specify subdomain or status for updates' 
      }, { status: 400 });
    }
    
    if (!updatedTenant) {
      return NextResponse.json({ 
        error: 'update_failed',
        message: 'Failed to update tenant' 
      }, { status: 400 });
    }
    
    console.log('[PATCH /api/tenants/:id] Update successful');
    return NextResponse.json(updatedTenant);
  } catch (error) {
    console.error('[PATCH /api/tenants/:id] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to update tenant',
        details: String(error)
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    
    if (!id) {
      return NextResponse.json({ 
        error: 'tenant_id_required',
        message: 'Tenant ID is required' 
      }, { status: 400 });
    }

    // Tenant deletion is a sensitive operation
    // This would need to be implemented in TenantInfoService
    // For now, we'll return an error as this operation should not be exposed via API
    return NextResponse.json({ 
      error: 'operation_not_supported',
      message: 'Tenant deletion is not supported via this API' 
    }, { status: 405 });
  } catch (error) {
    console.error('[Tenant API DELETE] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to process request' 
      },
      { status: 500 }
    );
  }
}
