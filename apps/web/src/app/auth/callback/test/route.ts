import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('[Auth Callback Test] Route is accessible');
  
  return NextResponse.json({
    message: 'Auth callback route is working',
    timestamp: new Date().toISOString(),
    url: request.url,
  });
}
