/**
 * GbpPhotoUploadPicker — render guard.
 *
 * The picker is a client component but its branches are pure: with
 * `canUpload={false}` it must render the capability upsell (never a broken
 * form), and with `canUpload` it must offer both the file and URL modes.
 * `renderToStaticMarkup` never runs effects, and the component's only
 * side-effects live in event handlers, so this is safe in the node env.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GbpPhotoUploadPicker } from './GbpPhotoUploadPicker';

const render = (canUpload: boolean) =>
  renderToStaticMarkup(createElement(GbpPhotoUploadPicker, { tenantId: 'tid-test', onUploaded: () => {}, canUpload }));

describe('GbpPhotoUploadPicker', () => {
  it('renders the capability upsell when photo upload is not entitled', () => {
    const html = render(false);
    expect(html).toContain('Activate photo upload');
    expect(html).toContain('feature-store?feature=gbp_media_upload');
    // No form affordances leak through when unentitled
    expect(html).not.toContain('Upload to Google');
  });

  it('offers both file and URL upload modes when entitled', () => {
    const html = render(true);
    expect(html).toContain('Upload File');
    expect(html).toContain('Use URL');
    expect(html).toContain('Upload to Google');
    // Category picker is prefilled and serialized into the markup
    expect(html).toContain('value="ADDITIONAL"');
  });
});
