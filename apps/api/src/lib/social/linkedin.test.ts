import { describe, it, expect, vi } from 'vitest';

vi.mock('../../prisma', () => ({ prisma: {} }));
vi.mock('./surfaces', () => ({ resolveSurface: vi.fn() }));

import { linkedinAdapter } from './linkedin';
import type { SocialPostDraft } from './types';

const draft = (over: Partial<SocialPostDraft> = {}): SocialPostDraft => ({
  tenantId: 't1',
  platform: 'linkedin',
  targetRef: null,
  body: 'Hello LinkedIn',
  linkUrl: null,
  ...over,
});

describe('linkedinAdapter.validateDraft', () => {
  it('accepts a text-only post', () => {
    expect(linkedinAdapter.validateDraft(draft())).toEqual([]);
  });

  it('rejects empty body', () => {
    expect(linkedinAdapter.validateDraft(draft({ body: '  ' }))).toContain('body is required');
  });

  it('rejects body over 3000 chars', () => {
    const errors = linkedinAdapter.validateDraft(draft({ body: 'x'.repeat(3001) }));
    expect(errors.some((e) => e.includes('3000'))).toBe(true);
  });

  it('accepts up to 9 images', () => {
    const media = Array.from({ length: 9 }, (_, i) => ({ url: `https://x/img${i}.jpg`, type: 'photo' as const }));
    expect(linkedinAdapter.validateDraft(draft({ media }))).toEqual([]);
  });

  it('rejects more than 9 images', () => {
    const media = Array.from({ length: 10 }, (_, i) => ({ url: `https://x/img${i}.jpg`, type: 'photo' as const }));
    expect(linkedinAdapter.validateDraft(draft({ media }))).toContain('linkedin allows at most 9 images');
  });

  it('rejects video in v1', () => {
    const media = [{ url: 'https://x/v.mp4', type: 'video' as const }];
    expect(linkedinAdapter.validateDraft(draft({ media }))).toContain('linkedin video posts are not supported yet');
  });

  it('rejects link + media combination', () => {
    const media = [{ url: 'https://x/i.jpg', type: 'photo' as const }];
    const errors = linkedinAdapter.validateDraft(draft({ linkUrl: 'https://example.com', media }));
    expect(errors).toContain('linkedin link posts cannot include media');
  });

  it('accepts link-only post', () => {
    expect(linkedinAdapter.validateDraft(draft({ linkUrl: 'https://example.com' }))).toEqual([]);
  });
});
