/**
 * /place layout — the chrome contract shared with /directory: the header
 * banner renders above the route content on every place surface (index and
 * entry pages), the same way app/directory/layout.tsx wraps the directory.
 */
import { describe, it, expect } from 'vitest';
import { Children, createElement } from 'react';
import PlaceLayout from './layout';
import PlaceHeader from '@/components/place/PlaceHeader';

function layoutChildren() {
  const layout = PlaceLayout({ children: createElement('main', null, 'content') });
  return Children.toArray(layout.props.children) as Array<{ type: unknown }>;
}

describe('/place layout', () => {
  it('renders the place header before the route content', () => {
    const children = layoutChildren();

    expect(children[0].type).toBe(PlaceHeader);
    expect(children[1].type).toBe('main');
  });
});
