/**
 * Auth Guards and Role-Based Access Control
 * 
 * Utilities for protecting routes based on user roles
 */

import { auth0 } from '../src/lib/auth0';
import { NextResponse } from 'next/server';
import { AuthSyncService } from '../src/services/AuthSyncService';

export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN' | 'PLATFORM_ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  email_verified: boolean;
  is_active: boolean;
}

/**
 * Get the database user for the current Auth0 session
 * Returns null if not found or not authenticated
 */
export async function getDatabaseUser(): Promise<AuthUser | null> {
  try {
    const session = await auth0.getSession();
    
    if (!session?.user?.email) {
      return null;
    }

    const syncService = AuthSyncService.getInstance();
    const dbUser = await syncService.getUserByIdentifier(session.user.email);
    
    if (!dbUser) {
      return null;
    }

    return {
      id: dbUser.id,
      email: dbUser.email,
      first_name: dbUser.first_name,
      last_name: dbUser.last_name,
      role: dbUser.role as UserRole,
      email_verified: dbUser.email_verified,
      is_active: dbUser.is_active,
    };
  } catch (error) {
    console.error('[AuthGuards] Error getting database user:', error);
    return null;
  }
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    'USER': 1,
    'ADMIN': 2,
    'SUPER_ADMIN': 3,
    'PLATFORM_ADMIN': 4,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

/**
 * Check if user is a platform admin
 */
export function isPlatformAdmin(user: AuthUser | null): boolean {
  return user?.role === 'PLATFORM_ADMIN';
}

/**
 * Check if user is an admin or higher
 */
export function isAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  return hasRole(user.role, 'ADMIN');
}

/**
 * Protect a page with role-based access
 * Returns the user if authorized, or a redirect response if not
 */
export async function requireRole(requiredRole: UserRole): Promise<{ user: AuthUser } | NextResponse> {
  const session = await auth0.getSession();
  
  if (!session) {
    // Not authenticated - redirect to login
    return NextResponse.redirect(new URL('/auth/login', process.env.APP_BASE_URL || 'http://localhost:3000'));
  }

  const dbUser = await getDatabaseUser();
  
  if (!dbUser) {
    // User not in database - redirect to home
    return NextResponse.redirect(new URL('/?error=user_not_found', process.env.APP_BASE_URL || 'http://localhost:3000'));
  }

  if (!dbUser.is_active) {
    // User is deactivated
    return NextResponse.redirect(new URL('/?error=account_deactivated', process.env.APP_BASE_URL || 'http://localhost:3000'));
  }

  if (!hasRole(dbUser.role, requiredRole)) {
    // User doesn't have required role
    return NextResponse.redirect(new URL('/?error=unauthorized', process.env.APP_BASE_URL || 'http://localhost:3000'));
  }

  return { user: dbUser };
}

/**
 * Protect a page requiring platform admin
 */
export async function requirePlatformAdmin(): Promise<{ user: AuthUser } | NextResponse> {
  return requireRole('PLATFORM_ADMIN');
}

/**
 * Protect a page requiring any admin role
 */
export async function requireAdmin(): Promise<{ user: AuthUser } | NextResponse> {
  return requireRole('ADMIN');
}
