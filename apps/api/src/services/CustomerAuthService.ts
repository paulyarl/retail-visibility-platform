/**
 * Customer Authentication Service
 * 
 * Handles customer account authentication:
 * - Email/password registration and login
 * - OAuth integration (Google, Facebook)
 * - Password reset and email verification
 * - Cookie-based session management (via Auth0 or custom sessions)
 */

import { prisma } from '../prisma';
import { hash, compare } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { generateCustomerId, generateCustomerKey } from '../lib/id-generator';
import { logger } from '../logger';

export interface CustomerAuthResult {
  success: boolean;
  customer?: {
    id: string;
    customerNumber: string;
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    emailVerified: boolean;
  };
  error?: string;
  isNewCustomer?: boolean;
}

export interface CustomerRegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface CustomerLoginInput {
  email: string;
  password: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export class CustomerAuthService {
  private static instance: CustomerAuthService;

  static getInstance(): CustomerAuthService {
    if (!CustomerAuthService.instance) {
      CustomerAuthService.instance = new CustomerAuthService();
    }
    return CustomerAuthService.instance;
  }

  /**
   * Register a new customer with email/password
   */
  async register(input: CustomerRegisterInput): Promise<CustomerAuthResult> {
    try {
      // Check if customer already exists
      const existingCustomer = await prisma.customers.findUnique({
        where: { email: input.email.toLowerCase() },
      });

      if (existingCustomer) {
        // If customer exists but has no password (guest checkout), set password
        if (!existingCustomer.password_hash) {
          const passwordHash = await hash(input.password, 10);
          const customer = await prisma.customers.update({
            where: { id: existingCustomer.id },
            data: {
              password_hash: passwordHash,
              first_name: input.firstName || existingCustomer.first_name,
              last_name: input.lastName || existingCustomer.last_name,
              phone: input.phone || existingCustomer.phone,
              updated_at: new Date(),
            },
          });

          // Generate email verification token
          const verificationToken = this.generateToken();
          await prisma.customers.update({
            where: { id: customer.id },
            data: {
              email_verification_token: verificationToken,
              email_verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            },
          });

          // Reconcile any guest orders placed with this email
          await this.reconcileGuestOrders(customer.id, customer.email);

          return {
            success: true,
            customer: this.formatCustomer(customer),
            isNewCustomer: false,
            error: 'Account created. Please verify your email.',
          };
        }

        return {
          success: false,
          error: 'An account with this email already exists. Please log in.',
        };
      }

      // Create new customer
      const passwordHash = await hash(input.password, 10);
      const customerNumber = await this.generateCustomerNumber();
      const verificationToken = this.generateToken();

      const customer = await prisma.customers.create({
        data: {
          id: generateCustomerId(),
          customer_number: customerNumber,
          email: input.email.toLowerCase(),
          password_hash: passwordHash,
          first_name: input.firstName,
          last_name: input.lastName,
          phone: input.phone,
          email_verified: false,
          email_verification_token: verificationToken,
          email_verification_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // Reconcile any guest orders placed with this email before account existed
      await this.reconcileGuestOrders(customer.id, customer.email);

      return {
        success: true,
        customer: this.formatCustomer(customer),
        isNewCustomer: true,
      };
    } catch (error: any) {
      logger.error('[CustomerAuth] Register error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return {
        success: false,
        error: 'Failed to create account. Please try again.',
      };
    }
  }

  /**
   * Login with email/password
   */
  async login(input: CustomerLoginInput): Promise<CustomerAuthResult> {
    try {
      const customer = await prisma.customers.findUnique({
        where: { email: input.email.toLowerCase() },
      });

      if (!customer) {
        return {
          success: false,
          error: 'Invalid email or password.',
        };
      }

      // Check if account is locked
      if (customer.locked_until && customer.locked_until > new Date()) {
        const lockMinutes = Math.ceil((customer.locked_until.getTime() - Date.now()) / 60000);
        return {
          success: false,
          error: `Account locked. Please try again in ${lockMinutes} minutes.`,
        };
      }

      // Check if customer has password (might be OAuth-only)
      if (!customer.password_hash) {
        return {
          success: false,
          error: 'Please log in with your social account (Google).',
        };
      }

      // Verify password
      const isValid = await compare(input.password, customer.password_hash);

      if (!isValid) {
        // Increment failed attempts
        const failedAttempts = (customer.failed_login_attempts || 0) + 1;
        const updateData: any = {
          failed_login_attempts: failedAttempts,
        };

        // Lock after 5 failed attempts
        if (failedAttempts >= 5) {
          updateData.locked_until = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        }

        await prisma.customers.update({
          where: { id: customer.id },
          data: updateData,
        });

        return {
          success: false,
          error: 'Invalid email or password.',
        };
      }

      // Reset failed attempts on successful login
      await prisma.customers.update({
        where: { id: customer.id },
        data: {
          failed_login_attempts: 0,
          locked_until: null,
          last_login_at: new Date(),
          updated_at: new Date(),
        },
      });

      return {
        success: true,
        customer: this.formatCustomer(customer),
      };
    } catch (error: any) {
      logger.error('[CustomerAuth] Login error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return {
        success: false,
        error: 'Failed to log in. Please try again.',
      };
    }
  }

  /**
   * Update customer profile
   */
  async updateProfile(
    customerId: string,
    data: { firstName?: string; lastName?: string; phone?: string }
  ): Promise<CustomerAuthResult> {
    try {
      const customer = await prisma.customers.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        return {
          success: false,
          error: 'Customer not found.',
        };
      }

      const updatedCustomer = await prisma.customers.update({
        where: { id: customerId },
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          updated_at: new Date(),
        },
      });

      return {
        success: true,
        customer: this.formatCustomer(updatedCustomer),
      };
    } catch (error: any) {
      logger.error('[CustomerAuth] Update profile error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return {
        success: false,
        error: 'Failed to update profile. Please try again.',
      };
    }
  }

  /**
   * Change customer password
   */
  async changePassword(
    customerId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<CustomerAuthResult> {
    try {
      const customer = await prisma.customers.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        return {
          success: false,
          error: 'Customer not found.',
        };
      }

      // Verify current password
      if (!customer.password_hash) {
        return {
          success: false,
          error: 'Cannot change password for OAuth accounts.',
        };
      }

      const isValid = await compare(currentPassword, customer.password_hash);
      if (!isValid) {
        return {
          success: false,
          error: 'Current password is incorrect.',
        };
      }

      // Hash and update new password
      const newPasswordHash = await hash(newPassword, 10);
      await prisma.customers.update({
        where: { id: customerId },
        data: {
          password_hash: newPasswordHash,
          updated_at: new Date(),
        },
      });

      return {
        success: true,
      };
    } catch (error: any) {
      logger.error('[CustomerAuth] Change password error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return {
        success: false,
        error: 'Failed to change password. Please try again.',
      };
    }
  }

  /**
   * OAuth login (Google, etc.)
   */
  async oauthLogin(
    provider: string,
    oauthId: string,
    email: string,
    firstName?: string,
    lastName?: string,
    deviceInfo?: string,
    ipAddress?: string
  ): Promise<CustomerAuthResult> {
    try {
      // Check for existing customer by OAuth ID
      let customer = await prisma.customers.findFirst({
        where: { auth0_id: `${provider}|${oauthId}` },
      });

      // If not found by OAuth ID, try by email
      if (!customer) {
        customer = await prisma.customers.findUnique({
          where: { email: email.toLowerCase() },
        });

        // If found by email, link OAuth ID
        if (customer) {
          customer = await prisma.customers.update({
            where: { id: customer.id },
            data: {
              auth0_id: `${provider}|${oauthId}`,
              email_verified: true, // OAuth emails are verified
              last_login_at: new Date(),
              updated_at: new Date(),
            },
          });
        }
      }

      // Create new customer if not found
      const isNewCustomer = !customer;
      if (!customer) {
        const customerNumber = await this.generateCustomerNumber();

        customer = await prisma.customers.create({
          data: {
            id: generateCustomerId(),
            customer_number: customerNumber,
            email: email.toLowerCase(),
            auth0_id: `${provider}|${oauthId}`,
            first_name: firstName,
            last_name: lastName,
            email_verified: true,
            last_login_at: new Date(),
          },
        });
      } else {
        // Update last login
        await prisma.customers.update({
          where: { id: customer.id },
          data: {
            last_login_at: new Date(),
            updated_at: new Date(),
          },
        });
      }

      // Reconcile any guest orders placed with this email
      await this.reconcileGuestOrders(customer.id, customer.email);

      return {
        success: true,
        customer: this.formatCustomer(customer),
        isNewCustomer,
      };
    } catch (error: any) {
      logger.error('[CustomerAuth] OAuth login error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return {
        success: false,
        error: 'Failed to log in with social account.',
      };
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const customer = await prisma.customers.findFirst({
        where: {
          email_verification_token: token,
          email_verification_expires: { gt: new Date() },
        },
      });

      if (!customer) {
        return {
          success: false,
          error: 'Invalid or expired verification token.',
        };
      }

      await prisma.customers.update({
        where: { id: customer.id },
        data: {
          email_verified: true,
          email_verification_token: null,
          email_verification_expires: null,
          updated_at: new Date(),
        },
      });

      return { success: true };
    } catch (error: any) {
      logger.error('[CustomerAuth] Verify email error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return {
        success: false,
        error: 'Failed to verify email.',
      };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const customer = await prisma.customers.findUnique({
        where: { email: email.toLowerCase() },
      });

      // Don't reveal if customer exists or not
      if (!customer) {
        return { success: true }; // Silent success
      }

      const resetToken = this.generateToken();

      await prisma.customers.update({
        where: { id: customer.id },
        data: {
          reset_password_token: resetToken,
          reset_password_expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
          updated_at: new Date(),
        },
      });

      // TODO: Send email with reset link
      // For now, return token for testing
      console.log(`[CustomerAuth] Password reset token for ${email}: ${resetToken}`);

      return { success: true };
    } catch (error: any) {
      logger.error('[CustomerAuth] Request password reset error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return {
        success: false,
        error: 'Failed to request password reset.',
      };
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<CustomerAuthResult> {
    try {
      const customer = await prisma.customers.findFirst({
        where: {
          reset_password_token: token,
          reset_password_expires: { gt: new Date() },
        },
      });

      if (!customer) {
        return {
          success: false,
          error: 'Invalid or expired reset token.',
        };
      }

      const passwordHash = await hash(newPassword, 10);

      const updatedCustomer = await prisma.customers.update({
        where: { id: customer.id },
        data: {
          password_hash: passwordHash,
          reset_password_token: null,
          reset_password_expires: null,
          failed_login_attempts: 0,
          locked_until: null,
          updated_at: new Date(),
        },
      });

      return {
        success: true,
        customer: this.formatCustomer(updatedCustomer),
      };
    } catch (error: any) {
      logger.error('[CustomerAuth] Reset password error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return {
        success: false,
        error: 'Failed to reset password.',
      };
    }
  }

  /**
   * Logout
   */
  async logout(customerId: string): Promise<{ success: boolean }> {
    // Session management is handled by Auth0 or cookie-based sessions
    // Just update last activity
    try {
      await prisma.customers.update({
        where: { id: customerId },
        data: { updated_at: new Date() },
      });
      return { success: true };
    } catch (error: any) {
      logger.error('[CustomerAuth] Logout error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return { success: true };
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<CustomerAuthResult['customer'] | null> {
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
    });

    return customer ? this.formatCustomer(customer) : null;
  }

  /**
   * Get customer by email (for session lookup)
   */
  async getCustomerByEmail(email: string): Promise<CustomerAuthResult['customer'] | null> {
    const customer = await prisma.customers.findUnique({
      where: { email: email.toLowerCase() },
    });

    return customer ? this.formatCustomer(customer) : null;
  }

  /**
   * Reconcile guest orders — backfills customer_id on orders that were placed
   * as guest (customer_id = null) but match this customer by email.
   * Returns the number of orders linked.
   */
  async reconcileGuestOrders(customerId: string, email: string): Promise<number> {
    try {
      const result = await prisma.orders.updateMany({
        where: {
          customer_id: null,
          customer_email: email.toLowerCase(),
        },
        data: {
          customer_id: customerId,
          updated_at: new Date(),
        },
      });
      if (result.count > 0) {
        console.log(`[CustomerAuth] Reconciled ${result.count} guest orders for customer ${customerId}`);
      }
      return result.count;
    } catch (error: any) {
      logger.error('[CustomerAuth] Reconcile guest orders error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return 0;
    }
  }

  // Private helper methods

  private generateToken(): string {
    return randomUUID().replace(/-/g, '') + Date.now().toString(36);
  }

  private async generateCustomerNumber(): Promise<string> {
    const prefix = 'CUST';
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  private formatCustomer(customer: any): CustomerAuthResult['customer'] {
    return {
      id: customer.id,
      customerNumber: customer.customer_number,
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      emailVerified: customer.email_verified,
    };
  }
}

export default CustomerAuthService;
