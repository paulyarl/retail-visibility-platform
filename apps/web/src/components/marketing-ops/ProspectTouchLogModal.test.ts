/**
 * Render tests for the seed-scoped ProspectTouchLogModal mode.
 *
 * The announce queue opens this modal with `seedId` for campaign-less seeds;
 * it must expose the C2/C3/C4 capture and the resolved seed channels.
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ProspectTouchLogModal from './ProspectTouchLogModal';

const render = () =>
  renderToStaticMarkup(
    createElement(ProspectTouchLogModal, {
      entry: {
        id: 'seed-001',
        business_name: 'Maria’s Market',
        business_snapshot: {
          verified_nap: { phone: '317-555-0100', email: 'owner@example.com' },
        },
      },
      seedId: 'seed-001',
      onClose: () => {},
      onLogged: () => {},
    }),
  );

describe('ProspectTouchLogModal seed mode', () => {
  it('renders the C2/C3/C4 capture and the seed channels', () => {
    const html = render();

    expect(html).toContain('Announce delivered (C2)');
    expect(html).toContain('Pain (C3)');
    expect(html).toContain('Follow-up permission (C4)');
    expect(html).toContain('317-555-0100');
    expect(html).toContain('owner@example.com');
    expect(html).toContain('Maria’s Market');
  });
});
