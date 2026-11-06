import { describe, it, expect } from 'vitest';
import {
  topNudge,
  metricSummary,
  editorHref,
  STATE_META,
  type ContentChannelCard,
  type ContentChannelState,
} from './content-hub';

const card = (over: Partial<ContentChannelCard>): ContentChannelCard => ({
  key: 'k',
  label: 'Label',
  rendersOn: ['/directory/x'],
  state: 'empty',
  metrics: {},
  capability: { enabled: true, flexible: false },
  editorHref: '/settings/directory',
  ...over,
});

describe('STATE_META', () => {
  it('covers every channel state', () => {
    const states: ContentChannelState[] = ['empty', 'active', 'locked', 'dark'];
    for (const s of states) {
      expect(STATE_META[s].label).toBeTruthy();
      expect(STATE_META[s].dot).toBeTruthy();
      expect(STATE_META[s].badge).toBeTruthy();
    }
  });
});

describe('topNudge', () => {
  it('prefers an empty card with a nudge over later nudges', () => {
    const channels = [
      card({ key: 'a', state: 'active', nudge: 'active nudge' }),
      card({ key: 'b', state: 'empty', nudge: 'Add photos' }),
    ];
    expect(topNudge(channels)).toBe('Add photos');
  });

  it('skips locked and dark cards entirely in the first pass', () => {
    const channels = [
      card({ key: 'a', state: 'locked', nudge: 'Upgrade to unlock' }),
      card({ key: 'b', state: 'dark', nudge: 'Coming soon' }),
      card({ key: 'c', state: 'empty', nudge: 'Start here' }),
    ];
    expect(topNudge(channels)).toBe('Start here');
  });

  it('falls back to a non-empty nudge when nothing is empty', () => {
    const channels = [
      card({ key: 'a', state: 'active', nudge: 'Keep going' }),
      card({ key: 'b', state: 'locked', nudge: 'Upgrade' }),
    ];
    expect(topNudge(channels)).toBe('Keep going');
  });

  it('returns null when no channel carries a nudge', () => {
    expect(topNudge([card({ key: 'a' }), card({ key: 'b', state: 'active' })])).toBeNull();
  });
});

describe('metricSummary', () => {
  it('joins non-zero metrics', () => {
    expect(metricSummary(card({ metrics: { items: 124, featured: 5 } }))).toBe('124 items · 5 featured');
  });

  it('renders a zero placeholder with the first metric name', () => {
    expect(metricSummary(card({ metrics: { photos: 0, sectionsOn: 0 } }))).toBe('0 photos');
  });

  it('humanizes camelCase metric keys', () => {
    expect(metricSummary(card({ metrics: { sectionsOn: 7 } }))).toBe('7 sections on');
    expect(metricSummary(card({ metrics: { someNewMetric: 3 } }))).toBe('3 some new metric');
  });

  it('renders a dash for empty metrics', () => {
    expect(metricSummary(card({ metrics: {} }))).toBe('—');
  });
});

describe('editorHref', () => {
  it('builds the tenant-scoped deep link', () => {
    expect(editorHref(card({ editorHref: '/settings/directory' }), 'tid-abc')).toBe(
      '/t/tid-abc/settings/directory'
    );
  });
});
