import { NextResponse } from 'next/server';

export async function GET() {
  // Only for development - remove in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const token = typeof window !== 'undefined' ? 
    (typeof document !== 'undefined' ? 
      document.cookie.split(';').find(c => c.trim().startsWith('access_token='))?.split('=')[1] : 
      null) : null;

  return NextResponse.json({
    token: token || 'No token found',
    cookies: typeof document !== 'undefined' ? document.cookie : 'No cookies available'
  });
}
