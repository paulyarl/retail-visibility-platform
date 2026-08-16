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

  /** POST /api/public/directory/claim/:token/accept — bind owner (requires auth) */
  async acceptClaim(token: string): Promise<DirectoryClaimAcceptResult> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/claim/${encodeURIComponent(token)}/accept`,
        { method: 'POST', body: JSON.stringify({}) },
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
}

const directoryClaimPublicService = DirectoryClaimPublicService.getInstance();
export default directoryClaimPublicService;
