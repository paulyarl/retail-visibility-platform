import { NextRequest, NextResponse } from 'next/server';
import AdminOrganizationsService from '@/services/AdminOrganizationsService';

export async function GET(req: NextRequest) {
  try {
    // Extract query parameters for pagination and filtering
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const searchQuery = searchParams.get('search') || undefined;
    const isActive = searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined;
    
    // MIGRATION: Using AdminOrganizationsService instead of direct fetch
    const result = await AdminOrganizationsService.getOrganizations({
      page,
      limit,
      search: searchQuery,
      isActive,
    });
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // MIGRATION: Using AdminOrganizationsService instead of direct fetch
    const organization = await AdminOrganizationsService.createOrganization(body);
    
    if (!organization) {
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 400 });
    }
    
    return NextResponse.json(organization);
    
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
