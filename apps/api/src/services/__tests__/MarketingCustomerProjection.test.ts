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
  it.each(['seek', 'preview_built', 'shown', 'lost', 'dead'])(
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
        { id: 'del-1', title: 'Report', type: 'pdf', file_url: 'https://files.example.com/d1.pdf', delivered_at: new Date('2026-02-01'), delivery_status: 'delivered' },
        { id: 'del-2', title: 'Preview', type: 'pdf', file_url: 'https://files.example.com/d2.pdf', delivered_at: null, delivery_status: 'preview' },
      ],
    };
    const result = await projectCampaign(campaign);
    expect(result!.deliverables).toHaveLength(2); // both shown because stage=delivered
    expect(result!.deliverables[0].title).toBe('Report');
    expect(result!.deliverables[0].downloadUrl).toBe('https://files.example.com/d1.pdf');
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
