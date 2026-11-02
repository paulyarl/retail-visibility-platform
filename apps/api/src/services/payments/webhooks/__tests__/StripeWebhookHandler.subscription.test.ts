import { describe, it, expect, vi, beforeEach } from 'vitest';

const handlePaymentSuccess = vi.fn();
const handlePaymentFailure = vi.fn();
const handleCancellation = vi.fn();
const getTierPricingByTier = vi.fn();

vi.mock('../../../../prisma', () => ({
  prisma: {
    payments: { findFirst: vi.fn().mockResolvedValue(null) },
    orders: { update: vi.fn() },
    order_status_history: { create: vi.fn() },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('../../../subscription/SubscriptionStatusService', () => ({
  getSubscriptionStatusService: () => ({
    handlePaymentSuccess,
    handlePaymentFailure,
    handleCancellation,
  }),
}));

vi.mock('../../../subscription/SubscriptionBillingService', () => ({
  getSubscriptionBillingService: () => ({ getTierPricingByTier }),
}));

vi.mock('../../../digital-assets/DigitalFulfillmentService', () => ({
  digitalFulfillmentService: {
    hasDigitalProducts: vi.fn().mockResolvedValue(false),
    fulfillOrder: vi.fn(),
  },
}));

vi.mock('../../../RealtimeService', () => ({
  realtimeService: { handlePaymentSuccess: vi.fn() },
}));

vi.mock('../../../../logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { StripeWebhookHandler } from '../StripeWebhookHandler';

const evt = (type: string, object: any) =>
  ({ id: `evt_test_${type}`, type, data: { object } }) as any;

describe('StripeWebhookHandler — subscription lifecycle (merged from routes/stripe-webhook.ts)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('payment_intent.succeeded with tenant metadata activates the subscription', async () => {
    getTierPricingByTier.mockResolvedValue({ monthlyPriceCents: 3900, annualPriceCents: 39000 });
    await StripeWebhookHandler.handleEvent(evt('payment_intent.succeeded', {
      id: 'pi_1', metadata: { tenantId: 't1', tier: 'presence', billingCycle: 'monthly' },
    }));
    expect(handlePaymentSuccess).toHaveBeenCalledWith('t1', 'presence', 'pi_1', 3900);
  });

  it('payment_intent.succeeded without tenant metadata does NOT touch subscription services', async () => {
    await StripeWebhookHandler.handleEvent(evt('payment_intent.succeeded', { id: 'pi_2', metadata: {} }));
    expect(handlePaymentSuccess).not.toHaveBeenCalled();
  });

  it('payment_intent.payment_failed with tenant metadata marks the subscription failed', async () => {
    await StripeWebhookHandler.handleEvent(evt('payment_intent.payment_failed', {
      id: 'pi_3', metadata: { tenantId: 't2' }, last_payment_error: { code: 'card_declined' },
    }));
    expect(handlePaymentFailure).toHaveBeenCalledWith('t2', 'card_declined');
  });

  it('invoice.payment_succeeded resolves tenant from metadata and records payment', async () => {
    await StripeWebhookHandler.handleEvent(evt('invoice.payment_succeeded', {
      id: 'in_1', metadata: { tenantId: 't3', tier: 'storefront' }, amount_paid: 5900, customer: 'cus_x',
    }));
    expect(handlePaymentSuccess).toHaveBeenCalledWith('t3', 'storefront', 'in_1', 5900);
  });

  it('invoice.payment_failed marks failure with attempt count', async () => {
    await StripeWebhookHandler.handleEvent(evt('invoice.payment_failed', {
      id: 'in_2', metadata: { tenantId: 't4' }, attempt_count: 3, customer: 'cus_y',
    }));
    expect(handlePaymentFailure).toHaveBeenCalledWith('t4', 'invoice_payment_failed', 3);
  });

  it('customer.subscription.deleted cancels the tenant subscription', async () => {
    await StripeWebhookHandler.handleEvent(evt('customer.subscription.deleted', {
      id: 'sub_1', metadata: { tenantId: 't5' }, customer: 'cus_z',
    }));
    expect(handleCancellation).toHaveBeenCalledWith('t5', 'stripe_subscription_deleted');
  });

  it('unidentified subscription events are skipped quietly (no crash, no calls)', async () => {
    await StripeWebhookHandler.handleEvent(evt('customer.subscription.deleted', {
      id: 'sub_2', metadata: {}, customer: null,
    }));
    expect(handleCancellation).not.toHaveBeenCalled();
  });
});
