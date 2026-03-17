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

export const auth0 = new Auth0Client({
  // Explicit configuration (falls back to AUTH0_* env vars if not provided)
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
  // APP_BASE_URL is inferred from request host for preview deployments
  
  // Custom callback hook to sync user to database after successful login
  onCallback: async (error, ctx, session) => {
    console.log('[Auth0] onCallback triggered', { error: !!error, hasSession: !!session, hasUser: !!session?.user });
    console.log('[Auth0] Session keys:', session ? Object.keys(session) : 'null');
    console.log('[Auth0] Session.user keys:', session?.user ? Object.keys(session.user) : 'null');
    
    if (error) {
      console.error('[Auth0] Callback error:', error);
      // Redirect to home with error
      return NextResponse.redirect(new URL('/?auth_error=true', ctx.appBaseUrl || '/'));
    }

    // Sync user to database if session exists
    if (session?.user) {
      console.log('[Auth0] Session user:', { sub: session.user.sub, email: session.user.email });
      
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
          if (user && !user.onboarding_completed) {
            // New user - redirect to onboarding wizard
            console.log('[Auth0] New user detected, redirecting to onboarding');
            return NextResponse.redirect(new URL('/onboarding', ctx.appBaseUrl || '/'));
          }
        } else {
          // Log sync failure but don't block login
          console.warn('[Auth0] User sync failed, but continuing with login');
        }
      } catch (syncError) {
        // Log but don't fail - user can still use the app
        console.error('[Auth0] Failed to sync user to database:', syncError);
      }
    }

    // Redirect to the return URL or home
    const returnTo = ctx.returnTo || '/';
    return NextResponse.redirect(new URL(returnTo, ctx.appBaseUrl || '/'));
  },
});
