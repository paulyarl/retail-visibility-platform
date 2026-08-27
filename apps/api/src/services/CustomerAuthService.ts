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

export interface CustomerContexts {
  storefront: boolean;
  platform: boolean;
}

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
  contexts?: CustomerContexts;
  tenantId?: string;
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

          return this.buildAuthResult(customer, {
            isNewCustomer: false,
            error: 'Account created. Please verify your email.',
          });
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

      return this.buildAuthResult(customer, { isNewCustomer: true });
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

      return this.buildAuthResult(customer);
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

      return this.buildAuthResult(updatedCustomer);
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

      // Path C: OAuth emails are auto-verified, so run the marketing claim
      // sweep immediately. Fire-and-forget.
      this.runMarketingClaimSweep(customer.id, customer.email).catch((e) => {
        logger.error('[CustomerAuth] Marketing claim sweep failed after oauthLogin', undefined, {
          customerId: customer.id,
          error: (e as Error).message,
        });
      });

      return this.buildAuthResult(customer, { isNewCustomer });
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

      // Path C: run the marketing claim sweep now that the email is verified.
      // Fire-and-forget — failures must not break the verification flow.
      this.runMarketingClaimSweep(customer.id, customer.email).catch((e) => {
        logger.error('[CustomerAuth] Marketing claim sweep failed after verifyEmail', undefined, {
          customerId: customer.id,
          error: (e as Error).message,
        });
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

      return this.buildAuthResult(updatedCustomer);
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
   * Path C: Marketing claim sweep — links any paid, unclaimed marketing
   * campaigns matching the customer's verified email to their account.
   * Mirrors reconcileGuestOrders but for marketing campaigns. Fire-and-forget
   * at call sites; failures are logged but never break the auth flow.
   *
   * Per §4.3 Path C: only call this for VERIFIED emails (verifyEmail success
   * or oauthLogin, where email_verified is true).
   */
  private async runMarketingClaimSweep(customerId: string, email: string): Promise<void> {
    try {
      const { registrationClaimSweep } = await import('./MarketingCustomerService');
      const result = await registrationClaimSweep(customerId, email);
      if (result.campaignsLinked > 0) {
        logger.info('[CustomerAuth] Marketing claim sweep linked campaigns', undefined, {
          customerId,
          email,
          campaignsLinked: result.campaignsLinked,
          campaignNames: result.campaignNames,
        });
      }
    } catch (e) {
      // Re-throw so the caller's .catch() handler logs it
      throw e;
    }
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

  /**
   * Compute context signals for a customer (§4.2).
   *
   * hasStorefrontContext = EXISTS(active customer_tenant_relationships) OR EXISTS(orders)
   * hasPlatformContext   = EXISTS(mkt_campaigns_list.customer_id) OR EXISTS(marketing_revenue.customer_id)
   *
   * Server-computed from actual relationships — never admin-set or customer-edited.
   * Cached in CustomerAuthContext and refreshed on login, claim, and purchase events.
   */
  async computeContexts(customerId: string): Promise<CustomerContexts> {
    const [activeRels, orders, campaigns, revenue, claimedSeeds] = await Promise.all([
      prisma.customer_tenant_relationships.count({
        where: { customer_id: customerId, is_active: true },
      }),
      prisma.orders.count({
        where: { customer_id: customerId },
      }),
      prisma.mkt_campaigns_list.count({
        where: { customer_id: customerId },
      }),
      prisma.marketing_revenue.count({
        where: { customer_id: customerId },
      }),
      // Directory claim: customer owns a claimed directory seed.
      // Path 1: customer was promoted (linked_user_id → user_tenants → seeds)
      // Path 2: approved claim request by customer_id (covers cases where
      //         promotion didn't run because customer_id was captured late)
      // Path 3: approved claim request by customer_email (covers cases where
      //         the /initiate route didn't have optionalCustomerAuth so
      //         customer_id was null but email was stored on the request)
      prisma.$queryRaw<any[]>`
        SELECT 1
        FROM directory_presence_seeds dps
        LEFT JOIN user_tenants ut ON ut.tenant_id = dps.tenant_id
        LEFT JOIN customers c ON c.linked_user_id = ut.user_id
        LEFT JOIN directory_claim_requests dcr ON dcr.seed_id = dps.id
        WHERE dps.status = 'claimed'
          AND (
            c.id = ${customerId}
            OR dcr.customer_id = ${customerId}
            OR (dcr.customer_email IS NOT NULL
                AND dcr.customer_email = (SELECT email FROM customers WHERE id = ${customerId})
                AND dcr.status = 'approved')
          )
        LIMIT 1
      `,
    ]);

    return {
      storefront: activeRels > 0 || orders > 0,
      platform: campaigns > 0 || revenue > 0 || claimedSeeds.length > 0,
    };
  }

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

  /**
   * List the customer's own directory claim requests (pending + recently
   * approved/rejected). Used by /me so the account dashboard can show a
   * "Pending Claims" section before the operator approves — otherwise the
   * owner sees no indication their claim was submitted.
   *
   * Matches by customer_id OR customer_email (covers claims submitted before
   * optionalCustomerAuth was added to the /initiate route).
   */
  async listMyClaimRequests(customerId: string): Promise<any[]> {
    try {
      // Resolve email for the email-match fallback
      const custRows = await prisma.$queryRaw<any[]>`
        SELECT email FROM customers WHERE id = ${customerId} LIMIT 1
      `;
      const email = custRows[0]?.email || null;

      return await prisma.$queryRaw<any[]>`
        SELECT
          dcr.id,
          dcr.seed_id,
          dcr.status,
          dcr.submitted_at,
          dcr.reviewed_at,
          dcr.rejection_reason,
          dl.business_name,
          dl.category,
          dl.city,
          dl.state
        FROM directory_claim_requests dcr
        JOIN directory_presence_seeds dps ON dps.id = dcr.seed_id
        LEFT JOIN directory_listings_list dl ON dl.id = dps.listing_id
        WHERE dcr.customer_id = ${customerId}
           OR (dcr.customer_email IS NOT NULL AND dcr.customer_email = ${email})
        ORDER BY dcr.submitted_at DESC
        LIMIT 10
      `;
    } catch {
      return [];
    }
  }

  /**
   * Resolve the tenant ID the customer owns (via linked_user_id → user_tenants
   * OWNER row). Returns the first owned tenant, or null if the customer doesn't
   * own a tenant yet (e.g. hasn't claimed a directory seed or purchased a
   * GBP-scoped campaign). Used by /me to expose the tenant ID for sidebar
   * navigation links to the tenant dashboard and directory listing.
   */
  async resolveOwnedTenantId(customerId: string): Promise<string | null> {
    try {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT ut.tenant_id
        FROM user_tenants ut
        JOIN customers c ON c.linked_user_id = ut.user_id
        WHERE c.id = ${customerId}
          AND ut.role = 'OWNER'
        ORDER BY ut.created_at ASC
        LIMIT 1
      `;
      return rows[0]?.tenant_id || null;
    } catch {
      return null;
    }
  }

  /**
   * Set the initial platform password for a customer who was promoted to a
   * platform user via directory seed claim (or similar) but had no password
   * (OAuth-only customer). This establishes platform credentials so the owner
   * can log in to /auth/login and access their tenant dashboard.
   *
   * Guards:
   * - Customer must have a linked_user_id (must have been promoted)
   * - The linked platform user must NOT already have a password_hash (or have
   *   an empty one) — this is initial-setup only, not a password change
   * - New password must be ≥ 8 characters
   *
   * Returns platform JWT tokens on success so the frontend can transition
   * to platform auth immediately after setup.
   */
  async setupPlatformPassword(
    customerId: string,
    newPassword: string,
  ): Promise<{ success: boolean; userTokens?: { accessToken: string; refreshToken: string }; error?: string }> {
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    // Load customer with linked_user_id
    const customerRows = await prisma.$queryRaw<any[]>`
      SELECT id, linked_user_id FROM customers WHERE id = ${customerId} LIMIT 1
    `;
    if (!customerRows[0]) {
      return { success: false, error: 'customer_not_found' };
    }
    const customer = customerRows[0];

    if (!customer.linked_user_id) {
      return { success: false, error: 'no_linked_user' };
    }

    // Load the platform user — check they don't already have a password
    const userRows = await prisma.$queryRaw<any[]>`
      SELECT id, email, password_hash, is_active FROM users WHERE id = ${customer.linked_user_id} LIMIT 1
    `;
    if (!userRows[0]) {
      return { success: false, error: 'platform_user_not_found' };
    }
    const user = userRows[0];

    if (user.password_hash && user.password_hash.length > 0) {
      return { success: false, error: 'password_already_set' };
    }

    // Hash the new password and update the platform user
    const passwordHash = await hash(newPassword, 12);
    await prisma.$executeRaw`
      UPDATE users SET password_hash = ${passwordHash}, updated_at = now()
      WHERE id = ${user.id}
    `;

    // Generate platform JWT tokens
    const { authService } = await import('../auth/auth.service');
    const { user_role } = await import('@prisma/client');
    const tenantRows = await prisma.$queryRaw<any[]>`
      SELECT tenant_id FROM user_tenants WHERE user_id = ${user.id} ORDER BY created_at ASC
    `;
    const tenantIds = tenantRows.map((r) => r.tenant_id);

    const payload = {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user_role.USER,
      tenantIds,
    };

    const accessToken = authService.generateAccessToken(payload);
    const refreshToken = authService.generateRefreshToken(payload);

    logger.info('[CustomerAuth] Platform password set for promoted customer', undefined, {
      customerId, platformUserId: user.id,
    });

    return { success: true, userTokens: { accessToken, refreshToken } };
  }

  /**
   * Build a CustomerAuthResult with contexts computed (§4.2).
   * Used by register/login/verifyEmail/oauthLogin/resetPassword so every
   * auth response carries the context signals for frontend sidebar gating.
   */
  private async buildAuthResult(
    customer: any,
    extra?: { isNewCustomer?: boolean; error?: string; success?: boolean },
  ): Promise<CustomerAuthResult> {
    const contexts = await this.computeContexts(customer.id);
    const tenantId = await this.resolveOwnedTenantId(customer.id);
    return {
      success: extra?.success ?? true,
      customer: this.formatCustomer(customer),
      contexts,
      tenantId: tenantId || undefined,
      isNewCustomer: extra?.isNewCustomer,
      error: extra?.error,
    };
  }
}

export default CustomerAuthService;
