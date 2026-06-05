import { NextResponse } from 'next/server';
import { rbacService } from '@/services/RBACService';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Bulk update permissions using service with automatic cache invalidation
    const result = await rbacService.bulkUpdatePermissions(body.updates || body);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Permissions Bulk Update API] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to bulk update permissions' 
      },
      { status: 500 }
    );
  }
}
