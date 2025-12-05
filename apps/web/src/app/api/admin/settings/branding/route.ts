import { NextRequest, NextResponse } from 'next/server';

// Debug: Log what env vars are available
console.log('[Branding Route] API_BASE_URL:', process.env.API_BASE_URL);
console.log('[Branding Route] NEXT_PUBLIC_API_BASE_URL:', process.env.NEXT_PUBLIC_API_BASE_URL);

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
console.log('[Branding Route] Using API_BASE_URL:', API_BASE_URL);

export async function GET(req: NextRequest) {
  try {
    // Forward auth headers
    const authHeader = req.headers.get('authorization');
    const cookieHeader = req.headers.get('cookie');
    
    const headers: HeadersInit = {};
    if (authHeader) headers['Authorization'] = authHeader;
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    
    const res = await fetch(`${API_BASE_URL}/platform-settings`, { headers });
    if (!res.ok) {
      // Return default settings for any non-OK response (no error logging)
      return NextResponse.json({
        platformName: 'Visible Shelf',
        logoUrl: null,
        faviconUrl: null,
        primaryColor: '#3b82f6',
        secondaryColor: '#8b5cf6',
      });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    // Only log actual network/parsing errors, not expected 404s
    console.error('Unexpected error fetching branding settings:', error);
    // Return default settings on error
    return NextResponse.json({
      platformName: 'Visible Shelf',
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#3b82f6',
      secondaryColor: '#8b5cf6',
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Forward auth headers
    const authHeader = request.headers.get('authorization');
    const cookieHeader = request.headers.get('cookie');
    
    const headers: HeadersInit = {};
    if (authHeader) headers['Authorization'] = authHeader;
    if (cookieHeader) headers['Cookie'] = cookieHeader;
    
    // Forward the form data to the backend API
    const res = await fetch(`${API_BASE_URL}/platform-settings`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json();
      return NextResponse.json(error, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating branding settings:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
