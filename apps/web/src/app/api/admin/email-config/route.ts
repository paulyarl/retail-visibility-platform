import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(req: NextRequest) {
  try {
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(req);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const response = await authenticatedFetch('/admin/email-config', accessToken, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch email configuration');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching email config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Require platform admin authentication via Auth0 session
    const authResult = await requirePlatformAdmin(request);
    
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }
    
    const { accessToken } = authResult;

    const response = await authenticatedFetch('/admin/email-config', accessToken, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to update email configuration');
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating email config:', error);
    return NextResponse.json(
      { error: 'Failed to update email configuration' },
      { status: 500 }
    );
  }
}
