/**
 * ProjectPlanView — static-render tests (sprint 8.2/8.6).
 *
 * The gallery project view is the owner-facing projection: Mantine
 * components need MantineProvider under renderToStaticMarkup (AGENTS.md).
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MantineProvider } from '@mantine/core';
import { ProjectPlanView } from './MultiGalleryPage';
import type { MultiGalleryProjectPlan } from '@/services/DiagnosticGalleryPublicService';

const PHASE_ORDER = ['foundation', 'claim', 'findability', 'trust', 'expansion'] as const;

function makePlan(overrides: Partial<MultiGalleryProjectPlan> = {}): MultiGalleryProjectPlan {
  return {
    generatedAt: '2026-01-01T00:00:00Z',
    phases: PHASE_ORDER.slice(0, 3).map((k) => ({
      key: k,
      name: `${k} phase`,
      goal: `Goal for ${k}`,
      confidence: 'verified' as const,
      status: k === 'foundation' ? ('in_progress' as const) : ('not_started' as const),
      actions: [{ text: `Do ${k}`, ownerAction: false }],
      exitCriterion: { copy: `${k} done when` },
    })),
    cta: { kind: 'pricing' },
    ...overrides,
  };
}

function render(plan: MultiGalleryProjectPlan, payUrl = '/marketing/pay?prospect=bp-1') {
  return renderToStaticMarkup(
    createElement(
      MantineProvider,
      null,
      createElement(ProjectPlanView, { plan, payUrl }),
    ),
  );
}

describe('ProjectPlanView', () => {
  it('renders visible phases in catalog order', () => {
    const html = render(makePlan());
    const positions = ['foundation', 'claim', 'findability'].map((k) =>
      html.indexOf(`data-phase="${k}"`),
    );
    for (const p of positions) expect(p).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('shows owner-safe status labels and actions', () => {
    const html = render(makePlan());
    expect(html).toContain('In progress');
    expect(html).toContain('Planned');
    expect(html).toContain('Do foundation');
  });

  it('renders a claim CTA when the plan resolves one', () => {
    const html = render(
      makePlan({ cta: { kind: 'claim', url: '/claim/abc123' } }),
    );
    expect(html).toContain('Claim your listing');
    expect(html).toContain('/claim/abc123');
  });

  it('labels a phase CTA with the phase name and points at pricing', () => {
    const html = render(
      makePlan({ cta: { kind: 'phase', phaseKey: 'foundation' } }),
    );
    expect(html).toContain('Get started — foundation phase');
    expect(html).toContain('/marketing/pay?prospect=bp-1');
  });

  it('falls back to View Pricing', () => {
    const html = render(makePlan());
    expect(html).toContain('View Pricing');
  });
});
