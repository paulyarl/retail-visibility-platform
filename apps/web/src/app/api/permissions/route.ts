import { NextResponse } from 'next/server';
import { rbacService } from '@/services/RBACService';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params: {
    resource?: string;
    action?: string;
    isActive?: boolean;
  } = {};
  
  if (url.searchParams.has('resource')) {
    params.resource = url.searchParams.get('resource')!;
  }
  if (url.searchParams.has('action')) {
    params.action = url.searchParams.get('action')!;
  }
  if (url.searchParams.has('isActive')) {
    params.isActive = url.searchParams.get('isActive') === 'true';
  }
  
  try {
    // Get permissions using service with automatic caching
    const permissions = await rbacService.getPermissions(params);
    
    return NextResponse.json(permissions);
  } catch (error) {
    console.error('[Permissions API GET] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to fetch permissions' 
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/api/permissions', '');
  
  try {
    const body = await req.json();
    
    // Create permission using service with automatic cache invalidation
    const newPermission = await rbacService.createPermission(body);
    
    if (!newPermission) {
      return NextResponse.json({ 
        error: 'creation_failed',
        message: 'Failed to create permission' 
      }, { status: 400 });
    }
    
    return NextResponse.json(newPermission, { status: 201 });
  } catch (error) {
    console.error('[Permissions API POST] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to create permission' 
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/');
  const permissionId = pathParts[pathParts.length - 1];
  
  try {
    const body = await req.json();
    
    // Update permission using service with automatic cache invalidation
    const updatedPermission = await rbacService.updatePermission(permissionId, body);
    
    if (!updatedPermission) {
      return NextResponse.json({ 
        error: 'update_failed',
        message: 'Failed to update permission' 
      }, { status: 400 });
    }
    
    return NextResponse.json(updatedPermission);
  } catch (error) {
    console.error('[Permissions API PUT] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to update permission' 
      },
      { status: 500 }
    );
  }
}
