/**
 * Org Capability Service
 *
 * Client service for fetching org-level effective capabilities.
 * Calls GET /api/organizations/:orgId/effective-capabilities and maps
 * the response into a typed OrgCapabilitiesState.
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';

// ====================
// TYPES (camelCase for frontend)
// ====================

export type OrgTabKey =
  | 'overview' | 'locations' | 'propagation' | 'capabilities'
  | 'team' | 'commerce' | 'billing';

export type OrgPanelKey =
  | 'task_checklist' | 'quick_links' | 'system_status'
  | 'recommendations' | 'crm_summary';

export type OrgPropagationType =
  | 'org_propagation_products' | 'org_propagation_categories'
  | 'org_propagation_business_info' | 'org_propagation_settings';

export interface OrgSubscriptionContext {
  internalStatus: string;
  maintenanceState: string | null;
  isReadOnly: boolean;
  isLimited: boolean;
  writable: boolean;
}

export interface OrgCapabilitiesState {
  enabled: boolean;
  isFlexible: boolean;
  allowedTabs: OrgTabKey[];
  allowedPanels: OrgPanelKey[];
  allowedPropagationTypes: OrgPropagationType[];
  orgAvailable: boolean;
  tier?: {
    key: string;
    name: string;
    description: string;
  };
  purchasedFeatureKeys?: string[];
  subscriptionContext?: OrgSubscriptionContext;
}

// ====================
// CAPABILITY ROLLUP TYPES
// ====================

export interface CapabilityDomainSummary {
  key: string;
  label: string;
  enabledCount: number;
  totalLocations: number;
  disabledCount: number;
}

export interface CapabilityLocationSummary {
  tenantId: string;
  tenantName: string;
  domains: Record<string, boolean>;
}

export interface OrgCapabilityRollup {
  totalLocations: number;
  domains: CapabilityDomainSummary[];
  locations: CapabilityLocationSummary[];
}

// ====================
// BOT STATUS TYPES
// ====================

export interface BotLocationStatus {
  tenantId: string;
  tenantName: string;
  botActive: boolean;
  conversationCount: number;
  activeConversations: number;
  hasFaqEmbeddings: boolean;
  hasProductEmbeddings: boolean;
}

export interface OrgBotStatus {
  totalLocations: number;
  totalActive: number;
  totalInactive: number;
  locations: BotLocationStatus[];
}

// ====================
// BACKEND RESPONSE (snake_case)
// ====================

interface BackendOrgCapabilities {
  enabled: boolean;
  is_flexible: boolean;
  allowed_tabs: OrgTabKey[];
  allowed_panels: OrgPanelKey[];
  allowed_propagation_types: OrgPropagationType[];
  org_available: boolean;
  tier?: { key: string; name: string; description: string };
  purchased_feature_keys?: string[];
  subscription_context?: {
    internal_status: string;
    maintenance_state: string | null;
    is_read_only: boolean;
    is_limited: boolean;
    writable: boolean;
  };
}

function mapOrgCapabilities(b: BackendOrgCapabilities): OrgCapabilitiesState {
  return {
    enabled: b.enabled,
    isFlexible: b.is_flexible,
    allowedTabs: b.allowed_tabs,
    allowedPanels: b.allowed_panels,
    allowedPropagationTypes: b.allowed_propagation_types,
    orgAvailable: b.org_available,
    tier: b.tier,
    purchasedFeatureKeys: b.purchased_feature_keys || [],
    subscriptionContext: b.subscription_context
      ? {
          internalStatus: b.subscription_context.internal_status,
          maintenanceState: b.subscription_context.maintenance_state,
          isReadOnly: b.subscription_context.is_read_only,
          isLimited: b.subscription_context.is_limited,
          writable: b.subscription_context.writable,
        }
      : undefined,
  };
}

// ====================
// SERVICE
// ====================

class OrgCapabilityService extends AuthenticatedApiSingleton {
  private static instance: OrgCapabilityService;
  private capCache = new Map<string, { data: OrgCapabilitiesState; expiry: number }>();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute — aligned with backend

  private constructor() {
    super('org-capability-service', { ttl: 60 * 1000 });
  }

  static getInstance(): OrgCapabilityService {
    if (!OrgCapabilityService.instance) {
      OrgCapabilityService.instance = new OrgCapabilityService();
    }
    return OrgCapabilityService.instance;
  }

  getServiceCachePatterns(): string[] {
    return ['org-capabilities'];
  }

  async invalidateServiceCaches(): Promise<void> {
    this.capCache.clear();
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  async invalidateOrgCapabilities(orgId: string): Promise<void> {
    this.capCache.delete(orgId);
    await this.invalidateCache(`org-caps-${orgId}`);
  }

  async getOrgCapabilities(orgId: string): Promise<OrgCapabilitiesState> {
    const cached = this.capCache.get(orgId);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const cacheKey = `org-caps-${orgId}`;
    const result = await this.makeAuthenticatedRequest<{
      success: boolean;
      data: BackendOrgCapabilities;
    }>(
      `/api/organizations/${orgId}/effective-capabilities`,
      {},
      cacheKey
    );

    if (!result.success || !result.data?.data) {
      throw new Error(`[OrgCapabilityService] Failed to fetch org capabilities for ${orgId}`);
    }

    const mapped = mapOrgCapabilities(result.data.data);
    this.capCache.set(orgId, { data: mapped, expiry: Date.now() + this.CACHE_TTL });
    return mapped;
  }

  private rollupCache = new Map<string, { data: OrgCapabilityRollup; expiry: number }>();
  private readonly ROLLUP_CACHE_TTL = 5 * 60 * 1000; // 5 minutes — aligned with backend

  async getCapabilityRollup(orgId: string): Promise<OrgCapabilityRollup> {
    const cached = this.rollupCache.get(orgId);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const cacheKey = `org-rollup-${orgId}`;
    const result = await this.makeAuthenticatedRequest<{
      success: boolean;
      data: OrgCapabilityRollup;
    }>(
      `/api/organizations/${orgId}/capability-rollup`,
      {},
      cacheKey
    );

    if (!result.success || !result.data?.data) {
      throw new Error(`[OrgCapabilityService] Failed to fetch capability rollup for ${orgId}`);
    }

    const data = result.data.data;
    this.rollupCache.set(orgId, { data, expiry: Date.now() + this.ROLLUP_CACHE_TTL });
    return data;
  }

  private botStatusCache = new Map<string, { data: OrgBotStatus; expiry: number }>();
  private readonly BOT_STATUS_CACHE_TTL = 5 * 60 * 1000;

  async getBotStatus(orgId: string): Promise<OrgBotStatus> {
    const cached = this.botStatusCache.get(orgId);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const cacheKey = `org-bot-status-${orgId}`;
    const result = await this.makeAuthenticatedRequest<{
      success: boolean;
      data: OrgBotStatus;
    }>(
      `/api/organizations/${orgId}/bot-status`,
      {},
      cacheKey
    );

    if (!result.success || !result.data?.data) {
      throw new Error(`[OrgCapabilityService] Failed to fetch bot status for ${orgId}`);
    }

    const data = result.data.data;
    this.botStatusCache.set(orgId, { data, expiry: Date.now() + this.BOT_STATUS_CACHE_TTL });
    return data;
  }

  async startOrgBotChat(orgId: string): Promise<{
    sessionId: string;
    conversationId: string;
    greeting: string;
    orgContext?: { orgName: string; totalLocations: number };
  }> {
    const result = await this.makeAuthenticatedRequest<{
      success: boolean;
      sessionId: string;
      conversationId: string;
      greeting: string;
      orgContext?: { orgName: string; totalLocations: number };
    }>(
      `/api/organizations/${orgId}/bot/chat/start`,
      { method: 'POST' },
      `org-bot-chat-start-${orgId}`
    );

    if (!result.success || !result.data?.success) {
      throw new Error(`[OrgCapabilityService] Failed to start org bot chat for ${orgId}`);
    }

    return {
      sessionId: result.data.sessionId,
      conversationId: result.data.conversationId,
      greeting: result.data.greeting,
      orgContext: result.data.orgContext,
    };
  }

  async sendOrgBotMessage(orgId: string, sessionId: string, message: string): Promise<{
    reply: string;
    responseType: string;
    matchedFaqId: string | null;
    messageId: string;
    skillCard?: any;
    skillName?: string | null;
  }> {
    const result = await this.makeAuthenticatedRequest<{
      success: boolean;
      reply: string;
      responseType: string;
      matchedFaqId: string | null;
      messageId: string;
      skillCard?: any;
      skillName?: string | null;
    }>(
      `/api/organizations/${orgId}/bot/chat/message`,
      { method: 'POST', body: JSON.stringify({ sessionId, message }) },
      `org-bot-chat-msg-${orgId}`
    );

    if (!result.success || !result.data?.success) {
      throw new Error(`[OrgCapabilityService] Failed to send org bot message for ${orgId}`);
    }

    return {
      reply: result.data.reply,
      responseType: result.data.responseType,
      matchedFaqId: result.data.matchedFaqId ?? null,
      messageId: result.data.messageId,
      skillCard: result.data.skillCard,
      skillName: result.data.skillName ?? null,
    };
  }
}

export const orgCapabilityService = OrgCapabilityService.getInstance();
export default OrgCapabilityService;
