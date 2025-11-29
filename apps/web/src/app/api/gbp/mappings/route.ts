import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryIds = searchParams.get('categoryIds');

    if (!categoryIds) {
      return NextResponse.json(
        { error: 'Missing required parameter: categoryIds' },
        { status: 400 }
      );
    }

    // Forward to backend API
    const backendUrl = `${API_URL}/api/gbp/mappings?categoryIds=${encodeURIComponent(categoryIds)}`;
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[GBP Mappings Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category mappings' },
      { status: 500 }
    );
  }
}
