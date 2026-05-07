import { NextRequest, NextResponse } from 'next/server';
import { userManagementService } from '@/services/UserManagementService';

/**
 * User Profile API - Get current user's comprehensive profile
 * Uses UserManagementService for cached user operations
 */
export async function GET(request: NextRequest) {
  try {
    // Get user profile using service with automatic caching
    const userProfile = await userManagementService.getUser();
    
    if (!userProfile) {
      return NextResponse.json({ 
        error: 'profile_not_found',
        message: 'User profile not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json(userProfile);
  } catch (error) {
    console.error('[User Profile API] Error:', error);
    return NextResponse.json(
      { 
        error: 'internal_server_error',
        message: 'Failed to fetch user profile' 
      },
      { status: 500 }
    );
  }
}
