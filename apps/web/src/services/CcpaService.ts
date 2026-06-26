/**
 * CcpaService — Public CCPA opt-out service
 * Extends PublicApiSingleton for unauthenticated public form submission
 * Endpoint: /api/ccpa/opt-out-sale
 */
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

interface ApiEnvelope {
  success: boolean;
  message?: string;
}

class CcpaService extends PublicApiSingleton {
  private static instance: CcpaService;

  private constructor() {
    super('ccpa-service');
  }

  static getInstance(): CcpaService {
    if (!CcpaService.instance) {
      CcpaService.instance = new CcpaService();
    }
    return CcpaService.instance;
  }

  async submitOptOutSale(email: string, notes?: string): Promise<{ success: boolean; message: string }> {
    const result = await this.makePublicRequest<ApiEnvelope>(
      `/api/ccpa/opt-out-sale`,
      { method: 'POST', body: JSON.stringify({ email, notes }) },
    );
    if (!result.success) {
      return { success: false, message: 'Network error. Please try again or contact support.' };
    }
    if (!result.data?.success) {
      return { success: false, message: result.data?.message || 'Failed to submit request. Please try again.' };
    }
    return { success: true, message: result.data.message || 'Your request has been submitted.' };
  }
}

export const ccpaService = CcpaService.getInstance();
export default CcpaService;
