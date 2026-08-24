/**
 * GBPVerificationService — Google Business Profile verification flow
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §4 Subsystem 1
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE1.md Task 1
 *
 * Manages the GBP verification state machine:
 *   UNVERIFIED → PENDING (on start) → COMPLETED (on complete success) | FAILED (on complete failure)
 *
 * On COMPLETED:
 *   1. Updates gbp_locations_list.verification_state = 'COMPLETED'
 *   2. Flips tenants.org_standing_mode from 'directory_seed' → 'independent'
 *   3. Fires gbp_verification_milestone CRM alert (platform-scope, customer-visible)
 *
 * Token reuse: delegates to getValidAccessToken + getLinkedLocation from
 * GBPAdvancedSync.ts — no parallel OAuth stack.
 *
 * Pattern: singleton extends BaseService (stateless — delegates to Google API).
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { PLATFORM_SCOPE } from '../lib/platform-scope';
import { getValidAccessToken, getLinkedLocation } from './GBPAdvancedSync';
import { CrmAlertService } from './CrmAlertService';

// ─── Types ──────────────────────────────────────────────────────────────

export type VerificationState = 'UNVERIFIED' | 'PENDING' | 'COMPLETED' | 'FAILED';

export interface VerificationOption {
  /** Google's verification method: SMS, PHONE_CALL, MAIL, EMAIL, etc. */
  method: string;
  /** Display label for the UI */
  label: string;
  /** Additional data from Google (e.g. phoneNumber mask for SMS) */
  data?: Record<string, any>;
}

export interface FetchOptionsResult {
  success: boolean;
  options: VerificationOption[];
  error?: string;
}

export interface StartResult {
  success: boolean;
  pending: boolean;
  verificationId?: string;
  error?: string;
}

export interface CompleteResult {
  success: boolean;
  verified: boolean;
  error?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const GBP_VERIFICATIONS_API = 'https://mybusiness.googleapis.com/v4';

// Human-readable labels for Google's verification methods
const METHOD_LABELS: Record<string, string> = {
  SMS: 'Text message (SMS)',
  PHONE_CALL: 'Phone call',
  MAIL: 'Postcard by mail',
  EMAIL: 'Email',
  VIDEO: 'Video verification',
  AUTO_VERIFY: 'Automatic verification',
};

// ─── Service ────────────────────────────────────────────────────────────

export class GBPVerificationService extends BaseService {
  private static instance: GBPVerificationService;

  private constructor() {
    super();
  }

  static getInstance(): GBPVerificationService {
    if (!GBPVerificationService.instance) {
      GBPVerificationService.instance = new GBPVerificationService();
    }
    return GBPVerificationService.instance;
  }

  /**
   * Fetch available verification options from Google for the tenant's linked location.
   * Delegates to Google's fetchVerificationOptions endpoint.
   */
  async fetchOptions(tenantId: string): Promise<FetchOptionsResult> {
    try {
      const accessToken = await getValidAccessToken(tenantId);
      if (!accessToken) {
        return { success: false, options: [], error: 'No valid Google access token' };
      }

      const location = await getLinkedLocation(tenantId);
      if (!location) {
        return { success: false, options: [], error: 'No GBP location linked' };
      }

      const response = await fetch(
        `${GBP_VERIFICATIONS_API}/accounts/${location.accountId}/locations/${location.locationId}:fetchVerificationOptions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ context: { serviceName: 'GBP Management Suite' } }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[GBPVerification] fetchOptions API error', undefined, {
          tenantId,
          status: response.status,
          error: errorText,
        });
        return { success: false, options: [], error: `Google API error: ${response.status}` };
      }

      const data = await response.json() as { options?: Array<{ method: string; phoneNumber?: string; address?: string }> };
      const options: VerificationOption[] = (data.options || []).map((opt) => ({
        method: opt.method,
        label: METHOD_LABELS[opt.method] || opt.method,
        data: {
          phoneNumber: opt.phoneNumber,
          address: opt.address,
        },
      }));

      return { success: true, options };
    } catch (error: any) {
      logger.error('[GBPVerification] fetchOptions error', undefined, { tenantId, error: error.message });
      return { success: false, options: [], error: error.message };
    }
  }

  /**
   * Start a verification request. Transitions UNVERIFIED → PENDING.
   * Stores the Google-issued verificationId for later completion.
   */
  async start(tenantId: string, option: VerificationOption): Promise<StartResult> {
    try {
      const accessToken = await getValidAccessToken(tenantId);
      if (!accessToken) {
        return { success: false, pending: false, error: 'No valid Google access token' };
      }

      const location = await getLinkedLocation(tenantId);
      if (!location) {
        return { success: false, pending: false, error: 'No GBP location linked' };
      }

      const response = await fetch(
        `${GBP_VERIFICATIONS_API}/accounts/${location.accountId}/locations/${location.locationId}:verify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            method: option.method,
            // Google may require additional context for some methods
            context: { serviceName: 'GBP Management Suite' },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[GBPVerification] start API error', undefined, {
          tenantId,
          status: response.status,
          error: errorText,
        });
        return { success: false, pending: false, error: `Google API error: ${response.status}` };
      }

      const data = await response.json() as { name?: string };
      const verificationId = data.name || undefined;

      // Update verification_state to PENDING
      await prisma.gbp_locations_list.updateMany({
        where: { tenant_id: tenantId },
        data: { verification_state: 'PENDING' },
      });

      logger.info('[GBPVerification] Verification started', undefined, {
        tenantId,
        method: option.method,
        verificationId,
      });

      return { success: true, pending: true, verificationId };
    } catch (error: any) {
      logger.error('[GBPVerification] start error', undefined, { tenantId, error: error.message });
      return { success: false, pending: false, error: error.message };
    }
  }

  /**
   * Submit PIN code to complete verification. Transitions PENDING → COMPLETED or FAILED.
   * On COMPLETED:
   *   1. Updates gbp_locations_list.verification_state
   *   2. Flips directory_seed → independent standing mode
   *   3. Fires gbp_verification_milestone CRM alert
   */
  async complete(tenantId: string, pin: string): Promise<CompleteResult> {
    try {
      const accessToken = await getValidAccessToken(tenantId);
      if (!accessToken) {
        return { success: false, verified: false, error: 'No valid Google access token' };
      }

      const location = await getLinkedLocation(tenantId);
      if (!location) {
        return { success: false, verified: false, error: 'No GBP location linked' };
      }

      // Fetch the latest pending verification for this location
      const verificationsResponse = await fetch(
        `${GBP_VERIFICATIONS_API}/accounts/${location.accountId}/locations/${location.locationId}/verifications`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!verificationsResponse.ok) {
        const errorText = await verificationsResponse.text();
        logger.error('[GBPVerification] list verifications API error', undefined, {
          tenantId,
          status: verificationsResponse.status,
          error: errorText,
        });
        return { success: false, verified: false, error: `Google API error: ${verificationsResponse.status}` };
      }

      const verificationsData = await verificationsResponse.json() as { verifications?: Array<{ name: string; state: string; method: string }> };
      const pendingVerification = verificationsData.verifications?.find((v) => v.state === 'PENDING');

      if (!pendingVerification) {
        return { success: false, verified: false, error: 'No pending verification found' };
      }

      // Submit the PIN/code to Google
      const completeResponse = await fetch(
        `${GBP_VERIFICATIONS_API}/accounts/${location.accountId}/locations/${location.locationId}/verifications/${pendingVerification.name}:complete`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pin: pin,
          }),
        },
      );

      if (!completeResponse.ok) {
        // PIN was wrong — transition to FAILED
        await prisma.gbp_locations_list.updateMany({
          where: { tenant_id: tenantId },
          data: { verification_state: 'FAILED' },
        });

        const errorText = await completeResponse.text();
        logger.warn('[GBPVerification] PIN submission failed', undefined, {
          tenantId,
          status: completeResponse.status,
          error: errorText,
        });
        return { success: true, verified: false, error: 'PIN verification failed — incorrect code' };
      }

      // Success — transition to COMPLETED
      await prisma.gbp_locations_list.updateMany({
        where: { tenant_id: tenantId },
        data: { verification_state: 'COMPLETED' },
      });

      // Standing flip: directory_seed → independent
      await this.flipStandingMode(tenantId);

      // Fire milestone alert
      await this.fireMilestoneAlert(tenantId);

      logger.info('[GBPVerification] Verification completed', undefined, { tenantId });

      return { success: true, verified: true };
    } catch (error: any) {
      logger.error('[GBPVerification] complete error', undefined, { tenantId, error: error.message });
      return { success: false, verified: false, error: error.message };
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────

  /**
   * Flip org_standing_mode from 'directory_seed' to 'independent' on verification.
   * Per directory-presence-seed-claim skill: the tenant keeps its directory_presence
   * tier until the owner upgrades, but is no longer a seed.
   */
  private async flipStandingMode(tenantId: string): Promise<void> {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { org_standing_mode: true },
      });

      if (tenant?.org_standing_mode === 'directory_seed') {
        await prisma.tenants.update({
          where: { id: tenantId },
          data: { org_standing_mode: 'independent' },
        });
        logger.info('[GBPVerification] Standing mode flipped directory_seed → independent', undefined, { tenantId });
      }
    } catch (error: any) {
      // Non-fatal — standing flip is a best-effort optimization
      logger.warn('[GBPVerification] Standing mode flip failed', undefined, { tenantId, error: error.message });
    }
  }

  /**
   * Fire gbp_verification_milestone CRM alert (platform-scope, customer-visible).
   */
  private async fireMilestoneAlert(tenantId: string): Promise<void> {
    try {
      await CrmAlertService.getInstance().create({
        tenant_id: PLATFORM_SCOPE,
        type: 'gbp_verification_milestone',
        title: 'Google Business Profile verified',
        body: 'Your Google Business Profile has been verified. You can now manage reviews, posts, and photos from your dashboard.',
        icon: '✅',
        metadata: {
          tenant_id: tenantId,
          milestone: 'gbp_verification_completed',
        },
      });
    } catch (error: any) {
      // Non-fatal — alert failure must not block verification completion
      logger.warn('[GBPVerification] Milestone alert failed', undefined, { tenantId, error: error.message });
    }
  }
}
