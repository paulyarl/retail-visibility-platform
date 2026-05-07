import { NextRequest, NextResponse } from 'next/server';
import { organizationService } from '@/services/OrganizationService';

// GET /api/organization-requests/[id] - Get a specific request
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get organization request using service with automatic caching
    const orgRequest = await organizationService.getOrganizationRequest(id);
    
    if (!orgRequest) {
      return NextResponse.json({ 
        error: 'request_not_found',
        message: 'Organization request not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json(orgRequest);
  } catch (error) {
    console.error('[Organization Request API GET] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to fetch organization request' 
      },
      { status: 500 }
    );
  }
}

// PATCH /api/organization-requests/[id] - Update request (approve/reject/agree to cost)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Update organization request using service with automatic cache invalidation
    const updatedRequest = await organizationService.updatePendingRequest(id, body);
    
    if (!updatedRequest) {
      return NextResponse.json({ 
        error: 'update_failed',
        message: 'Failed to update organization request' 
      }, { status: 400 });
    }
    
    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error('[Organization Request API PATCH] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to update organization request' 
      },
      { status: 500 }
    );
  }
}

// DELETE /api/organization-requests/[id] - Cancel/delete a request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Delete organization request using service with automatic cache invalidation
    await organizationService.deletePendingRequest(id);
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[Organization Request API DELETE] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to delete organization request' 
      },
      { status: 500 }
    );
  }
}
