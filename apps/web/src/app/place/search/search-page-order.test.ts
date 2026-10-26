/**
 * /place/search composition — the search surface must carry the same chrome as
 * the rest of /place: the violet hero band leads, the client-driven form and
 * results follow, the owner CTAs (add / suggest a business) close the content,
 * and the platform footer is last. Regression: the page was a bare client
 * component — no hero, no CTAs, no footer.
 */
import { describe, it, expect } from 'vitest';
import { Children, Suspense, createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import AddBusinessCta from '@/components/directory/AddBusinessCta';
import SuggestBusinessCta from '@/components/directory/SuggestBusinessCta';
import { PoweredByFooter } from '@/components/PoweredByFooter';
import PlacesSearchPage from './page';
import PlacesSearchHero from './PlacesSearchHero';

function pageChildren() {
  const page = PlacesSearchPage() as ReactElement<{ children: ReactNode }>;
  return Children.toArray(page.props.children) as ReactElement<any>[];
}

describe('/place/search composition', () => {
  it('leads with the hero and closes with the platform footer', () => {
    const types = pageChildren().map((child) => child.type);

    expect(types[0]).toBe(PlacesSearchHero);
    expect(types[1]).toBe(Suspense);
    expect(types[types.length - 1]).toBe(PoweredByFooter);
  });

  it('renders the add-business and suggest-business CTAs above the footer', () => {
    const children = pageChildren();
    const types = children.map((child) => child.type);
    const ctaGrid = children.find((child) => child.type === 'div');

    expect(ctaGrid?.props.children).toBeDefined();
    const ctaTypes = (Children.toArray(ctaGrid?.props.children) as ReactElement<any>[]).map(
      (child) => child.type,
    );
    expect(ctaTypes).toEqual([AddBusinessCta, SuggestBusinessCta]);
    expect(types.indexOf('div')).toBeGreaterThan(types.indexOf(Suspense));
    expect(types[types.length - 1]).toBe(PoweredByFooter);
  });

  it('points the CTAs at the directory add and suggest flows', () => {
    const add = renderToStaticMarkup(createElement(AddBusinessCta, { source: '/place/search' }));
    const suggest = renderToStaticMarkup(
      createElement(SuggestBusinessCta, { source: '/place/search' }),
    );

    expect(add).toContain('/directory/add-business?source=%2Fplace%2Fsearch');
    expect(suggest).toContain('/directory/suggest?source=%2Fplace%2Fsearch');
  });

  it('renders the violet hero band with the page title', () => {
    const html = renderToStaticMarkup(createElement(PlacesSearchHero));

    expect(html).toContain('from-violet-600');
    expect(html).toContain('Search Places');
    expect(html).toContain('href="/place"');
  });
});
