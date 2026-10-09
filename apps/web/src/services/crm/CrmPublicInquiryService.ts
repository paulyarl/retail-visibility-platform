/**
 * CrmPublicInquiryService — Public inquiry submission
 * Auto-selects PublicApiSingleton (anonymous) or CustomerApiSingleton (authenticated)
 * based on whether a customer JWT token is present in localStorage.
 */
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { CustomerApiSingleton } from '@/providers/base/CustomerApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import type { CrmInquiry } from '@/types/crm';

interface PublicInquiryInput {
  tenant_id: string;
  subject: string;
  body?: string;
  sender_name?: string;
  sender_email?: string;
  sender_phone?: string;
  /** Asserted business social profile — a handle (@name) or profile URL.
   *  Server-side it's compared against the listing's same_as links as a
   *  credibility signal, and echoed into the operator context block. */
  sender_social?: string;
  /** Origin tag stored on crm_inquiries.source for Requests-Hub triage
   *  (e.g. 'place_claim_request'). snake_case; validated server-side. */
  source_tag?: string;
  /** When the inquiry concerns a directory listing (claim contact form on
   *  /place/[slug]) the backend resolves its presence seed, appends context
   *  to the body, and logs the contact on the seed's touch timeline. */
  listing_id?: string;
  /** Seed-preview storefront variant (D-1): the /shops/[slug] slug resolves
   *  to the seed_preview demo tenant, then to the source seed. */
  preview_slug?: string;
  /** Owner-request framing — asserted intent + role, shown to the operator
   *  alongside server-computed credibility signals. */
  request_intent?: 'claim' | 'remove' | 'question';
  requester_role?: 'owner' | 'manager' | 'employee' | 'other';
  captcha_answer: string;
  captcha_seed: string;
}

/**
 * Anonymous path — extends PublicApiSingleton (no auth cookies)
 */
class CrmPublicInquiryAnonymousService extends PublicApiSingleton {
  private static instance: CrmPublicInquiryAnonymousService;

  private constructor() {
    super('crm-public-inquiry', { ttl: 0 }); // No cache for mutations
  }

  static getInstance(): CrmPublicInquiryAnonymousService {
    if (!CrmPublicInquiryAnonymousService.instance) {
      CrmPublicInquiryAnonymousService.instance = new CrmPublicInquiryAnonymousService();
    }
    return CrmPublicInquiryAnonymousService.instance;
  }

  async submitInquiry(data: PublicInquiryInput): Promise<CrmInquiry> {
    const result = await this.makeDefaultRequest<any>(
      '/api/public/inquiries',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data?.data as CrmInquiry;
  }
}

/**
 * Authenticated path — extends CustomerApiSingleton (JWT Bearer + X-Customer-ID)
 */
class CrmPublicInquiryCustomerService extends CustomerApiSingleton {
  private static instance: CrmPublicInquiryCustomerService;

  private constructor() {
    super('crm-public-inquiry-customer', { ttl: 0 });
  }

  static getInstance(): CrmPublicInquiryCustomerService {
    if (!CrmPublicInquiryCustomerService.instance) {
      CrmPublicInquiryCustomerService.instance = new CrmPublicInquiryCustomerService();
    }
    return CrmPublicInquiryCustomerService.instance;
  }

  getServiceCachePatterns(): string[] {
    return ['crm-public-inquiry-customer'];
  }

  public async invalidateServiceCaches(): Promise<void> {}

  async submitInquiry(data: PublicInquiryInput): Promise<CrmInquiry> {
    const result = await this.makeDefaultRequest<any>(
      '/api/public/inquiries',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data?.data as CrmInquiry;
  }
}

/**
 * Unified service — picks the right singleton based on auth state
 */
class CrmPublicInquiryService {
  private static instance: CrmPublicInquiryService;

  private constructor() {}

  static getInstance(): CrmPublicInquiryService {
    if (!CrmPublicInquiryService.instance) {
      CrmPublicInquiryService.instance = new CrmPublicInquiryService();
    }
    return CrmPublicInquiryService.instance;
  }

  isCustomerAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem('customer_auth_token');
  }

  async submitInquiry(data: PublicInquiryInput): Promise<CrmInquiry> {
    if (this.isCustomerAuthenticated()) {
      return CrmPublicInquiryCustomerService.getInstance().submitInquiry(data);
    }
    return CrmPublicInquiryAnonymousService.getInstance().submitInquiry(data);
  }
}

export const crmPublicInquiryService = CrmPublicInquiryService.getInstance();
export default CrmPublicInquiryService;
