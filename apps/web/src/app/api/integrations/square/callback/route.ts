/**
 * Square OAuth Callback Endpoint
 * Handles the OAuth callback from Square and exchanges code for tokens
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      console.error('[Square OAuth] Authorization error:', error);
      return NextResponse.redirect(
        new URL(`/settings/integrations?error=${error}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/settings/integrations?error=missing_parameters', request.url)
      );
    }

    // Verify state (CSRF protection)
    const storedState = request.cookies.get('square_oauth_state')?.value;
    const [stateValue, tenantId] = state.split(':');

    if (!storedState || storedState !== stateValue) {
      console.error('[Square OAuth] State mismatch - possible CSRF attack');
      return NextResponse.redirect(
        new URL('/settings/integrations?error=invalid_state', request.url)
      );
    }

    if (!tenantId) {
      return NextResponse.redirect(
        new URL('/settings/integrations?error=missing_tenant', request.url)
      );
    }

    // Exchange code for tokens via backend API
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const response = await fetch(`${apiBaseUrl}/square/oauth/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward auth token if available
        ...(request.cookies.get('access_token') && {
          'Authorization': `Bearer ${request.cookies.get('access_token')?.value}`
        }),
      },
      body: JSON.stringify({
        code,
        tenantId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Square OAuth] Token exchange failed:', errorData);
      return NextResponse.redirect(
        new URL('/settings/integrations?error=exchange_failed', request.url)
      );
    }

    const data = await response.json();

    // Clear state cookie
    const successResponse = NextResponse.redirect(
      new URL(`/t/${tenantId}/settings/integrations/square?success=true`, request.url)
    );

    successResponse.cookies.delete('square_oauth_state');

    return successResponse;
  } catch (error) {
    console.error('[Square OAuth] Callback error:', error);
    return NextResponse.redirect(
      new URL('/settings/integrations?error=callback_failed', request.url)
    );
  }
}
