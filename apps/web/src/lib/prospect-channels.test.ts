import { describe, it, expect } from 'vitest';
import { resolveProspectChannels } from './prospect-channels';
import type { ProspectQueueEntry } from '@/services/MarketingOpsService';

/**
 * Channel resolution for the comms surfaces (PG cockpit communications
 * panel, shared touch modal). Precedence per channel:
 *   campaign_* (verified post-graduation) > verified_nap > flat snapshot >
 *   channel_sequence rung contact.
 */

function entry(partial: Partial<ProspectQueueEntry>): ProspectQueueEntry {
  return {
    id: 'pque-1',
    business_name: 'Test Biz',
    source_kind: 'intelligence_seek',
    signal_count: 0,
    status: 'queued',
    priority: 'normal',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...partial,
  } as ProspectQueueEntry;
}

describe('resolveProspectChannels', () => {
  it('returns none for an entry with no contact data', () => {
    const ch = resolveProspectChannels(entry({}));
    expect(ch).toEqual({ phone: null, email: null, website: null, socials: [], source: 'none' });
  });

  it('reads phone/website/email from the discovery snapshot', () => {
    const ch = resolveProspectChannels(
      entry({
        business_snapshot: {
          phone: '414-555-0100',
          website: 'https://testbiz.example',
          email: 'owner@testbiz.example',
          social_profiles: [{ platform: 'facebook', url: 'https://fb.com/testbiz' }],
        },
      }),
    );
    expect(ch.phone).toBe('414-555-0100');
    expect(ch.website).toBe('https://testbiz.example');
    expect(ch.email).toBe('owner@testbiz.example');
    expect(ch.socials).toEqual([{ platform: 'facebook', url: 'https://fb.com/testbiz' }]);
    expect(ch.source).toBe('snapshot');
  });

  it('verified_nap beats flat snapshot keys', () => {
    const ch = resolveProspectChannels(
      entry({
        business_snapshot: {
          phone: '414-555-0100',
          verified_nap: { phone: '414-555-9999', website: 'https://verified.example' },
        },
      }),
    );
    expect(ch.phone).toBe('414-555-9999');
    expect(ch.website).toBe('https://verified.example');
    expect(ch.source).toBe('snapshot');
  });

  it('campaign channels beat everything and mark the source', () => {
    const ch = resolveProspectChannels(
      entry({
        processed_campaign_id: 'mc-1',
        campaign_phone: '414-555-0001',
        campaign_social_profiles: [{ platform: 'instagram', url: 'https://ig.example/testbiz' }],
        business_snapshot: {
          verified_nap: { phone: '414-555-9999' },
          social_profiles: [{ platform: 'facebook', url: 'https://fb.com/testbiz' }],
        },
      }),
    );
    expect(ch.phone).toBe('414-555-0001');
    expect(ch.socials).toEqual([{ platform: 'instagram', url: 'https://ig.example/testbiz' }]);
    expect(ch.source).toBe('campaign');
  });

  it('falls back to channel_sequence rung contacts', () => {
    const ch = resolveProspectChannels(
      entry({
        channel_sequence: [
          { channel: 'call', contact: '414-555-7777', status: 'unverified' },
          { channel: 'form', contact: 'https://testbiz.example/contact', status: 'unverified' },
        ],
      }),
    );
    expect(ch.phone).toBe('414-555-7777');
    expect(ch.website).toBe('https://testbiz.example/contact');
    expect(ch.source).toBe('snapshot');
  });

  it('coerces object-shaped snapshot websites ({url})', () => {
    const ch = resolveProspectChannels(
      entry({ business_snapshot: { website: { url: 'https://obj.example' } } }),
    );
    expect(ch.website).toBe('https://obj.example');
  });

  it('drops social rows without a url', () => {
    const ch = resolveProspectChannels(
      entry({
        business_snapshot: {
          social_profiles: [
            { platform: 'facebook', url: '' },
            { platform: 'instagram', url: 'https://ig.example/x' },
          ],
        },
      }),
    );
    expect(ch.socials).toEqual([{ platform: 'instagram', url: 'https://ig.example/x' }]);
  });
});
