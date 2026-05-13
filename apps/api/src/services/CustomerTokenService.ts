/**
 * Customer Token Service
 * 
 * Manages customer authentication using JWT tokens instead of cookies.
 * This solves the cross-port localhost cookie issue (localhost:3000 → localhost:4000).
 * 
 * Features:
 * - JWT token generation and validation
 * - Token expiration management
 * - Logout (token invalidation)
 * - Token refresh
 */

import { sign, verify, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

export interface CustomerTokenPayload {
  customerId: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface CustomerAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class CustomerTokenService {
  private static instance: CustomerTokenService;
  
  // Use a fallback secret for development if JWT_SECRET is not set
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry = '24h';    // 24 hours
  private readonly refreshTokenExpiry = '30d';   // 30 days
  
  // In-memory refresh token store (use Redis in production)
  private refreshTokens = new Map<string, { token: string; expires: Date }>();

  private constructor() {
    this.jwtSecret = process.env.JWT_SECRET || process.env.AUTH0_SECRET || 'local-dev-secret-change-in-production';
  }

  static getInstance(): CustomerTokenService {
    if (!CustomerTokenService.instance) {
      CustomerTokenService.instance = new CustomerTokenService();
    }
    return CustomerTokenService.instance;
  }

  /**
   * Generate access and refresh tokens for a customer
   */
  async generateTokens(customerId: string, email: string): Promise<CustomerAuthTokens> {
    const accessToken = sign(
      { customerId, email, type: 'access' },
      this.jwtSecret,
      { expiresIn: this.accessTokenExpiry }
    );

    const refreshToken = sign(
      { customerId, email, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiry }
    );

    // Store refresh token in memory for invalidation support
    this.refreshTokens.set(customerId, {
      token: refreshToken,
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
    };
  }

  /**
   * Verify an access token
   */
  verifyAccessToken(token: string): CustomerTokenPayload | null {
    try {
      const decoded = verify(token, this.jwtSecret) as CustomerTokenPayload;
      
      if (decoded.type !== 'access') {
        console.log('[CustomerToken] Invalid token type:', decoded.type);
        return null;
      }

      return decoded;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log('[CustomerToken] Token verification failed:', message);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<CustomerAuthTokens | null> {
    try {
      const decoded = verify(refreshToken, this.jwtSecret) as CustomerTokenPayload;
      
      if (decoded.type !== 'refresh') {
        console.log('[CustomerToken] Invalid refresh token type');
        return null;
      }

      // Check if refresh token exists in memory (not invalidated)
      const session = this.refreshTokens.get(decoded.customerId);

      if (!session || session.token !== refreshToken) {
        console.log('[CustomerToken] Refresh token not found or invalidated');
        return null;
      }

      if (session.expires < new Date()) {
        console.log('[CustomerToken] Refresh token expired');
        return null;
      }

      // Generate new tokens
      return this.generateTokens(decoded.customerId, decoded.email);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log('[CustomerToken] Refresh token verification failed:', message);
      return null;
    }
  }

  /**
   * Logout customer by invalidating refresh token
   */
  async logout(customerId: string): Promise<void> {
    this.refreshTokens.delete(customerId);
    console.log('[CustomerToken] Customer logged out:', customerId);
  }

  /**
   * Extract bearer token from Authorization header
   */
  static extractBearerToken(req: any): string | null {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}

export default CustomerTokenService;
