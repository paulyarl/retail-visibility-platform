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
