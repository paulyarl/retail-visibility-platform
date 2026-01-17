import { NextRequest, NextResponse } from 'next/server';

// Function to get current settings (reads from environment each time)
export function getPlatformSettings() {
  return {
    rateLimitingEnabled: process.env.RATE_LIMITING_ENABLED !== 'false',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookies (following pattern from other admin routes)
    const token = request.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // In a real implementation, we'd validate the token and check user role
    // For now, just return the settings (token presence implies auth)
    return NextResponse.json(getPlatformSettings());
  } catch (error) {
    console.error('Error fetching platform settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get auth token from cookies (following pattern from other admin routes)
    const token = request.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rateLimitingEnabled } = body;

    // Validate input
    if (typeof rateLimitingEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'rateLimitingEnabled must be a boolean' },
        { status: 400 }
      );
    }

    // Update environment variable for middleware
    process.env.RATE_LIMITING_ENABLED = rateLimitingEnabled.toString();

    // Log the change
    console.log('Platform settings updated:', {
      rateLimitingEnabled,
      updatedBy: 'admin',
      timestamp: new Date().toISOString()
    });

    // Return updated settings
    return NextResponse.json(getPlatformSettings());
  } catch (error) {
    console.error('Error updating platform settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
