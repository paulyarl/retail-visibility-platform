/**
 * Edit Business Profile form helpers.
 *
 * Regression: the logo upload resolved `data.url || data.dataUrl`, so a failed
 * upload still left the browser data URL in the preview and the PATCH went out
 * without a `logo_url`; social links were saved with their raw keys, so a value
 * stored under `x` never matched the `twitter` key every storefront reads.
 */
import { describe, it, expect } from 'vitest';
import { extractUploadedLogoUrl, normalizeSocialLinks } from './business-profile-form';

describe('extractUploadedLogoUrl', () => {
  it('reads the upload endpoint response shape', () => {
    expect(extractUploadedLogoUrl({ url: 'https://cdn.example.com/logo.png' })).toBe(
      'https://cdn.example.com/logo.png',
    );
  });

  it('accepts the legacy logo_url and dataUrl shapes', () => {
    expect(extractUploadedLogoUrl({ logo_url: 'https://cdn.example.com/a.png' })).toBe(
      'https://cdn.example.com/a.png',
    );
    expect(extractUploadedLogoUrl({ dataUrl: 'https://cdn.example.com/b.png' })).toBe(
      'https://cdn.example.com/b.png',
    );
  });

  it('returns null when the upload produced no URL', () => {
    expect(extractUploadedLogoUrl(undefined)).toBeNull();
    expect(extractUploadedLogoUrl(null)).toBeNull();
    expect(extractUploadedLogoUrl({ url: '' })).toBeNull();
    expect(extractUploadedLogoUrl({ url: '   ' })).toBeNull();
    expect(extractUploadedLogoUrl({ message: 'Upload failed' })).toBeNull();
  });
});

describe('normalizeSocialLinks', () => {
  it('trims values and keeps the canonical keys', () => {
    expect(
      normalizeSocialLinks({
        facebook: ' https://facebook.com/shelfvisible ',
        linkedin: 'https://linkedin.com/company/visibleshelf',
        youtube: 'https://youtube.com/@shelfvisible',
      }),
    ).toEqual({
      facebook: 'https://facebook.com/shelfvisible',
      linkedin: 'https://linkedin.com/company/visibleshelf',
      youtube: 'https://youtube.com/@shelfvisible',
    });
  });

  it('drops blank values so a cleared field removes the link', () => {
    expect(normalizeSocialLinks({ facebook: '', instagram: 'https://instagram.com/x' })).toEqual({
      instagram: 'https://instagram.com/x',
    });
  });

  it('folds the legacy x key onto twitter', () => {
    expect(normalizeSocialLinks({ x: 'https://x.com/shelfvisible' })).toEqual({
      twitter: 'https://x.com/shelfvisible',
    });
  });

  it('converts the claim-flow array shape into the object readers expect', () => {
    expect(
      normalizeSocialLinks([
        { platform: 'facebook', url: 'https://facebook.com/shelfvisible' },
        { platform: 'x', url: 'https://x.com/shelfvisible' },
        { platform: 'youtube', url: '  ' },
      ]),
    ).toEqual({
      facebook: 'https://facebook.com/shelfvisible',
      twitter: 'https://x.com/shelfvisible',
    });
  });

  it('lets an explicit twitter value win over the x alias', () => {
    expect(
      normalizeSocialLinks({ x: 'https://x.com/old', twitter: 'https://x.com/new' }),
    ).toEqual({ twitter: 'https://x.com/new' });
  });

  it('returns undefined when there is nothing to save', () => {
    expect(normalizeSocialLinks(undefined)).toBeUndefined();
    expect(normalizeSocialLinks(null)).toBeUndefined();
    expect(normalizeSocialLinks({})).toBeUndefined();
    expect(normalizeSocialLinks({ facebook: '   ' })).toBeUndefined();
  });
});
