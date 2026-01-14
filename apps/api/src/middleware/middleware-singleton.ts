/**
 * Middleware Singleton for Automatic Token Provisioning
 * Provides automatic authentication for specific endpoints that need it
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

class MiddlewareSingleton {
  private static instance: MiddlewareSingleton;
  private autoToken: string | null = null;

  private constructor() {
    this.generateAutoToken();
  }

  static getInstance(): MiddlewareSingleton {
    if (!MiddlewareSingleton.instance) {
      MiddlewareSingleton.instance = new MiddlewareSingleton();
    }
    return MiddlewareSingleton.instance;
  }

  private async generateAutoToken() {
    try {
      // Create a system user token for automatic access
      const systemUser = await prisma.users.findFirst({
        where: { email: 'system@visibleshelf.com' }
      });

      if (!systemUser) {
        console.warn('[Middleware] System user not found, creating...');
        // Create system user if it doesn't exist
        const newSystemUser = await prisma.users.create({
          data: {
            email: 'system@visibleshelf.com',
            password_hash: 'system',
            role: 'PLATFORM_ADMIN',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        });

        this.autoToken = jwt.sign(
          { 
            userId: newSystemUser.id,
            email: newSystemUser.email,
            role: newSystemUser.role
          },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '24h' }
        );
      } else {
        this.autoToken = jwt.sign(
          { 
            userId: systemUser.id,
            email: systemUser.email,
            role: systemUser.role
          },
          process.env.JWT_SECRET || 'fallback-secret',
          { expiresIn: '24h' }
        );
      }

      console.log('[Middleware] Auto token generated successfully');
    } catch (error) {
      console.error('[Middleware] Failed to generate auto token:', error);
    }
  }

  /**
   * Middleware to automatically provide token for payment gateways endpoint
   */
  autoTokenMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Only apply to payment gateways endpoints
    if (req.path.includes('/payment-gateways') && !req.headers.authorization) {
      if (this.autoToken) {
        req.headers.authorization = `Bearer ${this.autoToken}`;
        console.log('[Middleware] Auto token applied for payment gateways endpoint');
      } else {
        console.warn('[Middleware] No auto token available');
      }
    }
    next();
  };

  /**
   * Get the current auto token (for testing/debugging)
   */
  getAutoToken(): string | null {
    return this.autoToken;
  }
}

export const middlewareSingleton = MiddlewareSingleton.getInstance();
