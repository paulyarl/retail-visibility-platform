import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export async function GET(req: NextRequest) {
  try {
    // Forward auth headers
    const authHeader = req.headers.get('authorization');
    const cookieHeader = req.headers.get('cookie');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authHeader) headers['Authorization'] = authHeader;
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    
    const response = await fetch(`${API_BASE_URL}/admin/email-config`, {
      method: 'GET',
      headers,
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

    // Forward auth headers
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (authHeader) headers['Authorization'] = authHeader;
    if (cookieHeader) headers['Cookie'] = cookieHeader;

    const response = await fetch(`${API_BASE_URL}/admin/email-config`, {
      method: 'PUT',
      headers,
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
