import { NextRequest, NextResponse } from 'next/server';
import { organizationService } from '@/services/OrganizationService';

// GET /api/organization-requests - List all requests (Admin only) or user's requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params: {
      status?: string;
      tenantId?: string;
      organizationId?: string;
      page?: number;
      limit?: number;
    } = {};
    
    if (searchParams.has('status')) {
      params.status = searchParams.get('status')!;
    }
    if (searchParams.has('tenantId')) {
      params.tenantId = searchParams.get('tenantId')!;
    }
    if (searchParams.has('organizationId')) {
      params.organizationId = searchParams.get('organizationId')!;
    }
    if (searchParams.has('page')) {
      params.page = parseInt(searchParams.get('page')!);
    }
    if (searchParams.has('limit')) {
      params.limit = parseInt(searchParams.get('limit')!);
    }

    // Get organization requests using service with automatic caching
    const requests = await organizationService.getOrganizationRequests(params);
    
    return NextResponse.json(requests);
  } catch (error) {
    console.error('[Organization Requests API GET] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to fetch organization requests' 
      },
      { status: 500 }
    );
  }
}

// POST /api/organization-requests - Create a new request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Create organization request using service with automatic cache invalidation
    const newRequest = await organizationService.createOrganizationRequest(body);
    
    if (!newRequest) {
      return NextResponse.json({ 
        error: 'creation_failed',
        message: 'Failed to create organization request' 
      }, { status: 400 });
    }
    
    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error('[Organization Requests API POST] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to create organization request' 
      },
      { status: 500 }
    );
  }
}
