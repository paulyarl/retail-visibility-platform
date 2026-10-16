import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SelectorToolbar from './SelectorToolbar';

/**
 * Shared search + sort toolbar (communications prospects, openers/follow-ups
 * campaigns). Plain elements + lucide icons render bare in the node vitest
 * environment — no MantineProvider needed. Controlled inputs serialize their
 * prefilled state into markup, so the search prefill is assertable.
 */

function render(children?: ReturnType<typeof createElement>) {
  return renderToStaticMarkup(
    createElement(
      SelectorToolbar,
      {
        search: 'mapquest',
        onSearchChange: () => {},
        searchPlaceholder: 'Search name, city, category…',
        sortBy: 'name',
        onSortChange: () => {},
        sortOptions: [
          { value: 'name', label: 'Name (A–Z)' },
          { value: 'location', label: 'Location (city, state)' },
        ],
      },
      children,
    ),
  );
}

describe('SelectorToolbar', () => {
  it('renders the search prefill, placeholder and sort options', () => {
    const html = render();
    expect(html).toContain('value="mapquest"');
    expect(html).toContain('Search name, city, category…');
    expect(html).toContain('Sort by');
    expect(html).toContain('Name (A–Z)');
    expect(html).toContain('Location (city, state)');
  });

  it('renders the item select passed as a child inline', () => {
    const html = render(
      createElement('select', null, createElement('option', { value: '' }, '— Select a prospect —')),
    );
    expect(html).toContain('— Select a prospect —');
  });
});
