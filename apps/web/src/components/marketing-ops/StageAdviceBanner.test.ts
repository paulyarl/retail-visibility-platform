/**
 * StageAdviceBanner / StageAdviceChip render tests.
 *
 * The banner is the only place the VAST surfaces mutate a pipeline stage; it
 * must be honest about the three readiness states and never enable the advance
 * when the server hard-gates the edge.
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import StageAdviceBanner, { StageAdviceChip } from './StageAdviceBanner';
import type { StageAdvice } from '@/services/MarketingOpsService';

const advice = (overrides: Partial<StageAdvice> = {}): StageAdvice => ({
  campaignId: 'camp-1',
  currentStage: 'seek',
  nextStage: 'seed',
  readiness: 'ready',
  checks: [],
  blockers: [],
  tip: 'Audit and category are in.',
  acknowledgeRequired: false,
  ...overrides,
});

const render = (a: StageAdvice | null) =>
  renderToStaticMarkup(createElement(StageAdviceBanner, { campaignId: 'camp-1', advice: a }));

describe('StageAdviceChip', () => {
  it('renders nothing for a terminal or missing advice', () => {
    expect(renderToStaticMarkup(createElement(StageAdviceChip, { advice: null }))).toBe('');
    expect(
      renderToStaticMarkup(createElement(StageAdviceChip, { advice: advice({ readiness: 'terminal', nextStage: null }) })),
    ).toBe('');
  });

  it('names the next stage', () => {
    const html = renderToStaticMarkup(createElement(StageAdviceChip, { advice: advice() }));
    expect(html).toContain('Seed');
  });
});

describe('StageAdviceBanner', () => {
  it('renders nothing when there is no advice', () => {
    expect(render(null)).toBe('');
  });

  it('offers the advance and the tip when green', () => {
    const html = render(advice());
    expect(html).toContain('Stage · Seek');
    expect(html).toContain('Advance to Seed');
    expect(html).toContain('Audit and category are in.');
    expect(html).not.toContain('disabled=""');
  });

  it('marks the acknowledgement state', () => {
    const html = render(
      advice({
        readiness: 'ready_with_ack',
        acknowledgeRequired: true,
        blockers: [{ code: 'checklist_incomplete', message: 'Checklist step incomplete: Triage', hard: false }],
      }),
    );
    expect(html).toContain('ready to acknowledge');
    expect(html).toContain('Checklist step incomplete: Triage');
  });

  it('disables the advance on a hard blocker and links the unblock surface', () => {
    const html = render(
      advice({
        currentStage: 'seed',
        nextStage: 'preview_built',
        readiness: 'blocked',
        blockers: [
          {
            code: 'business_analysis_required',
            message: 'No archetype can be resolved.',
            hard: true,
            actionLabel: 'Run business analysis',
          },
        ],
      }),
    );
    expect(html).toContain('not yet');
    expect(html).toContain('disabled=""');
    expect(html).toContain('No archetype can be resolved.');
    expect(html).toContain('Run business analysis');
    expect(html).toContain('?tab=prompts');
  });

  it('lists unmet checks, marking the advisory ones', () => {
    const html = render(
      advice({
        checks: [
          { key: 'contact', label: 'Phone or website on file', met: false, advisory: true },
          { key: 'business_analysis', label: 'Business analysis audit (non-stub)', met: false, advisory: false },
        ],
      }),
    );
    expect(html).toContain('Phone or website on file');
    expect(html).toContain('(advisory)');
    expect(html).toContain('Business analysis audit (non-stub)');
  });

  it('renders no advance control once the cascade advice is terminal', () => {
    const html = render(advice({ currentStage: 'shown', nextStage: null, readiness: 'terminal', tip: 'Done.' }));
    expect(html).toContain('Stage · Shown');
    expect(html).not.toContain('Advance to');
  });
});
