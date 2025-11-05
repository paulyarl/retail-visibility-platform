import { NextRequest, NextResponse } from 'next/server';

// Use NEXT_PUBLIC_API_BASE_URL for consistency with client-side API calls
const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_URL || 'http://localhost:4000';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  // Get authorization header from client request
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { organizationId } = await params;

  try {
    const response = await fetch(`${API_URL}/organizations/${organizationId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API Proxy] GET /organizations/${organizationId} failed:`, response.status, errorText);
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
    console.error('[API Proxy] Error fetching organization:', error);
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
