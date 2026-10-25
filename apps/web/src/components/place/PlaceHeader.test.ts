/**
 * PlaceHeader — the /place banner. It must mirror the directory header's
 * structure (logo plate, platform name, nav) while carrying the violet/indigo
 * palette that separates the places surface from the blue directory, and it
 * must link both surfaces to each other.
 */
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlaceHeader from './PlaceHeader';

describe('PlaceHeader', () => {
  it('renders the violet banner palette, not the directory blue', () => {
    const html = renderToStaticMarkup(createElement(PlaceHeader, {}));

    expect(html).toContain('from-violet-600');
    expect(html).toContain('to-indigo-700');
    expect(html).not.toContain('from-blue-600');
  });

  it('links the places index, the directory, and home', () => {
    const html = renderToStaticMarkup(createElement(PlaceHeader, {}));

    expect(html).toContain('href="/place"');
    expect(html).toContain('href="/directory"');
    expect(html).toContain('href="/"');
    expect(html).toContain('Browse All');
    expect(html).toContain('Directory');
  });
});
