/**
 * DirectoryPresenceUpgradeService — tier upgrade flow for claimed
 * directory_presence tenants.
 *
 * Wraps:
 *   GET  /api/tenant/:tenantId/upgrade/options
 *   POST /api/tenant/:tenantId/upgrade
 */
import { AuthenticatedApiSingleton } from '../providers/base/AuthenticatedApiSingleton';

export interface UpgradeTierOption {
  tierKey: string;
  name: string;
  displayName: string;
  description: string | null;
  priceMonthly: number;
  priceAnnual: number;
  sortOrder: number;
  newFeatures: { featureKey: string; featureName: string }[];
}

export interface UpgradeOptions {
  currentTier: {
    tierKey: string;
    name: string;
    displayName: string;
    description: string | null;
    priceMonthly: number;
  } | null;
  upgradeOptions: UpgradeTierOption[];
}

export interface UpgradeResult {
  success: boolean;
  tier?: string;
  status?: string;
  activatedAt?: string;
  stripeSubscriptionId?: string;
  requiresAction?: boolean;
  clientSecret?: string;
  error?: string;
  message?: string;
}

export class DirectoryPresenceUpgradeService extends AuthenticatedApiSingleton {
  private static instance: DirectoryPresenceUpgradeService;

  private constructor() {
    super('directory-presence-upgrade');
  }

  public static getInstance(): DirectoryPresenceUpgradeService {
    if (!DirectoryPresenceUpgradeService.instance) {
      DirectoryPresenceUpgradeService.instance = new DirectoryPresenceUpgradeService();
    }
    return DirectoryPresenceUpgradeService.instance;
  }

  /** GET /api/tenant/:tenantId/upgrade/options */
  async getUpgradeOptions(tenantId: string): Promise<UpgradeOptions | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/tenant/${encodeURIComponent(tenantId)}/upgrade/options`,
        { method: 'GET' },
        undefined,
        0,
      );
      if (!result.success) return null;
      const data = result.data?.data ?? result.data;
      return data as UpgradeOptions;
    } catch {
      return null;
    }
  }

  /** POST /api/tenant/:tenantId/upgrade */
  async upgrade(
    tenantId: string,
    targetTier: string,
    billingCycle: 'monthly' | 'annual' = 'monthly',
    paymentMethodId?: string,
  ): Promise<UpgradeResult> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/tenant/${encodeURIComponent(tenantId)}/upgrade`,
        {
          method: 'POST',
          body: JSON.stringify({ targetTier, billingCycle, paymentMethodId }),
        },
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

const directoryPresenceUpgradeService = DirectoryPresenceUpgradeService.getInstance();
export default directoryPresenceUpgradeService;
