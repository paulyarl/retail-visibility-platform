/**
 * WhatsApp Text Renderer (WHATSAPP_CHANNEL_INTEGRATION_SPEC §8.4)
 *
 * WhatsApp is text-only — the widget renders skillCard/skillData/channels
 * client-side, so this layer serializes the structured TurnResult into a
 * WhatsApp-compatible text body. Without it, a stock question would send the
 * literal "Here's what I found:" and nothing else.
 *
 * Per-skill formatter registry: product-search is required for the demo.
 * Skills without a formatter fall through to the dynamic/static reply —
 * never emit a bare "Here's what I found:".
 */

import type { TurnResult } from '../bot/BotTurnPipeline';

export const WHATSAPP_MAX_BODY = 4096;
const MAX_PRODUCT_LINES = 5;

// ─── Markdown ─────────────────────────────────────────────────────────

/** Convert the bot's markdown to WhatsApp syntax. */
export function toWhatsAppMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '*$1*') // **bold** → *bold* (WhatsApp)
    .replace(/__([^_]+)__/g, '*$1*')     // __bold__ → *bold*
    .replace(/^[\s]*[-*+]\s+/gm, '• ')   // markdown list bullets → •
    .replace(/^[\s]*\d+\.\s+/gm, '• ');  // numbered lists → •
}

// ─── Formatters ───────────────────────────────────────────────────────

type SkillFormatter = (skillData: any, skillCard: any) => string | null;

function money(price: any, currency: any): string {
  if (price === null || price === undefined) return '';
  const num = Number(price);
  if (Number.isNaN(num)) return String(price);
  const cur = typeof currency === 'string' && currency.length === 3 ? currency : 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
}

function stockLabel(p: any): string {
  const status = p.stockStatus ?? p.stock_status;
  if (typeof status === 'string' && status) {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  if (p.inStock === false || p.in_stock === false) return 'Out of stock';
  if (p.inStock === true || p.in_stock === true) return 'In stock';
  if (typeof p.quantity === 'number') return p.quantity > 0 ? 'In stock' : 'Out of stock';
  return '';
}

function productName(p: any): string {
  return p.name || p.productName || p.title || 'Product';
}

/** product-search → up to 5 compact lines + a follow-up prompt. */
const formatProductSearch: SkillFormatter = (data) => {
  const products: any[] = data?.products || data?.items || (Array.isArray(data) ? data : []);
  if (!products.length) {
    return `I couldn't find any products matching that. Try a different name or category?`;
  }
  const lines = products.slice(0, MAX_PRODUCT_LINES).map(p => {
    const price = money(p.price, p.currency);
    const stock = stockLabel(p);
    return `• ${productName(p)}${price ? ` — ${price}` : ''}${stock ? ` — ${stock}` : ''}`;
  });
  if (products.length > MAX_PRODUCT_LINES) {
    lines.push(`…and ${products.length - MAX_PRODUCT_LINES} more`);
  }
  return [
    `Here's what I found:`,
    ...lines,
    `Reply with a product name for details.`,
  ].join('\n');
};

/** inventory → availability line for a specific product. */
const formatInventory: SkillFormatter = (data) => {
  const d = data || {};
  const name = d.productName || d.name || d.product || 'That item';
  const inStock = d.inStock ?? d.in_stock ?? (typeof d.quantity === 'number' ? d.quantity > 0 : undefined);
  const restock = d.expectedRestock || d.expected_restock;
  if (inStock === true) {
    return `*${name}* is in stock${typeof d.quantity === 'number' ? ` (${d.quantity} available)` : ''}.`;
  }
  if (inStock === false) {
    return `*${name}* is currently out of stock${restock ? ` — expected back ${restock}` : ''}.`;
  }
  return null; // unknown shape → fall through
};

/** store-hours → open/closed line. */
const formatStoreHours: SkillFormatter = (data) => {
  const d = data || {};
  const isOpen = d.isOpen ?? d.is_open;
  const hours = d.todayHours || d.today_hours;
  const nextOpen = d.nextOpen || d.next_open;
  if (isOpen === true) return `We're open now${hours ? ` — today's hours: ${hours}` : ''}.`;
  if (isOpen === false) return `We're currently closed${nextOpen ? ` — we open ${nextOpen}` : ''}.`;
  return null;
};

const SKILL_FORMATTERS: Record<string, SkillFormatter> = {
  'product-search': formatProductSearch,
  'inventory': formatInventory,
  'store-hours': formatStoreHours,
};

// ─── Channels steering ────────────────────────────────────────────────

function channelsLine(channels: any[]): string | null {
  if (!channels?.length) return null;
  const labels = channels
    .map(c => c?.label || c?.name || c?.type)
    .filter(Boolean)
    .slice(0, 4);
  if (!labels.length) return null;
  return `You can also reach us via: ${labels.join(', ')}.`;
}

// ─── Truncation ───────────────────────────────────────────────────────

/** Truncate at a word boundary with an ellipsis (WhatsApp cap: 4096 chars). */
export function truncateForWhatsApp(text: string, max = WHATSAPP_MAX_BODY): string {
  if (text.length <= max) return text;
  const slice = text.slice(0, max - 1);
  const lastSpace = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('\n'));
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd() + '…';
}

// ─── Entry point ──────────────────────────────────────────────────────

/**
 * Serialize a TurnResult to a WhatsApp text body.
 *
 * Order: skill formatter → reply → channel-steering suffix → markdown →
 * 4096 truncation. A skill with no registered formatter (or a formatter
 * that returns null) falls through to result.reply — never a bare
 * "Here's what I found:".
 */
export function renderTextReply(result: TurnResult): string {
  let body: string;

  if (result.kind === 'skill' && result.skillName) {
    const formatter = SKILL_FORMATTERS[result.skillName];
    const formatted = formatter?.(result.skillData, result.skillCard);
    body = formatted ?? (result.reply === `Here's what I found:` ? '' : result.reply);
    if (!body) {
      // Formatter produced nothing and reply is the card stub — give a
      // meaningful fallback rather than the bare stub.
      body = `I found something for you — could you tell me a bit more about what you're looking for?`;
    }
  } else {
    body = result.reply || '';
  }

  const steering = channelsLine(result.channels ?? []);
  if (steering && !body.includes(steering)) {
    body = body ? `${body}\n\n${steering}` : steering;
  }

  if (!body) body = `Sorry, I couldn't find an answer for that.`;
  return truncateForWhatsApp(toWhatsAppMarkdown(body));
}
