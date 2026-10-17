/**
 * Tenant-scoped Feature Store wrapper.
 *
 * Regression guard. The wrapper rendered `<FeatureStorePage />` with no
 * `tenantId`, so the client page fell back to `?tenantId` / `localStorage` —
 * both empty on a cold deep link. Merchants arriving from a GBP upsell
 * (`/t/<tid>/settings/feature-store?feature=gbp_media_upload`) got a red
 * "Tenant ID is required" banner and "No features are currently available for
 * purchase", despite the tenant being right there in the path.
 *
 * `SetTenantId` cannot rescue it: it writes the tenant context in an effect,
 * after the page has already rendered and read localStorage.
 */
import { describe, it, expect } from 'vitest';
import { Children, type ReactElement, type ReactNode } from 'react';
import TenantScopedFeatureStore from './page';
import FeatureStorePage from '@/app/(platform)/settings/feature-store/page';

describe('TenantScopedFeatureStore', () => {
  it('passes the route tenant into the store page', async () => {
    const tree = (await TenantScopedFeatureStore({
      params: Promise.resolve({ tenantId: 'tid-abc' }),
    })) as ReactElement<{ children: ReactNode }>;

    const children = Children.toArray(tree.props.children);
    const store = children.find((child) => (child as ReactElement).type === FeatureStorePage);

    expect(store).toBeDefined();
    expect((store as ReactElement<{ tenantId?: string }>).props.tenantId).toBe('tid-abc');
  });
});
