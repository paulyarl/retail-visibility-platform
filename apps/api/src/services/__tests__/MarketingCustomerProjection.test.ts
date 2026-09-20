/**
 * MarketingCustomerProjection tests (§6.4, §7.3)
 *
 * Verifies:
 * - Every internal stage maps to a customer status or is hidden (§11 acceptance)
 * - Hidden stages return null (never exposed)
 * - projectCampaign whitelists fields (no notes, pain_score, estimated_*, etc.)
 * - projectCampaigns filters out hidden-stage campaigns
 * - Active subscription takes priority over stage
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: { findMany: vi.fn() },
    marketing_revenue: { findMany: vi.fn() },
  },
}));

vi.mock('../MarketingServiceCategoryService', () => ({
  default: {
    getLabel: vi.fn().mockResolvedValue('Review Management'),
  },
}));

import {
  mapCustomerStatus,
  projectCampaign,
  projectCampaigns,
  groupCampaignsByProspect,
} from '../MarketingCustomerProjection';

// ── Status mapper (§7.3) ────────────────────────────────────────────────

describe('mapCustomerStatus', () => {
  it('maps paid → payment_received', () => {
    const result = mapCustomerStatus('paid');
    expect(result).toEqual({ status: 'payment_received', label: 'Payment received' });
  });

  it('maps intake_submitted → payment_received', () => {
    const result = mapCustomerStatus('intake_submitted');
    expect(result).toEqual({ status: 'payment_received', label: 'Payment received' });
  });

  it('maps in_production → in_production', () => {
    const result = mapCustomerStatus('in_production');
    expect(result).toEqual({ status: 'in_production', label: "We're working on it" });
  });

  it('maps final_resolution_drafted → in_production', () => {
    const result = mapCustomerStatus('final_resolution_drafted');
    expect(result).toEqual({ status: 'in_production', label: "We're working on it" });
  });

  it('maps delivered → delivered', () => {
    const result = mapCustomerStatus('delivered');
    expect(result).toEqual({ status: 'delivered', label: 'Delivered' });
  });

  it('maps resolved_and_closed → delivered', () => {
    const result = mapCustomerStatus('resolved_and_closed');
    expect(result).toEqual({ status: 'delivered', label: 'Delivered' });
  });

  it('maps retainer_won → active_plan', () => {
    const result = mapCustomerStatus('retainer_won');
    expect(result).toEqual({ status: 'active_plan', label: 'Active service plan' });
  });

  it('maps completed → completed', () => {
    const result = mapCustomerStatus('completed');
    expect(result).toEqual({ status: 'completed', label: 'Completed' });
  });

  it('maps closed → completed', () => {
    const result = mapCustomerStatus('closed');
    expect(result).toEqual({ status: 'completed', label: 'Completed' });
  });

  it('active subscription overrides stage', () => {
    const result = mapCustomerStatus('delivered', true);
    expect(result).toEqual({ status: 'active_plan', label: 'Active service plan' });
  });

  // Hidden stages — never exposed to the customer
  it.each(['seek', 'seed', 'preview_built', 'shown', 'lost', 'dead'])(
    'hides stage "%s" (returns null)',
    (stage) => {
      expect(mapCustomerStatus(stage)).toBeNull();
    },
  );

  it('falls back to in_production for unknown stage', () => {
    const result = mapCustomerStatus('some_unknown_stage');
    expect(result).toEqual({ status: 'in_production', label: "We're working on it" });
  });
});

// ── Campaign projection (§6.4) ──────────────────────────────────────────

describe('projectCampaign', () => {
  const baseCampaign = {
    id: 'mkt-001',
    display_id: 'MKT-001',
    business_name: 'Test Biz',
    city: 'Austin',
    category: 'review_management',
    service_category: 'review_management',
    stage: 'paid',
    date_paid: new Date('2026-01-15'),
    date_delivered: null,
    website_url: 'https://example.com',
    notes: 'internal notes',
    pain_score: 8,
    estimated_value_cents: 50000,
    assigned_to: 'agent-001',
    created_by: 'system',
    mkt_deliverables_list: [],
    marketing_revenue: [],
  };

  it('projects a paid campaign with correct fields', async () => {
    const result = await projectCampaign(baseCampaign);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('mkt-001');
    expect(result!.displayId).toBe('MKT-001');
    expect(result!.businessName).toBe('Test Biz');
    expect(result!.city).toBe('Austin');
    expect(result!.serviceCategoryLabel).toBe('Review Management');
    expect(result!.status.status).toBe('payment_received');
    expect(result!.datePaid).toEqual(new Date('2026-01-15'));
    expect(result!.dateDelivered).toBeNull();
    expect(result!.websiteUrl).toBe('https://example.com');
  });

  it('does NOT expose internal fields', async () => {
    const result = await projectCampaign(baseCampaign);
    expect(result).not.toBeNull();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('notes');
    expect(serialized).not.toContain('pain_score');
    expect(serialized).not.toContain('estimated_value');
    expect(serialized).not.toContain('assigned_to');
    expect(serialized).not.toContain('created_by');
  });

  it('returns null for hidden stages', async () => {
    const result = await projectCampaign({ ...baseCampaign, stage: 'seek' });
    expect(result).toBeNull();
  });

  it('projects deliverables for paid campaigns', async () => {
    const campaign = {
      ...baseCampaign,
      stage: 'delivered',
      mkt_deliverables_list: [
        { id: 'del-1', title: 'Report', deliverable_type: 'audit_report', mime_type: 'application/pdf', storage_path: 'deliverables/d1.pdf', delivered_at: new Date('2026-02-01'), delivery_status: 'delivered' },
        { id: 'del-2', title: 'Preview', deliverable_type: 'audit_report', mime_type: 'application/json', storage_path: 'deliverables/d2.json', delivered_at: null, delivery_status: 'preview' },
      ],
    };
    const result = await projectCampaign(campaign);
    expect(result!.deliverables).toHaveLength(2); // both shown because stage=delivered
    expect(result!.deliverables[0].title).toBe('Report');
    // PDF with storage_path → authenticated download route (W6d)
    expect(result!.deliverables[0].downloadUrl).toBe('/api/customer/marketing/deliverables/del-1/download');
    // JSON import row → no customer download link
    expect(result!.deliverables[1].downloadUrl).toBeNull();
  });

  it('projects receipts from marketing_revenue', async () => {
    const campaign = {
      ...baseCampaign,
      marketing_revenue: [
        { id: 'rev-001', amount_cents: 15000, discount_cents: 5000, created_at: new Date('2026-01-15') },
      ],
    };
    const result = await projectCampaign(campaign);
    expect(result!.receipts).toHaveLength(1);
    expect(result!.receipts[0].revenueId).toBe('rev-001');
    expect(result!.receipts[0].amountCents).toBe(15000);
    expect(result!.receipts[0].discountCents).toBe(5000);
    expect(result!.receipts[0].receiptUrl).toBe('/api/customer/marketing/receipts/rev-001/pdf');
  });

  it('handles null business_name', async () => {
    const result = await projectCampaign({ ...baseCampaign, business_name: null });
    expect(result!.businessName).toBe('');
  });
});

// ── projectCampaigns (list projection) ──────────────────────────────────

describe('projectCampaigns', () => {
  it('filters out hidden-stage campaigns', async () => {
    const campaigns = [
      { id: 'c1', stage: 'paid', business_name: 'Biz 1', service_category: 'review_management', mkt_deliverables_list: [], marketing_revenue: [] },
      { id: 'c2', stage: 'seek', business_name: 'Biz 2', service_category: 'review_management', mkt_deliverables_list: [], marketing_revenue: [] },
      { id: 'c3', stage: 'delivered', business_name: 'Biz 3', service_category: 'review_management', mkt_deliverables_list: [], marketing_revenue: [] },
    ];
    const results = await projectCampaigns(campaigns);
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('c1');
    expect(results[1].id).toBe('c3');
  });

  it('returns empty array for all-hidden campaigns', async () => {
    const campaigns = [
      { id: 'c1', stage: 'shown', business_name: 'Biz 1', service_category: 'review_management', mkt_deliverables_list: [], marketing_revenue: [] },
      { id: 'c2', stage: 'lost', business_name: 'Biz 2', service_category: 'review_management', mkt_deliverables_list: [], marketing_revenue: [] },
    ];
    const results = await projectCampaigns(campaigns);
    expect(results).toHaveLength(0);
  });
});

// ── Repair progress projection (PROFILE_REPAIR_CUSTOMER_PROGRESS_SPEC) ──

describe('projectCampaign — repair progress', () => {
  const repairCampaign = {
    id: 'mkt-r1',
    display_id: 'MKT-R1',
    business_name: 'Repair Biz',
    city: 'Kansas City',
    category: 'profile_repair',
    service_category: 'profile_repair',
    stage: 'delivered',
    date_paid: new Date('2026-01-15'),
    date_delivered: new Date('2026-01-20'),
    website_url: null,
    mkt_deliverables_list: [],
    marketing_revenue: [],
    mkt_dispute_intake: [],
    repair_fulfillment: {
      tier: 'standard',
      mode: 'dfy',
      sla_hours: 48,
      sla_due_at: '2026-01-22T00:00:00Z',
      platforms: ['google', 'facebook'],
      platform_status: {
        google: { status: 'verified', verified_at: '2026-01-19T00:00:00Z', note: 'NAP corrected' },
        facebook: { status: 'awaiting_access' },
      },
    },
  };

  it('returns null repair when repair_fulfillment is absent', async () => {
    const result = await projectCampaign({
      ...repairCampaign,
      repair_fulfillment: null,
    });
    expect(result!.repair).toBeNull();
  });

  it('returns null repair when no tier is configured', async () => {
    const result = await projectCampaign({
      ...repairCampaign,
      repair_fulfillment: { mode: 'dfy', platforms: ['google'] },
    });
    expect(result!.repair).toBeNull();
  });

  it('projects tier, mode, SLA, and customer-legible platform statuses', async () => {
    const result = await projectCampaign(repairCampaign);
    const repair = result!.repair!;
    expect(repair.tierLabel).toBe('Standard');
    expect(repair.mode).toBe('dfy');
    expect(repair.modeLabel).toBe('We apply the fixes');
    expect(repair.slaHours).toBe(48);
    expect(repair.platforms).toHaveLength(2);
    expect(repair.platforms[0]).toMatchObject({
      platform: 'google',
      label: 'Google Business Profile',
      status: 'verified',
      statusLabel: 'Verified',
      needsCustomerAction: false,
      note: 'NAP corrected',
    });
    expect(repair.platforms[1]).toMatchObject({
      platform: 'facebook',
      status: 'awaiting_access',
      statusLabel: 'Waiting for account access',
      needsCustomerAction: true, // dfy
    });
  });

  it('flags customer_pending as customer action in DIY only', async () => {
    const diy = await projectCampaign({
      ...repairCampaign,
      repair_fulfillment: {
        tier: 'standard',
        mode: 'diy',
        platforms: ['google'],
        platform_status: { google: { status: 'customer_pending' } },
      },
    });
    expect(diy!.repair!.platforms[0].needsCustomerAction).toBe(true);
    expect(diy!.repair!.platforms[0].statusLabel).toBe('Action needed from you');

    const dfy = await projectCampaign({
      ...repairCampaign,
      repair_fulfillment: {
        tier: 'standard',
        mode: 'dfy',
        platforms: ['google'],
        platform_status: { google: { status: 'customer_pending' } },
      },
    });
    expect(dfy!.repair!.platforms[0].needsCustomerAction).toBe(false);
  });

  it('does not expose escalated_campaign_id or access_token', async () => {
    const result = await projectCampaign({
      ...repairCampaign,
      mkt_dispute_intake: [
        {
          intake_kind: 'profile_repair_access',
          short_code: 'abc12345',
          submitted_at: null,
          viewed_at: null,
          viewed_count: 0,
          expires_at: new Date(Date.now() + 86400000),
          access_token: 'secret-token-value',
        },
      ],
      repair_fulfillment: {
        tier: 'standard',
        mode: 'dfy',
        platforms: ['google'],
        platform_status: {
          google: { status: 'escalated', escalated_campaign_id: 'mkt-sibling-9' },
        },
      },
    });
    const serialized = JSON.stringify(result!.repair);
    expect(serialized).not.toContain('mkt-sibling-9');
    expect(serialized).not.toContain('secret-token-value');
    expect(result!.repair!.platforms[0].statusLabel).toBe('Escalated for specialist review');
  });

  it('derives accessForm states for DFY', async () => {
    const mk = (intake: any) =>
      projectCampaign({
        ...repairCampaign,
        mkt_dispute_intake: intake ? [{ intake_kind: 'profile_repair_access', ...intake }] : [],
      });

    // sent — exists but never opened
    const sent = await mk({ short_code: 'abc12345', submitted_at: null, viewed_count: 0, viewed_at: null, expires_at: new Date(Date.now() + 86400000) });
    expect(sent!.repair!.accessForm).toEqual({ state: 'sent', url: '/i/abc12345' });

    // opened
    const opened = await mk({ short_code: 'abc12345', submitted_at: null, viewed_count: 2, viewed_at: new Date(), expires_at: new Date(Date.now() + 86400000) });
    expect(opened!.repair!.accessForm!.state).toBe('opened');

    // submitted — url hidden
    const submitted = await mk({ short_code: 'abc12345', submitted_at: new Date(), viewed_count: 3, expires_at: new Date(Date.now() + 86400000) });
    expect(submitted!.repair!.accessForm).toEqual({ state: 'submitted', url: null });

    // expired
    const expired = await mk({ short_code: 'abc12345', submitted_at: null, viewed_count: 0, expires_at: new Date(Date.now() - 86400000) });
    expect(expired!.repair!.accessForm!.state).toBe('expired');

    // no intake row yet — still DFY → accessForm null
    const none = await mk(null);
    expect(none!.repair!.accessForm).toBeNull();
  });

  it('has no accessForm in DIY mode', async () => {
    const result = await projectCampaign({
      ...repairCampaign,
      mkt_dispute_intake: [
        { intake_kind: 'profile_repair_access', short_code: 'abc12345', submitted_at: null },
      ],
      repair_fulfillment: { tier: 'standard', mode: 'diy', platforms: ['google'] },
    });
    expect(result!.repair!.accessForm).toBeNull();
  });

  it('defaults missing platform_status entry by mode', async () => {
    const diy = await projectCampaign({
      ...repairCampaign,
      repair_fulfillment: { tier: 'standard', mode: 'diy', platforms: ['yelp'] },
    });
    expect(diy!.repair!.platforms[0].status).toBe('customer_pending');

    const dfy = await projectCampaign({
      ...repairCampaign,
      repair_fulfillment: { tier: 'standard', mode: 'dfy', platforms: ['yelp'] },
    });
    expect(dfy!.repair!.platforms[0].status).toBe('in_progress');
  });
});

// ─── Sprint 3: Sibling grouping by business_prospect_id ──────────────────

describe('groupCampaignsByProspect (Sprint 3)', () => {
  it('groups campaigns sharing the same business_prospect_id', () => {
    const campaigns = [
      { id: 'c1', businessName: 'Test Biz', businessProspectId: 'bp-001', isPrimarySibling: true, engagementCycle: 1, datePaid: new Date('2025-01-01'), status: { status: 'delivered', label: 'Delivered' } } as any,
      { id: 'c2', businessName: 'Test Biz', businessProspectId: 'bp-001', isPrimarySibling: false, engagementCycle: 1, datePaid: new Date('2025-01-02'), status: { status: 'in_production', label: "We're working on it" } } as any,
      { id: 'c3', businessName: 'Other Biz', businessProspectId: 'bp-002', isPrimarySibling: true, engagementCycle: 1, datePaid: new Date('2025-01-03'), status: { status: 'delivered', label: 'Delivered' } } as any,
    ];
    const groups = groupCampaignsByProspect(campaigns);
    expect(groups).toHaveLength(2);
    const bp001 = groups.find((g) => g.businessProspectId === 'bp-001')!;
    expect(bp001.campaigns).toHaveLength(2);
    expect(bp001.primaryCampaignId).toBe('c1');
  });

  it('legacy campaigns (null prospect ID) are each their own group', () => {
    const campaigns = [
      { id: 'c1', businessName: 'Legacy 1', businessProspectId: null, isPrimarySibling: false, engagementCycle: 1, datePaid: new Date('2025-01-01'), status: { status: 'delivered', label: 'Delivered' } } as any,
      { id: 'c2', businessName: 'Legacy 2', businessProspectId: null, isPrimarySibling: false, engagementCycle: 1, datePaid: new Date('2025-01-02'), status: { status: 'delivered', label: 'Delivered' } } as any,
    ];
    const groups = groupCampaignsByProspect(campaigns);
    expect(groups).toHaveLength(2);
    expect(groups[0].campaigns).toHaveLength(1);
    expect(groups[1].campaigns).toHaveLength(1);
  });

  it('primary sibling is first within each group', () => {
    const campaigns = [
      { id: 'c1', businessName: 'Test Biz', businessProspectId: 'bp-001', isPrimarySibling: false, engagementCycle: 1, datePaid: new Date('2025-01-02'), status: { status: 'delivered', label: 'Delivered' } } as any,
      { id: 'c2', businessName: 'Test Biz', businessProspectId: 'bp-001', isPrimarySibling: true, engagementCycle: 1, datePaid: new Date('2025-01-01'), status: { status: 'delivered', label: 'Delivered' } } as any,
    ];
    const groups = groupCampaignsByProspect(campaigns);
    expect(groups).toHaveLength(1);
    expect(groups[0].campaigns[0].id).toBe('c2'); // primary first despite older date
    expect(groups[0].campaigns[1].id).toBe('c1');
  });

  it('groups are sorted by most recent activity first', () => {
    const campaigns = [
      { id: 'c1', businessName: 'Older Biz', businessProspectId: 'bp-001', isPrimarySibling: true, engagementCycle: 1, datePaid: new Date('2025-01-01'), status: { status: 'delivered', label: 'Delivered' } } as any,
      { id: 'c2', businessName: 'Newer Biz', businessProspectId: 'bp-002', isPrimarySibling: true, engagementCycle: 1, datePaid: new Date('2025-02-01'), status: { status: 'delivered', label: 'Delivered' } } as any,
    ];
    const groups = groupCampaignsByProspect(campaigns);
    expect(groups[0].businessProspectId).toBe('bp-002'); // newer first
    expect(groups[1].businessProspectId).toBe('bp-001');
  });

  it('returns empty array for no campaigns', () => {
    const groups = groupCampaignsByProspect([]);
    expect(groups).toEqual([]);
  });

  it('single campaign with prospect ID forms its own group', () => {
    const campaigns = [
      { id: 'c1', businessName: 'Solo Biz', businessProspectId: 'bp-001', isPrimarySibling: true, engagementCycle: 1, datePaid: new Date('2025-01-01'), status: { status: 'delivered', label: 'Delivered' } } as any,
    ];
    const groups = groupCampaignsByProspect(campaigns);
    expect(groups).toHaveLength(1);
    expect(groups[0].campaigns).toHaveLength(1);
    expect(groups[0].primaryCampaignId).toBe('c1');
  });
});
