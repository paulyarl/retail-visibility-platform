import { NextResponse } from 'next/server';
import { adminUsersService } from '@/services/AdminUsersService';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    
    // Get all users and find the specific one (service doesn't have individual get method)
    const users = await adminUsersService.getUsers();
    const user = users.find(u => u.id === resolvedParams.id);
    
    if (!user) {
      return NextResponse.json({ 
        error: 'user_not_found',
        message: 'User not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json(user);
  } catch (error) {
    console.error('[Users API GET] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to fetch user' 
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    const body = await req.json();
    
    // Update user using service with automatic cache invalidation
    const updatedUser = await adminUsersService.updateUser(resolvedParams.id, body);
    
    if (!updatedUser) {
      return NextResponse.json({ 
        error: 'update_failed',
        message: 'Failed to update user' 
      }, { status: 400 });
    }
    
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('[Users API PUT] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to update user' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = params && typeof params === 'object' && 'then' in params 
      ? await params 
      : params;
    
    // Delete user using service with automatic cache invalidation
    const success = await adminUsersService.deleteUser(resolvedParams.id);
    
    if (!success) {
      return NextResponse.json({ 
        error: 'delete_failed',
        message: 'Failed to delete user' 
      }, { status: 400 });
    }
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[Users API DELETE] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to delete user' 
      },
      { status: 500 }
    );
  }
}
