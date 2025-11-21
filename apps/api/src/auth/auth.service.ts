import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { user_role } from '@prisma/client';
import { prisma } from '../prisma';

// JWT configuration
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
// WORKAROUND: Node.js Date.now() is returning timestamps ~1 year in the future
// Setting very long expiry until system time issue is resolved
const JWT_ACCESS_EXPIRY = '365d'; // Was '15m'
const JWT_REFRESH_EXPIRY = '730d'; // Was '7d'

export interface JWTPayload {
  user_id: string;
  userId?: string; // Added by universal transform middleware
  email: string;
  role: user_role;
  tenantIds: string[];
}

export interface RegisterData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(payload: JWTPayload): string {
    const now = Math.floor(Date.now() / 1000);
    console.log('[AuthService] Generating access token at:', new Date().toISOString(), 'timestamp:', now);
    const token = jwt.sign(payload, JWT_ACCESS_SECRET, {
      expiresIn: JWT_ACCESS_EXPIRY,
    });
    console.log('[AuthService] Token generated, decoding to verify timestamp...');
    const decoded = jwt.decode(token) as any;
    console.log('[AuthService] Token iat:', decoded.iat, 'exp:', decoded.exp);
    return token;
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRY,
    });
  }

  /**
   * Verify JWT access token
   */
  verifyAccessToken(token: string): JWTPayload {
    return jwt.verify(token, JWT_ACCESS_SECRET) as JWTPayload;
  }

  /**
   * Verify JWT refresh token
   */
  verifyRefreshToken(token: string): JWTPayload {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(data.password);

    // Create user using snake_case Prisma fields, then map to camelCase DTO
    const user = await prisma.user.create({
      data: {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        email: data.email.toLowerCase(),
        passwordHash: passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: user_role.USER,
        updatedAt: new Date(),
      },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  /**
   * Login user
   */
  async login(data: LoginData) {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      include: {
        userTenants: true,
      },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(data.password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Get tenant IDs
    const tenantIds = user.userTenants.map((ut) => ut.tenantId);

    // Create JWT payload
    const payload: JWTPayload = {
      user_id: user.id,
      email: user.email,
      role: user.role,
      tenantIds,
    };

    // Generate tokens
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Create session
    await prisma.userSession.create({
      data: {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        emailVerified: user.emailVerified,
        tenants: user.userTenants.map((ut) => ({
          id: ut.tenantId,
          name: 'Unknown',
          role: ut.role,
        })),
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      const payload = this.verifyRefreshToken(refreshToken);

      // Verify user still exists and is active
      const user = await prisma.user.findUnique({
        where: { id: payload.user_id },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          userTenants: {
            select: {
              tenantId: true,
            },
          },
        },
      });

      if (!user || !user.isActive) {
        throw new Error('Invalid refresh token');
      }

      // Generate new access token
      const newPayload: JWTPayload = {
        user_id: user.id,
        email: user.email,
        role: user.role,
        tenantIds: user.userTenants.map((ut) => ut.tenantId),
      };

      const accessToken = this.generateAccessToken(newPayload);

      return { accessToken };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(user_id: string) {
    console.log('[AuthService] getUserById called with:', user_id);
    console.log('[AuthService] prisma.users exists:', !!prisma.user);
    console.log('[AuthService] prisma.user exists:', !!prisma.user);
    
    // First get user without relations to avoid Prisma relation issues
    const user = await prisma.user.findUnique({
      where: { id: user_id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        lastLogin: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.log('[AuthService] Throwing "User not found" error');
      throw new Error('User not found');
    }

    // Get user tenants separately to avoid relation issues
    let userTenants: { tenantId: string; role: any }[] = [];
    try {
      userTenants = await prisma.userTenant.findMany({
        where: { userId: user_id },
        select: {
          tenantId: true,
          role: true,
        },
      });
      console.log('[AuthService] Found', userTenants.length, 'tenant associations');
    } catch (tenantError) {
      console.log('[AuthService] Could not fetch tenant associations:', tenantError.message);
      // Continue with empty tenants array
    }

    console.log('[AuthService] Database query result:', user ? 'USER FOUND' : 'USER NOT FOUND');
    if (user) {
      console.log('[AuthService] User details:', { id: user.id, email: user.email, role: user.role });
    }

    if (!user) {
      console.log('[AuthService] Throwing "User not found" error');
      throw new Error('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      emailVerified: user.emailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      tenants: userTenants.map((ut: { tenantId: string; role: any }) => ({
        id: ut.tenantId,
        role: ut.role,
      })),
    };
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(user_id: string) {
    // Deactivate all user sessions
    await prisma.userSession.updateMany({
      where: { userId: user_id, isActive: true },
      data: { isActive: false },
    });

    return { message: 'Logged out successfully' };
  }
}

export const authService = new AuthService();
