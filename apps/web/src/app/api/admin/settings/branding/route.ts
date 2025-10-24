import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE_URL}/platform-settings`);
    if (!res.ok) {
      throw new Error('Failed to fetch platform settings');
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching branding settings:', error);
    return new NextResponse('Internal server error', { status: 500 });
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
