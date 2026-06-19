/**
 * HelpDeskService — Anonymous Help Desk Support submissions to platform admin.
 * Uses PublicApiSingleton (no auth required).
 * Protected by client-side math CAPTCHA + honeypot (same pattern as CrmPublicInquiryService).
 */
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

export interface HelpDeskInput {
  subject: string;
  body?: string;
  sender_name?: string;
  sender_email?: string;
  sender_phone?: string;
  captcha_answer: string;
  captcha_seed: string;
}

class HelpDeskService extends PublicApiSingleton {
  private static instance: HelpDeskService;

  private constructor() {
    super('help-desk', { ttl: 0 });
  }

  static getInstance(): HelpDeskService {
    if (!HelpDeskService.instance) {
      HelpDeskService.instance = new HelpDeskService();
    }
    return HelpDeskService.instance;
  }

  async submitHelpDeskInquiry(data: HelpDeskInput): Promise<{ id: string }> {
    const result = await this.makeDefaultRequest<any>(
      '/api/public/help-desk',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data?.data as { id: string };
  }
}

export const helpDeskService = HelpDeskService.getInstance();
export default HelpDeskService;
