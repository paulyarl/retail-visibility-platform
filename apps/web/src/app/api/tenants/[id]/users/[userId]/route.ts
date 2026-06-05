import { NextRequest, NextResponse } from 'next/server';
import { tenantUserService } from '@/services/TenantUserService';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> | { id: string; userId: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    
    const tenantId = resolvedParams.id;
    const userId = resolvedParams.userId;
    const body = await req.json();
    
    if (!tenantId || !userId) {
      return NextResponse.json({ 
        error: 'tenant_and_user_id_required',
        message: 'Tenant ID and User ID are required' 
      }, { status: 400 });
    }

    // Update tenant user role using service with automatic cache invalidation
    const updatedUser = await tenantUserService.updateTenantUserRole(
      tenantId, 
      userId, 
      body.role || body.newRole
    );
    
    if (!updatedUser) {
      return NextResponse.json({ 
        error: 'update_failed',
        message: 'Failed to update user role' 
      }, { status: 400 });
    }
    
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('[Tenant User Management API PUT] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to update user role' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> | { id: string; userId: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    
    const tenantId = resolvedParams.id;
    const userId = resolvedParams.userId;
    
    if (!tenantId || !userId) {
      return NextResponse.json({ 
        error: 'tenant_and_user_id_required',
        message: 'Tenant ID and User ID are required' 
      }, { status: 400 });
    }

    // Remove user from tenant using service with automatic cache invalidation
    await tenantUserService.removeTenantUser(tenantId, userId);
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[Tenant User Management API DELETE] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to remove user from tenant' 
      },
      { status: 500 }
    );
  }
}
