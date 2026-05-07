import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, authenticatedFetch } from '@/utils/apiAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  // Require authentication via Auth0 session
  const authResult = await requireAuth(req);
  
  if (authResult instanceof NextResponse) {
    return authResult; // Return error response
  }
  
  const { accessToken } = authResult;

  const { organizationId } = await params;
  const body = await req.json();

  try {
    const response = await authenticatedFetch(`/organizations/${organizationId}/items/propagate`, accessToken, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error propagating item:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
