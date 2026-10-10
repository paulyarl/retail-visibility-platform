import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SubdomainSettings from './SubdomainSettings';

// SSR renders the initial state (useEffect never runs), so businessName is empty
// and the component shows the slug-picker fallback instead of the picker itself.
describe('SubdomainSettings', () => {
  it('renders the subdomain card without a free-text subdomain input', () => {
    const html = renderToStaticMarkup(createElement(SubdomainSettings, { tenantId: 'tid-1' }));

    expect(html).toContain('Custom Subdomain');
    // No free-text entry — the value now comes from the slug picker.
    expect(html).not.toContain('type="text"');
    // Picker is deferred until a business name is available.
    expect(html).toContain('Add a business name to your profile to see available subdomains.');
  });
});
