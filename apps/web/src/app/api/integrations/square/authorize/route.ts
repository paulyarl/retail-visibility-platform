/**
 * Square OAuth Authorization Endpoint
 * Initiates the OAuth flow by redirecting to Square
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId parameter' },
        { status: 400 }
      );
    }

    // Generate secure random state for CSRF protection
    const state = generateState();
    const stateWithTenant = `${state}:${tenantId}`;

    // Store state in session/cookie for validation in callback
    const response = NextResponse.redirect(
      buildAuthorizationUrl(stateWithTenant)
    );

    // Set secure cookie with state
    response.cookies.set('square_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[Square OAuth] Authorization error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate authorization' },
      { status: 500 }
    );
  }
}

function generateState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildAuthorizationUrl(state: string): string {
  const environment = process.env.SQUARE_ENVIRONMENT || 'sandbox';
  const baseUrl = environment === 'production'
    ? 'https://connect.squareup.com/oauth2/authorize'
    : 'https://connect.squareupsandbox.com/oauth2/authorize';

  const params = new URLSearchParams({
    client_id: process.env.SQUARE_APPLICATION_ID!,
    scope: [
      'ITEMS_READ',
      'ITEMS_WRITE',
      'INVENTORY_READ',
      'INVENTORY_WRITE',
      'MERCHANT_PROFILE_READ',
    ].join(' '),
    session: 'false',
    state,
    redirect_uri: process.env.SQUARE_OAUTH_REDIRECT_URI!,
  });

  return `${baseUrl}?${params.toString()}`;
}
