import { describe, it, expect, vi, beforeEach } from 'vitest';

// ====================
// MOCKS
// ====================

const { mockExecutions } = vi.hoisted(() => ({
  mockExecutions: { findUnique: vi.fn() },
}));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_prompt_executions_list: mockExecutions,
    mkt_campaigns_list: { findUnique: vi.fn() },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../config/unifiedConfig', () => ({
  unifiedConfig: { webUrl: 'http://localhost:3000' },
}));

vi.mock('../MarketingCampaignService', () => ({
  default: { getCampaign: vi.fn() },
}));

vi.mock('../MarketingBrandingService', () => ({
  MarketingBrandingService: {
    getInstance: () => ({ getActiveConfig: vi.fn().mockResolvedValue(null) }),
    applyBrandingToDoc: vi.fn(),
    applyWatermark: vi.fn(),
  },
}));

import { MarketingDeliverableService } from '../MarketingDeliverableService';

// W6b — extractContentFromExecution converts a fulfill execution's JSON blob
// ({deliverableText, submissionGuide}) into the §5.1 package markdown for
// PDF rendering; non-JSON output passes through unchanged. The method is
// private — exercised via `any` so the test binds the contract, not the API.

const svc: any = MarketingDeliverableService.getInstance();

describe('extractContentFromExecution (W6b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty string when no execution id', async () => {
    expect(await svc.extractContentFromExecution(undefined)).toBe('');
  });

  it('returns empty string when the execution has no output', async () => {
    mockExecutions.findUnique.mockResolvedValue({ filtered_output: null, raw_output: null });
    expect(await svc.extractContentFromExecution('exec-1')).toBe('');
  });

  it('composes JSON fulfill output into structured package markdown', async () => {
    mockExecutions.findUnique.mockResolvedValue({
      filtered_output: JSON.stringify({
        deliverableText: '## Fix Sheets\nGoogle: correct the phone.',
        submissionGuide: 'Log in at business.google.com.',
      }),
      raw_output: null,
    });

    const content = await svc.extractContentFromExecution('exec-1');

    expect(content).toContain('## Citation & Profile Repair Package');
    expect(content).toContain('## Fix Sheets');
    expect(content).toContain('## Submission Guide');
    expect(content).toContain('business.google.com');
    // No raw JSON keys leak into the rendered PDF
    expect(content).not.toContain('deliverableText');
  });

  it('handles fenced JSON output', async () => {
    mockExecutions.findUnique.mockResolvedValue({
      filtered_output: '```json\n{"deliverableText":"Body text","submissionGuide":"Guide text"}\n```',
      raw_output: null,
    });

    const content = await svc.extractContentFromExecution('exec-1');
    expect(content).toContain('Body text');
    expect(content).toContain('Guide text');
  });

  it('passes non-JSON output through unchanged', async () => {
    mockExecutions.findUnique.mockResolvedValue({
      filtered_output: 'Plain markdown deliverable body',
      raw_output: null,
    });

    expect(await svc.extractContentFromExecution('exec-1')).toBe('Plain markdown deliverable body');
  });

  it('falls back to raw_output when filtered_output is empty', async () => {
    mockExecutions.findUnique.mockResolvedValue({
      filtered_output: null,
      raw_output: JSON.stringify({ deliverableText: 'Raw path', submissionGuide: 'G' }),
    });

    const content = await svc.extractContentFromExecution('exec-1');
    expect(content).toContain('Raw path');
  });
});
