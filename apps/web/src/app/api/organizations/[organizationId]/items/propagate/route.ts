import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export async function POST(
  req: NextRequest,
  { params }: { params: { organizationId: string } }
) {
  // Get authorization header from client request
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { organizationId } = params;
  const body = await req.json();

  try {
    const response = await fetch(`${API_URL}/organizations/${organizationId}/items/propagate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
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
