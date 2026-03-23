import { NextRequest, NextResponse } from 'next/server';
import { getAuth0Session, authenticatedFetch } from '@/utils/apiAuth';

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

    // Get optional Auth0 session (public endpoint for directory lookup)
    const auth = await getAuth0Session(request);
    const accessToken = auth?.accessToken || null;
    
    // Check if tenant has a published directory by querying tenant profile
    const profileResponse = await authenticatedFetch(`/api/tenant/profile?tenant_id=${tenantId}`, accessToken, {
      method: 'GET',
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
