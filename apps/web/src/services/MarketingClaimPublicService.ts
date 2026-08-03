/**
 * MarketingClaimPublicService — zero-auth, public claim flow service for the
 * Marketing Ops Customer Portal (Path B, §4.3 + §6.1 + §7.1a).
 *
 * Extends PublicApiSingleton (RequestType.PUBLIC, no credentials).
 * All calls are claim-token state — caching is disabled on every method.
 *
 * Wraps the five claim endpoints:
 *   - POST /api/public/marketing/pay/claim         (Path A register)
 *   - POST /api/public/marketing/pay/claim/login   (Path A existing account)
 *   - POST /api/public/marketing/claim/request     (Path B request invite)
 *   - GET  /api/public/marketing/claim/:token      (Path B masked summary)
 *   - POST /api/public/marketing/claim/:token/complete (Path B complete)
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';
import type { Customer } from './CustomerAuthService';

export interface ClaimTokenSummary {
  token: string;
  email: string;
  campaignCount: number;
  businessInitials: string;
  totalSpentRange: string;
  expiresAt: string;
  isExpired: boolean;
  isClaimed: boolean;
}

export interface ClaimResult {
  campaignsLinked: number;
  campaignNames: string[];
  campaigns: Array<{ id: string; businessName: string; serviceCategory?: string }>;
}

export interface ClaimAuthResult {
  success: boolean;
  customer?: Customer;
  tokens?: { accessToken: string; refreshToken: string };
  claim?: ClaimResult;
  error?: string;
  message?: string;
}

export class MarketingClaimPublicService extends PublicApiSingleton {
  private static instance: MarketingClaimPublicService;

  private constructor() {
    super('marketing-claim-public', { ttl: 0 });
  }

  public static getInstance(): MarketingClaimPublicService {
    if (!MarketingClaimPublicService.instance) {
      MarketingClaimPublicService.instance = new MarketingClaimPublicService();
    }
    return MarketingClaimPublicService.instance;
  }

  /**
   * Path A: Register a new account and claim the ptoken's campaign.
   * Returns JWT tokens + claim summary. If the email matches an existing
   * verified customer, returns success=false with error='requires_login'.
   */
  async claimViaPayRegister(
    ptoken: string,
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ): Promise<ClaimAuthResult> {
    const result = await this.makeDefaultRequest<any>(
      '/api/public/marketing/pay/claim',
      {
        method: 'POST',
        body: JSON.stringify({ ptoken, email, password, firstName, lastName }),
      },
      undefined,
      0,
    );
    if (!result.success) {
      return { success: false, error: typeof result.error === 'string' ? result.error : 'Claim failed' };
    }
    const data = result.data?.data ?? result.data;
    return { success: true, customer: data.customer, tokens: data.tokens, claim: data.claim };
  }

  /**
   * Path A: Login to an existing account and claim the ptoken's campaign.
   */
  async claimViaPayLogin(ptoken: string, email: string, password: string): Promise<ClaimAuthResult> {
    const result = await this.makeDefaultRequest<any>(
      '/api/public/marketing/pay/claim/login',
      {
        method: 'POST',
        body: JSON.stringify({ ptoken, email, password }),
      },
      undefined,
      0,
    );
    if (!result.success) {
      return { success: false, error: typeof result.error === 'string' ? result.error : 'Login failed' };
    }
    const data = result.data?.data ?? result.data;
    return { success: true, customer: data.customer, tokens: data.tokens, claim: data.claim };
  }

  /**
   * Path B: Request a claim invite email. Always returns success=true with a
   * generic message (enumeration resistance) regardless of whether any
   * matching campaigns were found.
   */
  async requestClaimInvite(email: string): Promise<{ success: boolean; message: string }> {
    const result = await this.makeDefaultRequest<any>(
      '/api/public/marketing/claim/request',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      undefined,
      0,
    );
    // Always surface the generic message — even on validation errors the
    // backend returns the same message to prevent enumeration.
    const data = result.data?.data ?? result.data;
    return {
      success: true,
      message: data?.message || 'If we found any purchases for that email, we sent a claim link.',
    };
  }

  /**
   * Path B: Validate a claim token and return the masked summary for the
   * claim landing page. Returns null if the token is invalid.
   */
  async getClaimSummary(token: string): Promise<ClaimTokenSummary | null> {
    const result = await this.makeDefaultRequest<any>(
      `/api/public/marketing/claim/${encodeURIComponent(token)}`,
      {},
      undefined,
      0,
    );
    if (!result.success) {
      return null;
    }
    const data = result.data?.data ?? result.data;
    return data?.summary ?? null;
  }

  /**
   * Path B: Complete a claim — register or login, link all eligible campaigns,
   * mark the token consumed, return JWT tokens + claim summary.
   */
  async completeClaim(
    token: string,
    input: {
      mode: 'register' | 'login';
      password: string;
      oauthProvider?: string;
      oauthId?: string;
      firstName?: string;
      lastName?: string;
    },
  ): Promise<ClaimAuthResult> {
    const result = await this.makeDefaultRequest<any>(
      `/api/public/marketing/claim/${encodeURIComponent(token)}/complete`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      undefined,
      0,
    );
    if (!result.success) {
      const data = result.data?.data ?? result.data;
      return {
        success: false,
        error: typeof result.error === 'string' ? result.error : (data?.error ?? 'Claim failed'),
        message: data?.message,
      };
    }
    const data = result.data?.data ?? result.data;
    return { success: true, customer: data.customer, tokens: data.tokens, claim: data.claim };
  }
}

const marketingClaimPublicService = MarketingClaimPublicService.getInstance();
export { marketingClaimPublicService };
export default marketingClaimPublicService;
