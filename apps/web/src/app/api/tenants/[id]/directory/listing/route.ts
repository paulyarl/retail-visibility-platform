import { NextRequest, NextResponse } from 'next/server';
import { tenantDirectoryService } from '@/services/TenantDirectorySingletonService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Use TenantDirectorySingletonService for automatic caching and error handling
    const listing = await tenantDirectoryService.getDirectoryListing(id);
    
    if (!listing) {
      return NextResponse.json(
        { error: 'Directory listing not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error('[Directory Listing API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch directory listing' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    
    // Use TenantDirectorySingletonService for automatic caching and error handling
    const listing = await tenantDirectoryService.createDirectoryListing(id, body);
    
    if (!listing) {
      return NextResponse.json(
        { error: 'Failed to create directory listing' },
        { status: 500 }
      );
    }

    return NextResponse.json(listing, { status: 201 });
  } catch (error) {
    console.error('[Directory Listing API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create directory listing' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    
    // Use TenantDirectorySingletonService for automatic caching and error handling
    const listing = await tenantDirectoryService.updateDirectoryListing(id, body);
    
    if (!listing) {
      return NextResponse.json(
        { error: 'Failed to update directory listing' },
        { status: 500 }
      );
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error('[Directory Listing API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update directory listing' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    
    // Use TenantDirectorySingletonService for automatic caching and error handling
    const listing = await tenantDirectoryService.patchDirectoryListing(id, body);
    
    if (!listing) {
      return NextResponse.json(
        { error: 'Failed to patch directory listing' },
        { status: 500 }
      );
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error('[Directory Listing API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to patch directory listing' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  try {
    // Use TenantDirectorySingletonService for automatic caching and error handling
    const success = await tenantDirectoryService.deleteDirectoryListing(id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete directory listing' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Directory Listing API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete directory listing' },
      { status: 500 }
    );
  }
}
