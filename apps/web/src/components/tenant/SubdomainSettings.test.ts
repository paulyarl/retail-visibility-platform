import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SubdomainSettings from './SubdomainSettings';

// SSR renders the initial state (useEffect never runs), so businessName is empty
// and the component shows the slug-picker fallback instead of the picker itself.
// The capability query stays pending under SSR, and the entitlement gate
// defaults to entitled until resolved — the card renders normally.
describe('SubdomainSettings', () => {
  it('renders the subdomain card without a free-text subdomain input', () => {
    const client = new QueryClient();
    const html = renderToStaticMarkup(
      createElement(QueryClientProvider, { client }, createElement(SubdomainSettings, { tenantId: 'tid-1' })),
    );

    expect(html).toContain('Custom Subdomain');
    // No free-text entry — the value now comes from the slug picker.
    expect(html).not.toContain('type="text"');
    // Picker is deferred until a business name is available.
    expect(html).toContain('Add a business name to your profile to see available subdomains.');
  });
});
