/**
 * MarketingCustomerService — frontend service for the Marketing Ops Customer
 * Portal (§7.2). Extends CustomerApiSingleton (authenticated, customer JWT).
 *
 * Wraps the /api/customer/marketing/* endpoints (§6.2):
 *   - GET  /overview
 *   - GET  /campaigns
 *   - GET  /campaigns/:id
 *   - GET  /purchases
 *   - GET  /receipts/:revenueId
 *   - GET  /receipts/:revenueId/pdf (direct URL, not via service)
 *   - GET  /branding
 *   - PUT  /branding
 *   - GET  /support/tickets
 *   - POST /support/tickets
 *   - GET  /support/tickets/:id
 *   - POST /support/tickets/:id/messages
 *   - GET  /alerts
 *   - GET  /alerts/unread-count
 *   - POST /alerts/:id/read
 *   - POST /alerts/:id/dismiss
 *   - POST /alerts/mark-all-read
 */
import { CustomerApiSingleton } from '../providers/base/CustomerApiSingleton';

// ── Types matching the backend projection (§6.4, §7.3) ──────────────────

export interface CustomerStatusInfo {
  status: 'payment_received' | 'in_production' | 'delivered' | 'active_plan' | 'completed';
  label: string;
}

export interface CustomerDeliverableProjection {
  id: string;
  title: string;
  type: string;
  downloadUrl: string | null;
  deliveredAt: string | null;
}

export interface CustomerReceiptProjection {
  id: string;
  revenueId: string;
  amountCents: number;
  discountCents: number;
  date: string;
  receiptUrl: string;
  serviceCategoryLabel: string;
  businessName: string;
}

export interface CustomerCampaignProjection {
  id: string;
  displayId: string;
  businessName: string;
  city: string;
  category: string;
  serviceCategory: string | null;
  serviceCategoryLabel: string;
  status: CustomerStatusInfo;
  datePaid: string | null;
  dateDelivered: string | null;
  websiteUrl: string | null;
  deliverables: CustomerDeliverableProjection[];
  receipts: CustomerReceiptProjection[];
}

export interface CustomerPortalOverview {
  totalSpentCents: number;
  activeEngagements: number;
  deliverablesReady: number;
  campaigns: CustomerCampaignProjection[];
  recentPurchases: CustomerReceiptProjection[];
}

export interface PurchaseRow {
  id: string;
  revenueId: string;
  campaignId: string;
  businessName: string;
  serviceCategory: string | null;
  amountCents: number;
  discountCents: number;
  date: string;
  receiptUrl: string;
  receiptViewUrl: string;
}

export interface ReceiptViewModel {
  revenueId: string;
  campaignId: string;
  businessName: string;
  city: string;
  serviceCategoryLabel: string;
  amountCents: number;
  discountCents: number;
  totalCents: number;
  date: string;
  customerName: string | null;
  customerEmail: string | null;
  billingAddress: string | null;
  qrDestinationUrl: string | null;
  qrLogoUrl: string | null;
  qrBrandColor: string | null;
}

export interface CustomerBranding {
  logoUrl: string | null;
  assetUrl: string | null;
  brandColor: string | null;
}

export interface SupportTicket {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  category: string | null;
  campaign_id: string | null;
  created_at: string | null;
  crm_ticket_messages?: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  content: string;
  author_type: string;
  author_name: string;
  is_internal: boolean | null;
  created_at: string | null;
}

export interface CustomerAlert {
  id: string;
  type: string;
  title: string;
  body: string | null;
  icon: string | null;
  createdAt: string | null;
  isRead: boolean;
  isDismissed: boolean;
}

// ── Service ─────────────────────────────────────────────────────────────

class MarketingCustomerService extends CustomerApiSingleton {
  private static instance: MarketingCustomerService;

  private constructor() {
    super('marketing-customer-service', { ttl: 5 * 60 * 1000 });
  }

  static getInstance(): MarketingCustomerService {
    if (!MarketingCustomerService.instance) {
      MarketingCustomerService.instance = new MarketingCustomerService();
    }
    return MarketingCustomerService.instance;
  }

  getServiceCachePatterns(): string[] {
    return [
      'marketing-portal-overview',
      'marketing-portal-campaigns',
      'marketing-portal-purchases',
      'marketing-portal-branding',
      'marketing-portal-alerts',
      'marketing-portal-tickets',
    ];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  /**
   * Normalize the polymorphic `error` field from makeDefaultRequest into a string.
   * The base class types error as `string | { status, message, code }`.
   */
  private errMsg(result: any, fallback: string): string {
    if (!result.error) return fallback;
    if (typeof result.error === 'string') return result.error;
    if (result.error?.message) return result.error.message;
    return fallback;
  }

  // ── Overview (§7.2) ───────────────────────────────────────────────────

  async getOverview(): Promise<CustomerPortalOverview> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/overview',
      {},
      'marketing-portal-overview',
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load overview'));
    return result.data?.data ?? result.data;
  }

  // ── Campaigns (§7.2) ──────────────────────────────────────────────────

  async getCampaigns(): Promise<CustomerCampaignProjection[]> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/campaigns',
      {},
      'marketing-portal-campaigns',
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load campaigns'));
    return result.data?.data ?? result.data;
  }

  async getCampaign(id: string): Promise<CustomerCampaignProjection> {
    const result = await this.makeDefaultRequest<any>(
      `/api/customer/marketing/campaigns/${encodeURIComponent(id)}`,
      {},
      `marketing-portal-campaign-${id}`,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load campaign'));
    return result.data?.data ?? result.data;
  }

  // ── Purchases (§7.2) ──────────────────────────────────────────────────

  async getPurchases(): Promise<PurchaseRow[]> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/purchases',
      {},
      'marketing-portal-purchases',
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load purchases'));
    return result.data?.data ?? result.data;
  }

  // ── Receipts (§6.5, §7.4) ─────────────────────────────────────────────

  async getReceipt(revenueId: string): Promise<ReceiptViewModel> {
    const result = await this.makeDefaultRequest<any>(
      `/api/customer/marketing/receipts/${encodeURIComponent(revenueId)}`,
      {},
      `marketing-portal-receipt-${revenueId}`,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load receipt'));
    return result.data?.data ?? result.data;
  }

  getReceiptPdfUrl(revenueId: string): string {
    return `/api/customer/marketing/receipts/${encodeURIComponent(revenueId)}/pdf`;
  }

  // ── Branding (§7.4) ───────────────────────────────────────────────────

  async getBranding(): Promise<CustomerBranding> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/branding',
      {},
      'marketing-portal-branding',
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load branding'));
    return result.data?.data ?? result.data;
  }

  async updateBranding(input: Partial<CustomerBranding>): Promise<CustomerBranding> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/branding',
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to update branding'));
    await this.invalidateCache('marketing-portal-branding');
    return result.data?.data ?? result.data;
  }

  // ── Support tickets (§7.7) ────────────────────────────────────────────

  async getTickets(): Promise<SupportTicket[]> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/support/tickets',
      {},
      'marketing-portal-tickets',
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load tickets'));
    return result.data?.data ?? result.data;
  }

  async getTicket(id: string): Promise<SupportTicket> {
    const result = await this.makeDefaultRequest<any>(
      `/api/customer/marketing/support/tickets/${encodeURIComponent(id)}`,
      {},
      `marketing-portal-ticket-${id}`,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load ticket'));
    return result.data?.data ?? result.data;
  }

  async createTicket(input: {
    title: string;
    description?: string;
    category?: string;
    campaignId?: string;
  }): Promise<SupportTicket> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/support/tickets',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to create ticket'));
    await this.invalidateCache('marketing-portal-tickets');
    return result.data?.data ?? result.data;
  }

  async replyToTicket(ticketId: string, message: string): Promise<TicketMessage> {
    const result = await this.makeDefaultRequest<any>(
      `/api/customer/marketing/support/tickets/${encodeURIComponent(ticketId)}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ message }),
      },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to reply'));
    await this.invalidateCache(`marketing-portal-ticket-${ticketId}`);
    return result.data?.data ?? result.data;
  }

  // ── Alerts (§7.9) ─────────────────────────────────────────────────────

  async getAlerts(): Promise<CustomerAlert[]> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/alerts',
      {},
      'marketing-portal-alerts',
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load alerts'));
    return result.data?.data ?? result.data;
  }

  async getUnreadAlertCount(): Promise<number> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/alerts/unread-count',
      {},
      'marketing-portal-alert-count',
    );
    if (!result.success) return 0;
    return result.data?.data?.count ?? 0;
  }

  async markAlertRead(alertId: string): Promise<void> {
    await this.makeDefaultRequest<any>(
      `/api/customer/marketing/alerts/${encodeURIComponent(alertId)}/read`,
      { method: 'POST' },
      undefined,
      0,
    );
    await this.invalidateCache('marketing-portal-alerts');
    await this.invalidateCache('marketing-portal-alert-count');
  }

  async dismissAlert(alertId: string): Promise<void> {
    await this.makeDefaultRequest<any>(
      `/api/customer/marketing/alerts/${encodeURIComponent(alertId)}/dismiss`,
      { method: 'POST' },
      undefined,
      0,
    );
    await this.invalidateCache('marketing-portal-alerts');
    await this.invalidateCache('marketing-portal-alert-count');
  }

  async markAllAlertsRead(): Promise<void> {
    await this.makeDefaultRequest<any>(
      '/api/customer/marketing/alerts/mark-all-read',
      { method: 'POST' },
      undefined,
      0,
    );
    await this.invalidateCache('marketing-portal-alerts');
    await this.invalidateCache('marketing-portal-alert-count');
  }
}

const marketingCustomerService = MarketingCustomerService.getInstance();
export { marketingCustomerService };
export default marketingCustomerService;
