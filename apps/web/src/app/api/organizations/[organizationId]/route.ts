import { NextRequest, NextResponse } from 'next/server';
import { getAuth0Session, authenticatedFetch } from '@/utils/apiAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await params;

  try {
    // Get optional Auth0 session
    const auth = await getAuth0Session(req);
    const accessToken = auth?.accessToken || null;
    
    const response = await authenticatedFetch(`/api/organizations/${organizationId}`, accessToken, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json(errorData, { status: response.status });
      } catch {
        return NextResponse.json({ message: errorText || 'Failed to fetch organization' }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Organizations API] Error:', error.message);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
