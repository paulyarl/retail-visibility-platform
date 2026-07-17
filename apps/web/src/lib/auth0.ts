/**
 * Auth0 Next.js SDK Configuration
 * 
 * Official Auth0 integration for Next.js applications
 * Handles server-side session management and OAuth flow
 * Syncs users to local database on successful login
 */

import { Auth0Client } from '@auth0/nextjs-auth0/server';
import { NextResponse } from 'next/server';
import AuthSyncService from '../services/AuthSyncService';
import { clientLogger } from '@/lib/client-logger';

// Cookie names for storing user info for API authentication
const EMAIL_COOKIE_NAME = 'auth0_email';
const AUTH0_ID_COOKIE_NAME = 'auth0_id';

export const auth0 = new Auth0Client({
  // Explicit configuration (falls back to AUTH0_* env vars if not provided)
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  // APP_BASE_URL is inferred from request host for preview deployments
  
  // Custom callback hook to sync user to database after successful login
  onCallback: async (error, ctx, session): Promise<any> => {
    console.log('[Auth0] onCallback triggered', { error: !!error, hasSession: !!session, hasUser: !!session?.user });
    console.log('[Auth0] Session keys:', session ? Object.keys(session) : 'null');
    console.log('[Auth0] Session.user keys:', session?.user ? Object.keys(session.user) : 'null');
    
    if (error) {
      clientLogger.error('[Auth0] Callback error:', { detail: error });
      // Redirect to home with error
      return NextResponse.redirect(new URL('/?auth_error=true', ctx.appBaseUrl || '/'));
    }

    // Sync user to database if session exists
    if (session?.user) {
      console.log('[Auth0] Session user:', { sub: session.user.sub, email: session.user.email });
      
      // Store email and auth0_id in cookies for API authentication
      const email = session.user.email || '';
      const auth0Id = session.user.sub || '';
      
      try {
        console.log('[Auth0] About to call syncUser...');
        const syncService = AuthSyncService.getInstance();
        console.log('[Auth0] Calling syncUser...');
        
        const syncResult = await syncService.syncUser({
          sub: session.user.sub || '',
          email: session.user.email || '',
          email_verified: session.user.email_verified,
          given_name: session.user.given_name,
          family_name: session.user.family_name,
          name: session.user.name,
          picture: session.user.picture,
          nickname: session.user.nickname,
        });

        console.log('[Auth0] Sync result:', { success: syncResult.success, userId: syncResult.user?.id });

        if (syncResult.success) {
          console.log('[Auth0] User synced to database:', syncResult.user?.id);
          
          // Check if user needs onboarding
          const user = syncResult.user;
          const hasTenants = user?.tenants && user.tenants.length > 0;
          
          if (!user?.onboarding_completed || !hasTenants) {
            // New user or user without tenants - redirect to onboarding wizard
            console.log('[Auth0] User needs onboarding, redirecting to /onboarding');
            const response = NextResponse.redirect(new URL('/onboarding', ctx.appBaseUrl || '/'));
            response.cookies.set(EMAIL_COOKIE_NAME, email, { httpOnly: false, path: '/', maxAge: 60 * 60 * 24 });
            response.cookies.set(AUTH0_ID_COOKIE_NAME, auth0Id, { httpOnly: false, path: '/', maxAge: 60 * 60 * 24 });
            return response;
          }
          
          // User has tenants and completed onboarding - redirect to dashboard
          const firstTenantId = user.tenants[0]?.id;
          const redirectPath = firstTenantId ? `/t/${firstTenantId}/dashboard` : '/dashboard';
          console.log('[Auth0] User has tenants, redirecting to:', redirectPath);
          const response = NextResponse.redirect(new URL(redirectPath, ctx.appBaseUrl || '/'));
          response.cookies.set(EMAIL_COOKIE_NAME, email, { httpOnly: false, path: '/', maxAge: 60 * 60 * 24 });
          response.cookies.set(AUTH0_ID_COOKIE_NAME, auth0Id, { httpOnly: false, path: '/', maxAge: 60 * 60 * 24 });
          return response;
        } else {
          // Log sync failure but don't block login
          clientLogger.warn('[Auth0] User sync failed, but continuing with login');
        }
      } catch (syncError) {
        // Log but don't fail - user can still use the app
        clientLogger.error('[Auth0] Failed to sync user to database:', { detail: syncError });
      }
    }

    // Redirect to the return URL or home
    const returnTo = ctx.returnTo || '/';
    const response = NextResponse.redirect(new URL(returnTo, ctx.appBaseUrl || '/'));
    if (session?.user?.email) {
      response.cookies.set(EMAIL_COOKIE_NAME, session.user.email, { httpOnly: false, path: '/', maxAge: 60 * 60 * 24 });
    }
    if (session?.user?.sub) {
      response.cookies.set(AUTH0_ID_COOKIE_NAME, session.user.sub, { httpOnly: false, path: '/', maxAge: 60 * 60 * 24 });
    }
    return response;
  },
});
