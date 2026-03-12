import { NextResponse } from 'next/server';
import { adminUsersService } from '@/services/AdminUsersService';

export async function GET(req: Request) {
  try {
    // Get users using service with automatic caching
    const users = await adminUsersService.getUsers();
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('[Users API] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to fetch users' 
      },
      { status: 500 }
    );
  }
}
