import { NextRequest, NextResponse } from 'next/server';
import { adminUsersService } from '@/services/AdminUsersService';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await context.params;
    
    // MIGRATION: Using AdminUsersService instead of direct fetch
    const userTenants = await adminUsersService.getUserTenants(userId);
    
    if (!userTenants) {
      return NextResponse.json({ error: 'User not found or failed to fetch tenants' }, { status: 404 });
    }
    
    return NextResponse.json({ tenants: userTenants });
    
  } catch (error) {
    console.error('Error fetching user tenants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user tenants' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await context.params;
    const body = await req.json();
    
    // MIGRATION: Using AdminUsersService instead of direct fetch
    const result = await adminUsersService.addUserTenant(userId, body);
    
    if (!result) {
      return NextResponse.json({ error: 'Failed to add tenant to user' }, { status: 400 });
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error adding user tenant:', error);
    return NextResponse.json(
      { error: 'Failed to add tenant to user' },
      { status: 500 }
    );
  }
}
