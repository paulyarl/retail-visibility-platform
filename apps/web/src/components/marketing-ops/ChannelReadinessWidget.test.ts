import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChannelReadinessWidget, { resolveCascadeState } from './ChannelReadinessWidget';
import type { ContactReadiness } from '@/services/MarketingOpsService';

const base: ContactReadiness = {
  hasPhone: false,
  hasEmail: false,
  hasWebsite: false,
  hasSocial: false,
  complete: false,
};

describe('resolveCascadeState', () => {
  it('is ready when email + phone', () => {
    const s = resolveCascadeState({ ...base, hasEmail: true, hasPhone: true, complete: true });
    expect(s.level).toBe('ready');
    expect(s.label).toBe('Cascade Ready');
  });

  it('is ready when email + social (phone still missing)', () => {
    const s = resolveCascadeState({ ...base, hasEmail: true, hasSocial: true, complete: true });
    expect(s.level).toBe('ready');
  });

  it('is partial when email only — SMS/DM fall back to email', () => {
    const s = resolveCascadeState({ ...base, hasEmail: true, complete: true });
    expect(s.level).toBe('partial');
    expect(s.desc).toContain('fall back to email');
  });

  it('is partial when secondary-only (no email) — SMS/DM still fire', () => {
    const s = resolveCascadeState({ ...base, hasPhone: true });
    expect(s.level).toBe('partial');
    expect(s.desc).toContain('Day-1 step will be skipped');
  });

  it('is partial when social-only', () => {
    expect(resolveCascadeState({ ...base, hasSocial: true }).level).toBe('partial');
  });

  it('is blocked only when no contact channels at all', () => {
    const s = resolveCascadeState(base);
    expect(s.level).toBe('blocked');
    expect(s.desc).toContain('cascade cannot fire');
  });

  it('website alone does not unblock the cascade', () => {
    expect(resolveCascadeState({ ...base, hasWebsite: true }).level).toBe('blocked');
  });
});

describe('ChannelReadinessWidget (SSR)', () => {
  it('renders its loading state — readiness fetch is useEffect-gated', () => {
    const html = renderToStaticMarkup(
      createElement(ChannelReadinessWidget, { campaignId: 'camp-1' }),
    );
    expect(html).toContain('Channel Readiness');
    expect(html).toContain('Loading');
  });
});
