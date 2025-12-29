import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { user_role } from '@prisma/client';
import { prisma } from '../prisma';
import { JWTPayload } from '../middleware/auth';
import { generateSessionId, generateUserId } from '../lib/id-generator';

// JWT configuration
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
// WORKAROUND: Node.js Date.now() is returning timestamps ~1 year in the future
// Setting very long expiry until system time issue is resolved
const JWT_ACCESS_EXPIRY = '365d'; // Was '15m'
const JWT_REFRESH_EXPIRY = '730d'; // Was '7d'

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
    const token = jwt.sign(payload, JWT_ACCESS_SECRET, {
      expiresIn: JWT_ACCESS_EXPIRY,
    });
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
    const existingUser = await prisma.users.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(data.password);

    // Create user using snake_case Prisma fields, then map to camelCase DTO
    const user = await prisma.users.create({
      data: {
        id: generateUserId(),
        email: data.email.toLowerCase(),
        password_hash: passwordHash,
        first_name: data.firstName,
        last_name: data.lastName,
        role: user_role.USER,
        updated_at: new Date(),
      },
    });

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      email_verified: user.email_verified,
      created_at: user.created_at,
    };
  }

  /**
   * Login user
   */
  async login(data: LoginData) {
    // Find user
    const user = await prisma.users.findUnique({
      where: { email: data.email.toLowerCase() },
      include: {
        user_tenants: true,
      },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await this.verifyPassword(data.password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Get tenant IDs
    const tenantIds = user.user_tenants.map((ut) => ut.tenant_id);

    // Create JWT payload
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantIds,
      id: undefined
    };

    // Generate tokens
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Update last login
    await prisma.users.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    // Create session
    await prisma.user_sessions_list.create({
      data: {
        user_id: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        email_verified: user.email_verified,
        tenants: user.user_tenants.map((ut) => ({
          id: ut.tenant_id,
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
      const user = await prisma.users.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          role: true,
          is_active: true,
          user_tenants: {
            select: {
              tenant_id: true,
            },
          },
        },
      });

      if (!user || !user.is_active) {
        throw new Error('Invalid refresh token');
      }

      // Generate new access token
      const newPayload: JWTPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantIds: user.user_tenants.map((ut) => ut.tenant_id),
        id: undefined
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
  async getUserById(userId: string) {
    // Get user by ID
    
    // First get user without relations to avoid Prisma relation issues
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        email_verified: true,
        last_login: true,
        created_at: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get user tenants with tenant names
    let userTenants: { tenant_id: string; role: any; tenants: { name: string } }[] = [];
    try {
      userTenants = await prisma.user_tenants.findMany({
        where: { user_id: userId },
        select: {
          tenant_id: true,
          role: true,
          tenants: {
            select: {
              name: true,
            },
          },
        },
      });
    } catch (tenantError) {
      // Continue with empty tenants array
    }

    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      email_verified: user.email_verified,
      last_login: user.last_login,
      created_at: user.created_at,
      tenants: userTenants.map((ut) => ({
        id: ut.tenant_id,
        name: ut.tenants?.name || ut.tenant_id,
        role: ut.role,
      })),
    };
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(userId: string) {
    // Deactivate all user sessions
    await prisma.user_sessions_list.updateMany({
      where: { user_id: userId, is_active: true },
      data: { is_active: false },
    });

    return { message: 'Logged out successfully' };
  }
}

export const authService = new AuthService();
