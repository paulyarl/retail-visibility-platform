/**
 * WhatsAppTextRenderer tests (WHATSAPP_CHANNEL_INTEGRATION_SPEC §17)
 *
 * Pure-function coverage: skill formatters (product-search / inventory /
 * store-hours), markdown→WhatsApp conversion, skill fall-through, channel
 * steering suffix, and the 4,096-char truncation.
 */
import { describe, it, expect } from 'vitest';
import {
  renderTextReply,
  toWhatsAppMarkdown,
  truncateForWhatsApp,
  WHATSAPP_MAX_BODY,
} from '../services/whatsapp/WhatsAppTextRenderer';
import type { TurnResult } from '../services/bot/BotTurnPipeline';

function result(overrides: Partial<TurnResult>): TurnResult {
  return {
    kind: 'static',
    reply: 'ok',
    responseType: 'faq',
    guardrailResult: 'pass',
    ...overrides,
  };
}

describe('toWhatsAppMarkdown', () => {
  it('converts **bold** and __bold__ to WhatsApp *bold*', () => {
    expect(toWhatsAppMarkdown('**Rice** and __beans__')).toBe('*Rice* and *beans*');
  });

  it('converts markdown bullets and numbered lists to •', () => {
    const out = toWhatsAppMarkdown('- one\n* two\n+ three\n1. four\n2. five');
    expect(out).toBe('• one\n• two\n• three\n• four\n• five');
  });

  it('leaves plain text untouched', () => {
    expect(toWhatsAppMarkdown('hello there')).toBe('hello there');
  });
});

describe('truncateForWhatsApp', () => {
  it('returns short text unchanged', () => {
    expect(truncateForWhatsApp('short')).toBe('short');
  });

  it('truncates over-long text at a word boundary with an ellipsis', () => {
    const long = 'word '.repeat(1200).trim(); // ~6000 chars
    const out = truncateForWhatsApp(long);
    expect(out.length).toBeLessThanOrEqual(WHATSAPP_MAX_BODY);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toContain('…word'); // not mid-word garbage at the cut
  });
});

describe('renderTextReply — skill formatters', () => {
  it('product-search: formats product lines with price + stock', () => {
    const out = renderTextReply(result({
      kind: 'skill',
      reply: `Here's what I found:`,
      responseType: 'skill',
      skillName: 'product-search',
      skillData: {
        items: [
          { name: 'Basmati Rice', price: 12.99, inStock: true },
          { name: 'Jasmine Rice', price: 9.5, stockStatus: 'out_of_stock' },
        ],
      },
    }));

    expect(out).toContain(`Here's what I found:`);
    expect(out).toContain('• Basmati Rice — $12.99 — In stock');
    expect(out).toContain('• Jasmine Rice — $9.50 — Out Of Stock');
    expect(out).toContain('Reply with a product name for details.');
  });

  it('product-search: caps at 5 lines and notes the remainder', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ name: `P${i + 1}`, price: 1 }));
    const out = renderTextReply(result({
      kind: 'skill',
      reply: `Here's what I found:`,
      responseType: 'skill',
      skillName: 'product-search',
      skillData: { items },
    }));

    expect(out).toContain('• P5');
    expect(out).not.toContain('• P6');
    expect(out).toContain('…and 3 more');
  });

  it('product-search: empty result → friendly no-match text', () => {
    const out = renderTextReply(result({
      kind: 'skill',
      reply: `Here's what I found:`,
      responseType: 'skill',
      skillName: 'product-search',
      skillData: { items: [] },
    }));
    expect(out).toContain("couldn't find any products");
  });

  it('inventory: in-stock with quantity', () => {
    const out = renderTextReply(result({
      kind: 'skill',
      reply: `Here's what I found:`,
      responseType: 'skill',
      skillName: 'inventory',
      skillData: { name: 'Basmati Rice', in_stock: true, quantity: 14 },
    }));
    expect(out).toBe('*Basmati Rice* is in stock (14 available).');
  });

  it('inventory: out-of-stock with expected restock', () => {
    const out = renderTextReply(result({
      kind: 'skill',
      reply: `Here's what I found:`,
      responseType: 'skill',
      skillName: 'inventory',
      skillData: { productName: 'Ghee', in_stock: false, expected_restock: 'Friday' },
    }));
    expect(out).toBe('*Ghee* is currently out of stock — expected back Friday.');
  });

  it('inventory: unknown shape → falls through to reply', () => {
    const out = renderTextReply(result({
      kind: 'skill',
      reply: 'We carry many items — what are you looking for?',
      responseType: 'skill',
      skillName: 'inventory',
      skillData: { something: 'unrecognized' },
    }));
    expect(out).toBe('We carry many items — what are you looking for?');
  });

  it('store-hours: open now', () => {
    const out = renderTextReply(result({
      kind: 'skill',
      reply: `Here's what I found:`,
      responseType: 'skill',
      skillName: 'store-hours',
      skillData: { is_open: true, today_hours: '9am–9pm' },
    }));
    expect(out).toBe(`We're open now — today's hours: 9am–9pm.`);
  });

  it('store-hours: closed with next open', () => {
    const out = renderTextReply(result({
      kind: 'skill',
      reply: `Here's what I found:`,
      responseType: 'skill',
      skillName: 'store-hours',
      skillData: { is_open: false, next_open: 'tomorrow at 9am' },
    }));
    expect(out).toBe(`We're currently closed — we open tomorrow at 9am.`);
  });
});

describe('renderTextReply — fall-through + fallbacks', () => {
  it('unknown skill with stub reply → meaningful fallback, never the bare stub', () => {
    const out = renderTextReply(result({
      kind: 'skill',
      reply: `Here's what I found:`,
      responseType: 'skill',
      skillName: 'some-future-skill',
      skillData: { anything: true },
    }));
    expect(out).not.toBe(`Here's what I found:`);
    expect(out).toContain('I found something for you');
  });

  it('skill with real reply and no formatter → uses the reply', () => {
    const out = renderTextReply(result({
      kind: 'skill',
      reply: 'Your order ships Tuesday.',
      responseType: 'skill',
      skillName: 'order-status',
    }));
    expect(out).toBe('Your order ships Tuesday.');
  });

  it('non-skill turns pass the reply through markdown conversion', () => {
    const out = renderTextReply(result({ reply: '**Great** question!' }));
    expect(out).toBe('*Great* question!');
  });

  it('empty reply → generic fallback line', () => {
    const out = renderTextReply(result({ reply: '' }));
    expect(out).toBe(`Sorry, I couldn't find an answer for that.`);
  });

  it('appends the channel-steering line once', () => {
    const out = renderTextReply(result({
      reply: 'I am not sure.',
      channels: [{ label: 'Call us' }, { type: 'email', label: 'Email us' }],
    }));
    expect(out).toContain('You can also reach us via: Call us, Email us.');
    expect(out.match(/You can also reach us via/g)?.length).toBe(1);
  });

  it('truncates bodies beyond 4,096 chars', () => {
    const out = renderTextReply(result({ reply: 'x'.repeat(5000) }));
    expect(out.length).toBeLessThanOrEqual(WHATSAPP_MAX_BODY);
  });
});
