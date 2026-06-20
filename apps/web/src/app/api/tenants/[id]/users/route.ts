import { NextRequest, NextResponse } from 'next/server';
import { tenantUserService } from '@/services/TenantUserService';

export async function GET(
  req: Request,
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

    // Get tenant users using service with automatic caching
    const users = await tenantUserService.getTenantUsers(tenantId);
    
    if (!users) {
      return NextResponse.json([]);
    }
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('[Tenant Users API GET] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to fetch tenant users' 
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tenantId } = await params;
    const body = await req.json();
    
    if (!tenantId) {
      return NextResponse.json({ 
        error: 'tenant_id_required',
        message: 'Tenant ID is required' 
      }, { status: 400 });
    }

    // Add user to tenant using service with automatic cache invalidation
    const newUser = await tenantUserService.addTenantUser(tenantId, body);
    
    if (!newUser) {
      return NextResponse.json({ 
        error: 'add_user_failed',
        message: 'Failed to add user to tenant' 
      }, { status: 400 });
    }
    
    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('[Tenant Users API POST] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to add user to tenant' 
      },
      { status: 500 }
    );
  }
}
