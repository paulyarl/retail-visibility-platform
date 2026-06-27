/**
 * System Status Service
 *
 * Constructs a capability-aware system status summary on the backend,
 * powered by EffectiveCapabilityResolver. Replaces the frontend's
 * hardcoded SystemStatusCard with real data from effective capabilities
 * + business state (hours, product counts, directory listing, etc.).
 *
 * Single DB round-trip via resolveEffectiveCapabilities + parallel
 * business-state queries — same pattern as NextStepsService.
 */

import { prisma } from '../prisma';
import { resolveEffectiveCapabilities } from './EffectiveCapabilityResolver';
import { logger } from '../logger';
import type { EffectiveCapabilities } from './resolvers/types';

// ====================
// TYPES
// ====================

export type StatusLevel = 'ok' | 'warning' | 'error' | 'inactive';

export interface SystemStatusItem {
  key: string;
  label: string;
  status: StatusLevel;
  detail?: string;
  link?: string;
}

export interface SystemStatusResponse {
  tenant_id: string;
  overall: 'operational' | 'attention' | 'critical';
  subscription_status: string;
  is_read_only: boolean;
  items: SystemStatusItem[];
}

// ====================
// CORE
// ====================

export async function resolveSystemStatus(
  tenantIdOrSlug: string
): Promise<SystemStatusResponse | null> {
  try {
    const tenantId = await resolveTenantId(tenantIdOrSlug);
    if (!tenantId) {
      logger.warn('[SystemStatusService] Tenant not found', undefined, { identifier: tenantIdOrSlug });
      return null;
    }

    const [capabilities, businessState] = await Promise.all([
      resolveEffectiveCapabilities(tenantId).catch(() => null),
      fetchBusinessState(tenantId),
    ]);

    const items = buildStatusItems(capabilities, businessState, tenantId);
    const overall = computeOverall(items, capabilities);

    return {
      tenant_id: tenantId,
      overall,
      subscription_status: capabilities?.subscription_context?.internalStatus || businessState.subscriptionStatus,
      is_read_only: capabilities?.subscription_context?.isReadOnly ?? false,
      items,
    };
  } catch (error) {
    logger.error('[SystemStatusService] Failed to resolve system status: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { tenantIdOrSlug, error });
    return null;
  }
}

// ====================
// STATUS ITEM BUILDERS
// ====================

function buildStatusItems(
  caps: EffectiveCapabilities | null,
  state: BusinessState,
  tenantId: string,
): SystemStatusItem[] {
  const eff = caps?.effective;
  const subCtx = caps?.subscription_context;
  const isReadOnly = subCtx?.isReadOnly ?? false;
  const isLimited = subCtx?.isLimited ?? false;

  const items: SystemStatusItem[] = [];

  // 1. Store — storefront capability + hours + type selection
  const storefrontEnabled = eff?.storefront.enabled ?? false;
  const storefrontType = eff?.storefront.effective_type ?? 'none';
  const storefrontNeedsSelection = storefrontEnabled && (eff?.storefront.is_flexible ?? false) && !(eff?.storefront.has_merchant_selection ?? false);
  if (storefrontEnabled) {
    if (storefrontNeedsSelection) {
      items.push({
        key: 'store',
        label: 'Store',
        status: 'warning',
        detail: 'Storefront type selection required',
        link: `/t/${tenantId}/settings/storefront-options`,
      });
    } else if (state.locationStatus === 'temporarily_closed') {
      items.push({
        key: 'store',
        label: 'Store',
        status: 'warning',
        detail: 'Temporarily closed',
        link: `/t/${tenantId}/settings`,
      });
    } else if (!state.hasHours) {
      items.push({
        key: 'store',
        label: 'Store',
        status: 'warning',
        detail: 'No business hours set',
        link: `/t/${tenantId}/settings/hours`,
      });
    } else {
      items.push({
        key: 'store',
        label: 'Store',
        status: 'ok',
        detail: storefrontType !== 'none' ? `${capitalize(storefrontType)} storefront` : undefined,
        link: `/t/${tenantId}/settings`,
      });
    }
  } else {
    items.push({
      key: 'store',
      label: 'Store',
      status: 'error',
      detail: 'Storefront disabled',
      link: `/t/${tenantId}/settings`,
    });
  }

  // 1b. Product type — selection required check
  const productTypeEnabled = eff?.product_types.enabled ?? false;
  const productTypeNeedsSelection = productTypeEnabled && (eff?.product_types.is_flexible ?? false) && !(eff?.product_types.has_merchant_selection ?? false);
  if (productTypeEnabled) {
    if (productTypeNeedsSelection) {
      items.push({
        key: 'product-type',
        label: 'Product Type',
        status: 'warning',
        detail: 'Selection required',
        link: `/t/${tenantId}/settings/product-types`,
      });
    } else {
      const pt = eff?.product_types.effective_type ?? 'none';
      items.push({
        key: 'product-type',
        label: 'Product Type',
        status: 'ok',
        detail: pt !== 'none' && pt !== 'flexible' ? capitalize(pt) : undefined,
        link: `/t/${tenantId}/settings/product-types`,
      });
    }
  }

  // 2. Commerce — checkout availability
  const commerceEnabled = eff?.commerce.enabled ?? false;
  const checkoutAvailable = eff?.commerce.checkout_available ?? false;
  if (commerceEnabled && checkoutAvailable) {
    items.push({
      key: 'commerce',
      label: 'Commerce',
      status: 'ok',
      detail: 'Checkout available',
      link: `/t/${tenantId}/settings/commerce`,
    });
  } else if (commerceEnabled && !checkoutAvailable) {
    items.push({
      key: 'commerce',
      label: 'Commerce',
      status: 'warning',
      detail: 'Checkout unavailable',
      link: `/t/${tenantId}/settings/commerce`,
    });
  } else {
    items.push({
      key: 'commerce',
      label: 'Commerce',
      status: isReadOnly ? 'error' : 'inactive',
      detail: 'Not enabled',
      link: `/t/${tenantId}/settings/commerce`,
    });
  }

  // 3. Payments — payment gateway effective gateways
  const pgEnabled = eff?.payment_gateway.enabled ?? false;
  const effectiveGateways = eff?.payment_gateway.effective_gateways ?? [];
  if (pgEnabled && effectiveGateways.length > 0) {
    items.push({
      key: 'payments',
      label: 'Payments',
      status: 'ok',
      detail: effectiveGateways.map(capitalize).join(', '),
      link: `/t/${tenantId}/settings/payment-gateways`,
    });
  } else if (pgEnabled && effectiveGateways.length === 0) {
    items.push({
      key: 'payments',
      label: 'Payments',
      status: 'warning',
      detail: 'No gateways configured',
      link: `/t/${tenantId}/settings/payment-gateways`,
    });
  } else {
    items.push({
      key: 'payments',
      label: 'Payments',
      status: isReadOnly ? 'error' : 'inactive',
      detail: 'Not enabled',
      link: `/t/${tenantId}/settings/payment-gateways`,
    });
  }

  // 4. Fulfillment — effective methods + selection required check
  const fulfillmentEnabled = eff?.fulfillment.enabled ?? false;
  const methods: string[] = [];
  if (eff?.fulfillment.effective_shows_pickup) methods.push('Pickup');
  if (eff?.fulfillment.effective_shows_delivery) methods.push('Delivery');
  if (eff?.fulfillment.effective_shows_shipping) methods.push('Shipping');
  if (fulfillmentEnabled && methods.length > 0) {
    items.push({
      key: 'fulfillment',
      label: 'Fulfillment',
      status: 'ok',
      detail: methods.join(', '),
      link: `/t/${tenantId}/settings/fulfillment`,
    });
  } else if (fulfillmentEnabled && methods.length === 0) {
    items.push({
      key: 'fulfillment',
      label: 'Fulfillment',
      status: 'warning',
      detail: 'No methods selected',
      link: `/t/${tenantId}/settings/fulfillment`,
    });
  } else {
    items.push({
      key: 'fulfillment',
      label: 'Fulfillment',
      status: 'inactive',
      detail: 'Not enabled',
    });
  }

  // 5. Inventory — product options + product counts
  const productOptsEnabled = eff?.product_options.enabled ?? false;
  if (productOptsEnabled || state.totalItems > 0) {
    if (state.activeItems === 0) {
      items.push({
        key: 'inventory',
        label: 'Inventory',
        status: 'warning',
        detail: state.totalItems > 0 ? 'No active products' : 'No products yet',
        link: `/t/${tenantId}/items`,
      });
    } else {
      items.push({
        key: 'inventory',
        label: 'Inventory',
        status: 'ok',
        detail: `${state.activeItems} active product${state.activeItems !== 1 ? 's' : ''}`,
        link: `/t/${tenantId}/items`,
      });
    }
  } else {
    items.push({
      key: 'inventory',
      label: 'Inventory',
      status: 'inactive',
      detail: 'Not enabled',
    });
  }

  // 6. Integrations — effective integration types
  const integrationsEnabled = eff?.integrations.enabled ?? false;
  const effectiveIntegrations = eff?.integrations.effective_types ?? [];
  if (integrationsEnabled && effectiveIntegrations.length > 0) {
    items.push({
      key: 'integrations',
      label: 'Integrations',
      status: 'ok',
      detail: effectiveIntegrations.map(formatIntegrationType).join(', '),
      link: `/t/${tenantId}/settings/integrations`,
    });
  } else if (integrationsEnabled && effectiveIntegrations.length === 0) {
    items.push({
      key: 'integrations',
      label: 'Integrations',
      status: 'warning',
      detail: 'No integrations configured',
      link: `/t/${tenantId}/settings/integrations`,
    });
  } else {
    items.push({
      key: 'integrations',
      label: 'Integrations',
      status: 'inactive',
      detail: 'Not available on your plan',
    });
  }

  // 7. Directory — published status
  const directoryEnabled = eff?.directory_entry.enabled ?? false;
  if (directoryEnabled) {
    if (state.hasPublishedDirectory) {
      items.push({
        key: 'directory',
        label: 'Directory',
        status: 'ok',
        detail: 'Published',
        link: `/t/${tenantId}/settings/directory`,
      });
    } else {
      items.push({
        key: 'directory',
        label: 'Directory',
        status: 'warning',
        detail: 'Not published',
        link: `/t/${tenantId}/settings/directory`,
      });
    }
  } else {
    items.push({
      key: 'directory',
      label: 'Directory',
      status: 'inactive',
      detail: 'Not available on your plan',
    });
  }

  // 8. CRM
  const crmEnabled = eff?.crm.enabled ?? false;
  if (crmEnabled) {
    items.push({
      key: 'crm',
      label: 'CRM',
      status: 'ok',
      detail: 'Available',
      link: `/t/${tenantId}/support`,
    });
  } else {
    items.push({
      key: 'crm',
      label: 'CRM',
      status: 'inactive',
      detail: 'Not available on your plan',
    });
  }

  // 9. Chatbot
  const chatbotEnabled = eff?.chatbot.enabled ?? false;
  if (chatbotEnabled) {
    items.push({
      key: 'chatbot',
      label: 'Chatbot',
      status: 'ok',
      detail: 'Available',
      link: `/t/${tenantId}/bot`,
    });
  } else {
    items.push({
      key: 'chatbot',
      label: 'Chatbot',
      status: isLimited ? 'error' : 'inactive',
      detail: isLimited ? 'Disabled (limited mode)' : 'Not available on your plan',
    });
  }

  // 10. Subscription
  if (isReadOnly) {
    items.push({
      key: 'subscription',
      label: 'Subscription',
      status: 'error',
      detail: capitalize(subCtx?.internalStatus || 'expired'),
      link: `/t/${tenantId}/settings/subscription`,
    });
  } else if (isLimited) {
    items.push({
      key: 'subscription',
      label: 'Subscription',
      status: 'warning',
      detail: capitalize(subCtx?.internalStatus || 'limited'),
      link: `/t/${tenantId}/settings/subscription`,
    });
  } else {
    items.push({
      key: 'subscription',
      label: 'Subscription',
      status: 'ok',
      detail: caps?.tier?.name || 'Active',
      link: `/t/${tenantId}/settings/subscription`,
    });
  }

  return items;
}

// ====================
// OVERALL COMPUTATION
// ====================

function computeOverall(
  items: SystemStatusItem[],
  caps: EffectiveCapabilities | null,
): 'operational' | 'attention' | 'critical' {
  if (caps?.subscription_context?.isReadOnly) return 'critical';

  const hasError = items.some((i) => i.status === 'error');
  if (hasError) return 'critical';

  const hasWarning = items.some((i) => i.status === 'warning');
  if (hasWarning) return 'attention';

  return 'operational';
}

// ====================
// BUSINESS STATE
// ====================

interface BusinessState {
  totalItems: number;
  activeItems: number;
  hasPublishedDirectory: boolean;
  hasHours: boolean;
  locationStatus: string;
  subscriptionStatus: string;
}

async function fetchBusinessState(tenantId: string): Promise<BusinessState> {
  const [tenant, businessProfile, itemCounts, directoryListing] = await Promise.all([
    prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_status: true,
        location_status: true,
      },
    }).catch(() => null),

    prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id: tenantId },
      select: { hours: true },
    }).catch(() => null),

    Promise.all([
      prisma.inventory_items.count({ where: { tenant_id: tenantId } }),
      prisma.inventory_items.count({ where: { tenant_id: tenantId, item_status: 'active' } }),
    ]).catch(() => [0, 0] as [number, number]),

    prisma.directory_listings_list.findFirst({
      where: { tenant_id: tenantId },
      select: { is_published: true },
    }).catch(() => null),
  ]);

  const [totalItems, activeItems] = itemCounts as [number, number];

  const hasHours = !!businessProfile?.hours &&
    typeof businessProfile.hours === 'object' &&
    Object.keys(businessProfile.hours as object).length > 0;

  return {
    totalItems,
    activeItems,
    hasPublishedDirectory: directoryListing?.is_published === true,
    hasHours,
    locationStatus: tenant?.location_status || 'active',
    subscriptionStatus: tenant?.subscription_status || 'active',
  };
}

// ====================
// HELPERS
// ====================

async function resolveTenantId(identifier: string): Promise<string | null> {
  const byId = await prisma.tenants.findUnique({
    where: { id: identifier },
    select: { id: true },
  });
  if (byId) return byId.id;

  const bySlug = await prisma.tenants.findFirst({
    where: { slug: identifier },
    select: { id: true },
  });
  return bySlug?.id ?? null;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function formatIntegrationType(t: string): string {
  const map: Record<string, string> = {
    clover: 'Clover',
    square: 'Square',
    gbp: 'Google Business',
    google_shopping: 'Google Shopping',
    google_merchant_center: 'Google Merchant Center',
    gmc_sync: 'GMC Sync',
    propagation_gbp: 'GBP Propagation',
  };
  return map[t] || capitalize(t.replace(/_/g, ' '));
}
