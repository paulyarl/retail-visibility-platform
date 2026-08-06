/**
 * RecoveryIntakePublicService — zero-auth, token-gated recovery intake surface.
 * Extends PublicApiSingleton (RequestType.PUBLIC, no credentials).
 *
 * All calls are token/state — caching is disabled on every method
 * (no cache key, ttl 0). Responses follow the double-wrap contract:
 * backend `handleSuccess` wraps in { success, data } and makeDefaultRequest
 * wraps again, so unwrap with `result.data?.data ?? result.data`.
 *
 * Sprint 2 — Recovery Management Engine.
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface IntakeContext {
  intakeId: string;
  campaignId: string;
  businessName: string | null;
  category: string;
  city: string;
  complaintSummary: string | null;
  serviceDate: string | null;
  expiresAt: string;
  alreadySubmitted: boolean;
  intakeKind?: string;
  issueType?: string | null;
  // Registry-driven definition (populated for registry kinds only)
  definition?: {
    label: string;
    description: string | null;
    formSchema: FormField[];
    ownerCopy: OwnerCopy;
    driver: 'code' | 'registry';
    downstreamAgent: string | null;
  } | null;
}

export interface FormField {
  key: string;
  type: string;
  label: string;
  help_text?: string;
  required?: boolean;
  validation?: { min?: number; max?: number; pattern?: string };
  options?: Array<{ value: string; label: string }>;
  options_source?: string;
  custom_validator?: string;
  fields?: FormField[];
}

export interface OwnerCopy {
  title?: string;
  subtitle?: string;
  intro?: string;
  statement_label?: string;
  success_message?: string;
}

export interface SubmitResult {
  intakeId: string;
  campaignId: string;
  stage: string;
  alreadySubmitted: boolean;
}

export interface ReissueResult {
  intakeId: string;
  token: string;
  url: string;
}

export interface AttachmentUploadResult {
  attachmentId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export class RecoveryIntakePublicService extends PublicApiSingleton {
  private static instance: RecoveryIntakePublicService;

  private constructor() {
    super('recovery-intake-public', { ttl: 0 });
  }

  public static getInstance(): RecoveryIntakePublicService {
    if (!RecoveryIntakePublicService.instance) {
      RecoveryIntakePublicService.instance = new RecoveryIntakePublicService();
    }
    return RecoveryIntakePublicService.instance;
  }

  async resolveIntake(token: string): Promise<IntakeContext | { expired: true } | null> {
    const result = await this.makeDefaultRequest<any>(
      `/api/public/recovery/intake?token=${encodeURIComponent(token)}`,
      {},
      undefined,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to resolve intake');
    }
    return result.data?.data ?? result.data;
  }

  async submitIntake(
    token: string,
    payload: {
      ownerStatement: string;
      ownerEmail: string;
      ownerPhone?: string | null;
      proposedResolution: string;
      serviceDate?: string | null;
      statusFlag?: string | null;
      attachmentIds?: string[];
    },
  ): Promise<SubmitResult> {
    const result = await this.makeDefaultRequest<any>(
      '/api/public/recovery/intake/submit',
      {
        method: 'POST',
        body: JSON.stringify({ token, ...payload }),
      },
      undefined,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to submit intake');
    }
    return result.data?.data ?? result.data;
  }

  async submitProfileRepairIntake(
    token: string,
    payload: {
      ownerStatement: string;
      ownerEmail: string;
      ownerPhone?: string | null;
      proposedResolution?: string;
      issueType: string;
      evidencePayload: {
        proof_of_location: string[];
        storefront_photos?: string[];
        google_profile_id?: string | null;
        suspension_notice_details?: { date?: string | null; quoted_reason?: string | null } | null;
        duplicate_listing_url?: string | null;
      };
      attachmentIds?: string[];
    },
  ): Promise<SubmitResult> {
    const result = await this.makeDefaultRequest<any>(
      '/api/public/recovery/intake/submit',
      {
        method: 'POST',
        body: JSON.stringify({ token, ...payload }),
      },
      undefined,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to submit profile repair intake');
    }
    return result.data?.data ?? result.data;
  }

  async reissueLink(campaignId: string): Promise<ReissueResult> {
    const result = await this.makeDefaultRequest<any>(
      '/api/public/recovery/intake/reissue',
      {
        method: 'POST',
        body: JSON.stringify({ campaignId }),
      },
      undefined,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to reissue link');
    }
    return result.data?.data ?? result.data;
  }

  async uploadAttachment(token: string, file: File): Promise<AttachmentUploadResult> {
    const formData = new FormData();
    formData.append('token', token);
    formData.append('file', file);

    const result = await this.makeDefaultRequest<any>(
      '/api/public/recovery/intake/attachments',
      {
        method: 'POST',
        body: formData,
      },
      undefined,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to upload attachment');
    }
    return result.data?.data ?? result.data;
  }

  getAttachmentUrl(token: string, attachmentId: string): string {
    return `/api/public/recovery/intake/attachments/${attachmentId}?token=${encodeURIComponent(token)}`;
  }
}

const recoveryIntakePublicService = RecoveryIntakePublicService.getInstance();
export { recoveryIntakePublicService };
export default recoveryIntakePublicService;
