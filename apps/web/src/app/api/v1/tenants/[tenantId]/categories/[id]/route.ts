import { tenantCategoryService } from '@/services/TenantCategoryService';
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  try {
    const { tenantId, id } = await params;
    
    // Get tenant category using the singleton service
    const data = await tenantCategoryService.getTenantCategory(tenantId, id);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error fetching category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  try {
    const { tenantId, id } = await params;
    const body = await request.json();
    
    // Update tenant category using the singleton service
    const data = await tenantCategoryService.updateTenantCategory(tenantId, id, body);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error updating category:', error);
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  try {
    const { tenantId, id } = await params;
    
    // Delete tenant category using the singleton service
    const data = await tenantCategoryService.deleteTenantCategory(tenantId, id);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Proxy] Error deleting category:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  try {
    const { tenantId, id } = await params;
    const body = await request.json();
    
    // Create tenant category using the singleton service
    const data = await tenantCategoryService.createTenantCategory(tenantId, body);
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[API Proxy] Error creating category:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
