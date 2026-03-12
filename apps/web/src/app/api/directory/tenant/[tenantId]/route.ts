import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // For now, return a basic response to avoid circular dependency
    // TODO: Implement proper tenant directory lookup logic
    // This could query the database directly or use a different service
    
    // Check if tenant has a published directory by querying tenant profile
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const profileResponse = await fetch(`${baseUrl}/api/tenant/profile?tenant_id=${tenantId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
      },
    });

    if (!profileResponse.ok) {
      // Return unpublished status for failed profile requests
      return NextResponse.json({
        slug: null,
        published: false,
        message: 'Tenant profile not found'
      });
    }

    const profile = await profileResponse.json();
    
    // Return slug from tenant profile if available
    if (profile.slug) {
      return NextResponse.json({
        slug: profile.slug,
        published: true
      });
    }

    // Return unpublished status for tenants without slug
    return NextResponse.json({
      slug: null,
      published: false,
      message: 'Tenant directory not published'
    });
  } catch (error) {
    console.error('[Directory Tenant API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tenant directory data' },
      { status: 500 }
    );
  }
}
