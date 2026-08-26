/**
 * DirectoryClaimPublicService — zero-auth, public directory claim flow service.
 *
 * Extends PublicApiSingleton (RequestType.PUBLIC, no credentials).
 * Caching is disabled on every method (claim-token state).
 *
 * Wraps:
 *   - GET  /api/public/directory/claim/:token        (public summary)
 *   - POST /api/public/directory/claim/:token/accept (bind owner, requires auth)
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface DirectoryClaimSummary {
  seedId: string;
  slug: string;
  businessName: string;
  category: string;
  city: string;
  state: string;
  address: string;
  phone: string | null;
  snapEbtReported: boolean;
  isExpired: boolean;
  isConsumed: boolean;
  expiresAt: string;
  consumedAt: string | null;
}

export interface DirectoryClaimAcceptResult {
  success: boolean;
  tenantId?: string;
  seedId?: string;
  message?: string;
  error?: string;
  /** Platform user tokens — set when a customer is promoted to platform user */
  userTokens?: { accessToken: string; refreshToken: string };
  /** True when the promoted user has no password (OAuth-only customer) */
  requiresPasswordSetup?: boolean;
  /** The platform user ID that was created or linked */
  platformUserId?: string;
}

export interface DirectoryClaimInitiateResult {
  success: boolean;
  verificationRequired?: boolean;
  sentTo?: string;
  operatorApprovalRequired?: boolean;
  error?: string;
}

export class DirectoryClaimPublicService extends PublicApiSingleton {
  private static instance: DirectoryClaimPublicService;

  private constructor() {
    super('directory-claim-public', { ttl: 0 });
  }

  public static getInstance(): DirectoryClaimPublicService {
    if (!DirectoryClaimPublicService.instance) {
      DirectoryClaimPublicService.instance = new DirectoryClaimPublicService();
    }
    return DirectoryClaimPublicService.instance;
  }

  /** GET /api/public/directory/claim/:token — public token summary */
  async getClaimSummary(token: string): Promise<DirectoryClaimSummary | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/claim/${encodeURIComponent(token)}`,
        { method: 'GET' },
        undefined,
        0,
      );
      if (!result.success) return null;
      const data = result.data?.data ?? result.data;
      if (!data || !(data as any).summary) return null;
      return (data as any).summary as DirectoryClaimSummary;
    } catch {
      return null;
    }
  }

  /** POST /api/public/directory/claim/:token/initiate — initiate claim (sends OTP if required) */
  async initiateClaim(token: string): Promise<DirectoryClaimInitiateResult> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/claim/${encodeURIComponent(token)}/initiate`,
        { method: 'POST', body: JSON.stringify({}), headers: this.getCustomerAuthHeaders() },
        undefined,
        0,
      );
      if (!result.success) {
        const error = typeof result.error === 'string' ? result.error : 'unknown';
        return { success: false, error };
      }
      const data = result.data?.data ?? result.data;
      return (data as any) ?? { success: false, error: 'unknown' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'unknown' };
    }
  }

  /** POST /api/public/directory/claim/:token/accept — bind owner (requires auth) */
  async acceptClaim(token: string, otpCode?: string): Promise<DirectoryClaimAcceptResult> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/claim/${encodeURIComponent(token)}/accept`,
        { method: 'POST', body: JSON.stringify({ otpCode }), headers: this.getCustomerAuthHeaders() },
        undefined,
        0,
      );
      if (!result.success) {
        const error = typeof result.error === 'string' ? result.error : 'unknown';
        return { success: false, error };
      }
      const data = result.data?.data ?? result.data;
      return (data as any) ?? { success: false, error: 'unknown' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'unknown' };
    }
  }

  /**
   * Build auth headers from the customer JWT in localStorage.
   * The claim initiate/accept endpoints use optionalCustomerAuth middleware
   * on the backend, so sending the customer token allows the server to
   * capture customer_id + email for operator-approval claim requests.
   */
  private getCustomerAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const headers: Record<string, string> = {};
    const customerToken = localStorage.getItem('customer_auth_token');
    if (customerToken) {
      headers['Authorization'] = `Bearer ${customerToken}`;
    }
    return headers;
  }
}

const directoryClaimPublicService = DirectoryClaimPublicService.getInstance();
export default directoryClaimPublicService;
