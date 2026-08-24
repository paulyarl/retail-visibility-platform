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

export interface ApplicableCoupon {
  savedCouponId: string;
  code: string;
  label: string;
  discountCents: number;
  discountType: string;
  expiresAt: string | null;
}

export interface CheckoutResult {
  clientSecret?: string;
  paymentIntentId?: string;
  amountCents: number;
  discountCents: number;
  campaignId: string;
  // Off-session success (no clientSecret needed)
  stage?: string;
  gatewayTransactionId?: string;
  receiptUrl?: string;
}

export interface CheckoutConfirmResult {
  campaignId: string;
  stage: string;
  amountCents: number;
  discountCents: number;
  gatewayTransactionId: string;
}

// ── GBP Management Suite types (Phase 1) ────────────────────────────────

export interface GbpLocationInfo {
  id: string;
  locationName: string;
  businessName: string | null;
  verificationState: string;
  cachedAverageRating: number | null;
  cachedReviewCount: number | null;
  ratingCacheUpdated: string | null;
  address: string | null;
  phone: string | null;
  websiteUrl: string | null;
  category: string | null;
}

export interface GbpStatusResponse {
  tenantId: string;
  connected: boolean;
  location: GbpLocationInfo | null;
}

export interface GbpVerificationOption {
  method: string;
  label: string;
  data?: Record<string, any>;
}

// ── GBP Management Suite types (Phase 2 — Review Intelligence) ──────────

export interface GbpReview {
  id: string;
  tenant_id: string;
  google_review_id: string | null;
  reviewer_name: string | null;
  reviewer_photo_url: string | null;
  star_rating: number | null;
  comment: string | null;
  review_reply: string | null;
  reply_update_time: string | null;
  google_create_time: string | null;
  google_update_time: string | null;
  is_replied: boolean | null;
  location_id: string | null;
  reply_status: string;
  ai_drafts: AiDraft[] | null;
  sentiment: string | null;
}

export interface AiDraft {
  angle: string;
  text: string;
}

export interface GbpReviewsListResponse {
  reviews: GbpReview[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface GbpAiDraftResponse {
  drafts: AiDraft[];
  previewMode: boolean;
  upgradeCta?: string;
}

export interface GbpDisputePayload {
  ownerEmail: string;
  ownerPhone?: string;
  ownerStatement?: string;
  evidencePayload: Record<string, any>;
  attachmentIds?: string[];
}

// ── GBP Management Suite types (Phase 3 — Post Publisher & Media Manager) ─

export interface GbpPost {
  id: string;
  tenant_id: string;
  google_post_id: string | null;
  summary: string;
  topic_type: string | null;
  call_to_action_type: string | null;
  call_to_action_url: string | null;
  media_url: string | null;
  event_title: string | null;
  event_start_date: string | null;
  event_end_date: string | null;
  offer_coupon_code: string | null;
  offer_redeem_url: string | null;
  offer_terms: string | null;
  state: string | null;
  status: string;
  scheduled_for: string | null;
  published_at: string | null;
  post_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface GbpPostsListResponse {
  posts: GbpPost[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreatePostPayload {
  summary: string;
  topicType?: 'STANDARD' | 'EVENT' | 'OFFER';
  callToActionType?: 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL';
  callToActionUrl?: string;
  mediaUrl?: string;
  eventTitle?: string;
  eventStartDate?: string;
  eventEndDate?: string;
  offerCouponCode?: string;
  offerRedeemUrl?: string;
  offerTerms?: string;
  scheduledFor?: string;
}

export interface GbpMediaItem {
  id?: string;
  mediaFormat: string;
  sourceUrl?: string;
  locationAssociation?: { category: string };
  description?: string;
}

export interface GbpMediaListResponse {
  media: GbpMediaItem[];
  benchmark: { expectedPhotoCount: number | null; currentPhotoCount: number } | null;
}

export interface UploadMediaPayload {
  sourceUrl?: string;
  category?: string;
  description?: string;
  file?: File;
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

  // ── Payment methods (§6.3) ────────────────────────────────────────────

  async savePaymentMethodFromIntent(paymentIntentId: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/payment-methods/save-from-payment',
      {
        method: 'POST',
        body: JSON.stringify({ paymentIntentId }),
      },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to save payment method'));
    return result.data?.data ?? result.data;
  }

  // ── Applicable coupons (§7.5) ─────────────────────────────────────────

  async getApplicableCoupons(campaignId: string): Promise<ApplicableCoupon[]> {
    const result = await this.makeDefaultRequest<any>(
      `/api/customer/marketing/coupons/applicable?campaignId=${encodeURIComponent(campaignId)}`,
      {},
      `marketing-portal-coupons-${campaignId}`,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load coupons'));
    return result.data?.data ?? result.data;
  }

  // ── Portal checkout (§7.6) ────────────────────────────────────────────

  async createCheckout(input: {
    campaignId: string;
    couponCode?: string;
    savedCouponId?: string;
    useSavedMethodId?: string;
    billingAddressId?: string;
  }): Promise<CheckoutResult> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/checkout',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to create checkout'));
    return result.data?.data ?? result.data;
  }

  async confirmCheckout(input: {
    campaignId: string;
    paymentIntentId: string;
    couponCode?: string;
    savedCouponId?: string;
    billingAddressId?: string;
  }): Promise<CheckoutConfirmResult> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/checkout/confirm',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to confirm checkout'));
    await this.invalidateServiceCaches();
    return result.data?.data ?? result.data;
  }

  // ── GBP Management Suite (Phase 1) ─────────────────────────────────────

  async getGbpStatus(): Promise<GbpStatusResponse> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/gbp/status',
      {},
      'marketing-portal-gbp-status',
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load GBP status'));
    return result.data?.data ?? result.data;
  }

  async getVerificationOptions(): Promise<GbpVerificationOption[]> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/gbp/verification/options',
      {},
      'marketing-portal-gbp-verification-options',
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to load verification options'));
    return result.data?.data?.options ?? [];
  }

  async startVerification(option: GbpVerificationOption): Promise<{ pending: boolean; verificationId?: string }> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/gbp/verification/start',
      {
        method: 'POST',
        body: JSON.stringify(option),
      },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to start verification'));
    await this.invalidateCache('marketing-portal-gbp-status');
    return result.data?.data ?? result.data;
  }

  async completeVerification(pin: string): Promise<{ verified: boolean; message?: string }> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/gbp/verification/complete',
      {
        method: 'POST',
        body: JSON.stringify({ pin }),
      },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to complete verification'));
    await this.invalidateCache('marketing-portal-gbp-status');
    return result.data?.data ?? result.data;
  }

  // ── GBP Management Suite (Phase 2 — Review Intelligence) ───────────────

  async listReviews(params?: {
    page?: number;
    pageSize?: number;
    rating?: number;
    sentiment?: 'positive' | 'neutral' | 'negative';
    replyStatus?: 'NONE' | 'AI_DRAFTED' | 'PUBLISHED' | 'FAILED' | 'DISPUTED';
  }): Promise<GbpReviewsListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.rating !== undefined) query.set('rating', String(params.rating));
    if (params?.sentiment) query.set('sentiment', params.sentiment);
    if (params?.replyStatus) query.set('replyStatus', params.replyStatus);
    const qs = query.toString();
    const result = await this.makeDefaultRequest<any>(
      `/api/customer/marketing/gbp/reviews${qs ? `?${qs}` : ''}`,
      {},
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to list reviews'));
    return result.data?.data ?? result.data;
  }

  async replyToReview(reviewId: string, comment: string): Promise<{ published: boolean }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/customer/marketing/gbp/reviews/${reviewId}/reply`,
      {
        method: 'POST',
        body: JSON.stringify({ comment }),
      },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to publish reply'));
    await this.invalidateCache('marketing-portal-gbp-reviews');
    return result.data?.data ?? result.data;
  }

  async generateAiDraft(reviewId: string): Promise<GbpAiDraftResponse> {
    const result = await this.makeDefaultRequest<any>(
      `/api/customer/marketing/gbp/reviews/${reviewId}/ai-draft`,
      {
        method: 'POST',
      },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to generate AI drafts'));
    return result.data?.data ?? result.data;
  }

  async disputeReview(reviewId: string, payload: GbpDisputePayload): Promise<{ success: boolean }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/customer/marketing/gbp/reviews/${reviewId}/dispute`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to submit dispute'));
    await this.invalidateCache('marketing-portal-gbp-reviews');
    return result.data?.data ?? result.data;
  }

  // ── GBP Management Suite (Phase 3 — Post Publisher & Media Manager) ─────

  async listPosts(params?: {
    page?: number;
    pageSize?: number;
    status?: 'PUBLISHED' | 'SCHEDULED' | 'FAILED';
    topicType?: 'STANDARD' | 'EVENT' | 'OFFER';
  }): Promise<GbpPostsListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status) query.set('status', params.status);
    if (params?.topicType) query.set('topicType', params.topicType);
    const qs = query.toString();
    const result = await this.makeDefaultRequest<any>(
      `/api/customer/marketing/gbp/posts${qs ? `?${qs}` : ''}`,
      {},
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to list posts'));
    return result.data?.data ?? result.data;
  }

  async createPost(payload: CreatePostPayload): Promise<{ post: GbpPost; scheduled: boolean }> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/gbp/posts',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to create post'));
    await this.invalidateCache('marketing-portal-gbp-posts');
    return result.data?.data ?? result.data;
  }

  async deletePost(postId: string): Promise<{ deleted: boolean }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/customer/marketing/gbp/posts/${postId}`,
      { method: 'DELETE' },
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to delete post'));
    await this.invalidateCache('marketing-portal-gbp-posts');
    return result.data?.data ?? result.data;
  }

  async listMedia(): Promise<GbpMediaListResponse> {
    const result = await this.makeDefaultRequest<any>(
      '/api/customer/marketing/gbp/media',
      {},
      undefined,
      0,
    );
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to list media'));
    return result.data?.data ?? result.data;
  }

  async uploadMedia(payload: UploadMediaPayload): Promise<{ mediaItemId: string; mediaId: string }> {
    let result: any;
    if (payload.file) {
      // Binary upload — multipart
      const formData = new FormData();
      formData.append('file', payload.file);
      if (payload.category) formData.append('category', payload.category);
      if (payload.description) formData.append('description', payload.description);
      result = await this.makeDefaultRequest<any>(
        '/api/customer/marketing/gbp/media/upload',
        {
          method: 'POST',
          body: formData,
        },
        undefined,
        0,
      );
    } else {
      // URL-based upload — JSON
      result = await this.makeDefaultRequest<any>(
        '/api/customer/marketing/gbp/media/upload',
        {
          method: 'POST',
          body: JSON.stringify({
            sourceUrl: payload.sourceUrl,
            category: payload.category,
            description: payload.description,
          }),
        },
        undefined,
        0,
      );
    }
    if (!result.success) throw new Error(this.errMsg(result, 'Failed to upload media'));
    await this.invalidateCache('marketing-portal-gbp-media');
    return result.data?.data ?? result.data;
  }
}

const marketingCustomerService = MarketingCustomerService.getInstance();
export { marketingCustomerService };
export default marketingCustomerService;
