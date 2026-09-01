/**
 * DirectorySubmissionPublicService — owner-driven "Add my business" submissions.
 *
 * Extends PublicApiSingleton.
 * Requires the customer JWT to be present (owner must be signed in).
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface SubmissionInput {
  businessName: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string;
  phone?: string;
  primaryCategory: string;
  website?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  submitterComment?: string;
  sourcePage?: string;
  honeyPot?: string;
}

export interface SubmissionResult {
  success: boolean;
  seedId?: string;
  error?: string;
  existing?: {
    id: string;
    businessName: string;
    slug: string | null;
    city: string | null;
    state: string | null;
  };
}

export class DirectorySubmissionPublicService extends PublicApiSingleton {
  private static instance: DirectorySubmissionPublicService;

  private constructor() {
    super('directory-submission-public', { ttl: 0 });
  }

  public static getInstance(): DirectorySubmissionPublicService {
    if (!DirectorySubmissionPublicService.instance) {
      DirectorySubmissionPublicService.instance = new DirectorySubmissionPublicService();
    }
    return DirectorySubmissionPublicService.instance;
  }

  /** POST /api/public/directory/submissions */
  async submitBusiness(input: SubmissionInput): Promise<SubmissionResult> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/public/directory/submissions',
        {
          method: 'POST',
          body: JSON.stringify(input),
          headers: this.getCustomerAuthHeaders(),
        },
        undefined,
        0,
      );

      if (!result.success) {
        const error = typeof result.error === 'string' ? result.error : 'unknown';
        return { success: false, error };
      }

      const data = result.data?.data ?? result.data;
      return {
        success: data?.success ?? false,
        seedId: data?.seed?.id,
        error: data?.error,
      };
    } catch (err: any) {
      const status = err?.status;
      const body = err?.data || err?.body || {};

      if (status === 401) {
        return { success: false, error: 'customer_auth_required' };
      }
      if (status === 409) {
        return {
          success: false,
          error: 'already_listed',
          existing: body?.existing,
        };
      }
      return { success: false, error: err?.message || 'unknown' };
    }
  }

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

export default DirectorySubmissionPublicService.getInstance();
