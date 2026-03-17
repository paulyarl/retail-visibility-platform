/**
 * Auth0 Route Handler
 * 
 * Handles all Auth0 authentication routes:
 * - GET /auth/login - Redirects to Auth0 login page
 * - GET /auth/logout - Logs out the user
 * - GET /auth/callback - Handles OAuth callback
 * - GET /auth/profile - Returns user profile
 */

import { auth0 } from '../../../../lib/auth0';

export async function GET(request: Request) {
  return auth0.handleRequest(request);
}
