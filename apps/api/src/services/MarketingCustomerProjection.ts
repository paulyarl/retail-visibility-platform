/**
 * MarketingCustomerProjection — customer-safe campaign projection (§6.4)
 * and customer-facing status mapper (§7.3).
 *
 * The portal NEVER returns raw mkt_campaigns_list. This module whitelists
 * fields and maps internal stages to customer-legible statuses.
 */

import { prisma } from '../prisma';
import MarketingServiceCategoryService from './MarketingServiceCategoryService';
import { PLATFORM_SCOPE } from '../lib/platform-scope';
import type { RequestCtx } from '../context';

// ── Customer-facing status model (§7.3) ────────────────────────────────

export type CustomerCampaignStatus =
  | 'payment_received'
  | 'in_production'
  | 'delivered'
  | 'active_plan'
  | 'completed';

export interface CustomerStatusInfo {
  status: CustomerCampaignStatus;
  label: string;
}

/**
 * Map an internal campaign stage to a customer-legible status (§7.3).
 *
 * | Customer status     | Label                | Maps from (internal stages) |
 * |---------------------|----------------------|------------------------------|
 * | payment_received    | "Payment received"   | paid, intake_submitted       |
 * | in_production       | "We're working on it"| paid → before delivered      |
 * | delivered           | "Delivered"          | delivered, resolved_and_closed |
 * | active_plan         | "Active service plan"| retainer_won, subscription active |
 * | completed           | "Completed"          | terminal states post-delivery |
 * | — (no exposure)     | —                    | seek, preview_built, shown, lost, dead, cascade |
 */
export function mapCustomerStatus(
  stage: string,
  hasActiveSubscription: boolean = false,
): CustomerStatusInfo | null {
  // Hidden stages — never exposed to the customer
  const hiddenStages = ['seek', 'preview_built', 'shown', 'lost', 'dead'];
  if (hiddenStages.includes(stage)) return null;

  // Active subscription/retainer takes priority
  if (hasActiveSubscription || stage === 'retainer_won') {
    return { status: 'active_plan', label: 'Active service plan' };
  }

  // Delivered / resolved
  if (stage === 'delivered' || stage === 'resolved_and_closed') {
    return { status: 'delivered', label: 'Delivered' };
  }

  // Post-delivery terminal states
  if (stage === 'completed' || stage === 'closed') {
    return { status: 'completed', label: 'Completed' };
  }

  // Payment received (includes recovery intake_submitted pre-draft)
  if (stage === 'paid' || stage === 'intake_submitted') {
    return { status: 'payment_received', label: 'Payment received' };
  }

  // In production: paid but not yet delivered
  if (stage === 'in_production' || stage === 'final_resolution_drafted') {
    return { status: 'in_production', label: "We're working on it" };
  }

  // Fallback: if the campaign has a paid date but stage is unknown, show in production
  return { status: 'in_production', label: "We're working on it" };
}

// ── Customer-safe campaign projection (§6.4) ───────────────────────────

export interface CustomerCampaignProjection {
  id: string;
  displayId: string;
  businessName: string;
  city: string;
  category: string;
  serviceCategory: string | null;
  serviceCategoryLabel: string;
  status: CustomerStatusInfo;
  datePaid: Date | null;
  dateDelivered: Date | null;
  websiteUrl: string | null;
  deliverables: CustomerDeliverableProjection[];
  receipts: CustomerReceiptProjection[];
}

export interface CustomerDeliverableProjection {
  id: string;
  title: string;
  type: string;
  downloadUrl: string | null;
  deliveredAt: Date | null;
}

export interface CustomerReceiptProjection {
  id: string;
  revenueId: string;
  amountCents: number;
  discountCents: number;
  date: Date;
  receiptUrl: string;
  serviceCategoryLabel: string;
  businessName: string;
}

/**
 * Project a raw campaign (with relations) into a customer-safe DTO (§6.4).
 *
 * Hidden: notes, pain_score, estimated_*, pain points, prompt data,
 * assigned_to, created_by, hot-prospect flags, cascade config, audit caches,
 * contact-enrichment internals, cost/tokens, retainer pitch internals.
 */
export async function projectCampaign(
  campaign: any,
  ctx?: RequestCtx,
): Promise<CustomerCampaignProjection | null> {
  const statusInfo = mapCustomerStatus(campaign.stage, false);
  if (!statusInfo) return null; // hidden stage — don't expose

  const serviceCategoryLabel = await MarketingServiceCategoryService.getLabel(
    campaign.service_category || '',
    ctx,
  );

  // Project deliverables (paid only, no preview/watermarked)
  const deliverables: CustomerDeliverableProjection[] = [];
  if (campaign.mkt_deliverables_list) {
    for (const d of campaign.mkt_deliverables_list) {
      // Only show delivered or paid deliverables
      if (d.delivery_status === 'delivered' || campaign.stage === 'delivered' || campaign.stage === 'paid') {
        deliverables.push({
          id: d.id,
          title: d.title || `${serviceCategoryLabel} deliverable`,
          type: d.type || 'document',
          downloadUrl: d.file_url || null,
          deliveredAt: d.delivered_at || null,
        });
      }
    }
  }

  // Project receipts (marketing_revenue rows)
  const receipts: CustomerReceiptProjection[] = [];
  if (campaign.marketing_revenue) {
    for (const r of campaign.marketing_revenue) {
      receipts.push({
        id: r.id,
        revenueId: r.id,
        amountCents: r.amount_cents || 0,
        discountCents: r.discount_cents || 0,
        date: r.created_at,
        receiptUrl: `/api/customer/marketing/receipts/${r.id}/pdf`,
        serviceCategoryLabel,
        businessName: campaign.business_name || '',
      });
    }
  }

  return {
    id: campaign.id,
    displayId: campaign.display_id || campaign.id,
    businessName: campaign.business_name || '',
    city: campaign.city || '',
    category: campaign.category || '',
    serviceCategory: campaign.service_category || null,
    serviceCategoryLabel,
    status: statusInfo,
    datePaid: campaign.date_paid || null,
    dateDelivered: campaign.date_delivered || null,
    websiteUrl: campaign.website_url || null,
    deliverables,
    receipts,
  };
}

/**
 * Project a list of campaigns into customer-safe DTOs.
 */
export async function projectCampaigns(
  campaigns: any[],
  ctx?: RequestCtx,
): Promise<CustomerCampaignProjection[]> {
  const results: CustomerCampaignProjection[] = [];
  for (const c of campaigns) {
    const projected = await projectCampaign(c, ctx);
    if (projected) results.push(projected);
  }
  return results;
}

// ── Portal overview DTO (§7.2) ──────────────────────────────────────────

export interface CustomerPortalOverview {
  totalSpentCents: number;
  activeEngagements: number;
  deliverablesReady: number;
  campaigns: CustomerCampaignProjection[];
  recentPurchases: CustomerReceiptProjection[];
}

/**
 * Build the portal overview for a customer (§7.2).
 * Fetches all claimed campaigns + revenue and projects them.
 */
export async function buildPortalOverview(
  customerId: string,
  ctx?: RequestCtx,
): Promise<CustomerPortalOverview> {
  const campaigns = await prisma.mkt_campaigns_list.findMany({
    where: { customer_id: customerId },
    include: {
      mkt_deliverables_list: true,
      marketing_revenue: {
        orderBy: { created_at: 'desc' },
      },
    },
    orderBy: { date_paid: 'desc' },
  });

  const projected = await projectCampaigns(campaigns, ctx);

  const totalSpentCents = projected.reduce(
    (sum, c) => sum + c.receipts.reduce((s, r) => s + r.amountCents, 0),
    0,
  );

  const activeEngagements = projected.filter(
    (c) =>
      c.status.status === 'in_production' ||
      c.status.status === 'payment_received' ||
      c.status.status === 'active_plan',
  ).length;

  const deliverablesReady = projected.reduce(
    (sum, c) => sum + c.deliverables.filter((d) => d.downloadUrl).length,
    0,
  );

  const recentPurchases = projected
    .flatMap((c) => c.receipts)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10);

  return {
    totalSpentCents,
    activeEngagements,
    deliverablesReady,
    campaigns: projected,
    recentPurchases,
  };
}

// ── Receipt view model (§6.5, §7.4) ─────────────────────────────────────

export interface ReceiptViewModel {
  revenueId: string;
  campaignId: string;
  businessName: string;
  city: string;
  serviceCategoryLabel: string;
  amountCents: number;
  discountCents: number;
  totalCents: number;
  date: Date;
  customerName: string | null;
  customerEmail: string | null;
  billingAddress: string | null;
  // QR destination (§7.4 priority: customer branding asset_url → campaign website_url → null)
  qrDestinationUrl: string | null;
  qrLogoUrl: string | null;
  qrBrandColor: string | null;
}

/**
 * Build a receipt view model for a specific revenue row (§6.5, §7.4).
 * Resolves QR destination + branding from the customer's branding row
 * (falling back to the campaign's website_url).
 */
export async function buildReceiptViewModel(
  revenueId: string,
  customerId: string,
  ctx?: RequestCtx,
): Promise<ReceiptViewModel | null> {
  const revenue = await prisma.marketing_revenue.findUnique({
    where: { id: revenueId },
    include: {
      mkt_campaigns_list: true,
    },
  });

  if (!revenue || revenue.customer_id !== customerId) return null;

  const campaign = revenue.mkt_campaigns_list;
  if (!campaign) return null;

  const serviceCategoryLabel = await MarketingServiceCategoryService.getLabel(
    campaign.service_category || '',
    ctx,
  );

  // Resolve branding (per-customer, not per-campaign — §7.4)
  const branding = await prisma.mkt_customer_branding.findUnique({
    where: { customer_id: customerId },
  });

  // QR destination priority (§7.4): customer asset_url → campaign website_url → null
  const qrDestinationUrl =
    branding?.asset_url || campaign.website_url || null;
  const qrLogoUrl = branding?.logo_url || null;
  const qrBrandColor = branding?.brand_color || null;

  // Resolve customer name/email
  const customer = await prisma.customers.findUnique({
    where: { id: customerId },
    select: { first_name: true, last_name: true, email: true },
  });

  // Resolve default billing address
  const billingAddress = await prisma.customer_addresses.findFirst({
    where: { customer_id: customerId, is_billing: true, is_default: true },
  });
  const billingAddressStr = billingAddress
    ? [billingAddress.address_line1, billingAddress.city, billingAddress.state, billingAddress.postal_code]
        .filter(Boolean)
        .join(', ')
    : null;

  const totalCents = revenue.amount_cents || 0;
  const discountCents = revenue.discount_cents || 0;

  return {
    revenueId: revenue.id,
    campaignId: campaign.id,
    businessName: campaign.business_name || '',
    city: campaign.city || '',
    serviceCategoryLabel,
    amountCents: totalCents + discountCents,
    discountCents,
    totalCents,
    date: revenue.created_at,
    customerName: customer
      ? [customer.first_name, customer.last_name].filter(Boolean).join(' ')
      : null,
    customerEmail: customer?.email || null,
    billingAddress: billingAddressStr,
    qrDestinationUrl,
    qrLogoUrl,
    qrBrandColor,
  };
}
