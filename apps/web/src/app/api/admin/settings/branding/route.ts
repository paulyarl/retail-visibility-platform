import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE_URL}/platform-settings`);
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

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    
    // Forward the form data to the backend API
    const res = await fetch(`${API_BASE_URL}/platform-settings`, {
      method: 'POST',
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
