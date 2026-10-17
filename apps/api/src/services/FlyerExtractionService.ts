/**
 * FlyerExtractionService — agent-drafted flyers (spec §7a.1).
 *
 * Input: a merchant free-text brief ("jollof plate $14 vegan, friday") or the
 * roll-forward case (prior flyer items are already exposed via /duplicate).
 * Output: a structured DRAFT — never a publish. The composer opens it
 * prefilled; the merchant reviews every field and nothing is saved until
 * they confirm.
 *
 * Price discipline (spec-mandated):
 *   - The agent is instructed NEVER to invent a price it can't see in the
 *     brief — it emits priceCents: null instead.
 *   - Server-side price defaulting: a dish with no parsed price inherits the
 *     LAST price used for the same dish name in the tenant's repertoire
 *     (product_variants on the flyer parent). If no history exists, the dish
 *     is flagged `needsPriceConfirmation` and renders "confirm price" in the
 *     review step — never silently zero-priced.
 *
 * Image-input note: the provider abstraction (AiProvider.chat completions) is
 * text-only — flyer-image extraction needs a multimodal request shape the
 * interface doesn't expose yet. The merchant-facing path is brief → draft;
 * the WhatsApp artwork remains a manual upload for hero_image_url.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import aiProviderFactory from './ai-providers/AiProviderFactory';
import {
  flyerExtractionOutputSchema,
  type FlyerExtractionOutput,
} from '../validators/flyer-extraction.schema';

export interface FlyerDraftItem extends FlyerExtractionOutput {
  dishes: Array<FlyerExtractionOutput['dishes'][number] & {
    /** true when no price was parsed and no repertoire default exists —
     *  the review step must render "confirm price" (never auto-zero). */
    needsPriceConfirmation: boolean;
    /** provenance for the review step: agent | repertoire_history | none */
    priceSource: 'agent' | 'repertoire_history' | 'none';
  }>;
}

const SYSTEM_PROMPT = `You are an extraction engine for retail flyer specials. The merchant describes their specials in free text; you return ONLY a JSON object — no markdown, no code fences, no commentary.

Output shape:
{
  "title": "<flyer title, e.g. 'This Week's Specials'>",
  "summary": "<1-2 sentence summary or null>",
  "dishes": [
    {
      "name": "<item name>",
      "priceCents": <integer cents, e.g. 1400 for $14 — or null if no price is stated>,
      "salePriceCents": <integer cents or null>,
      "stock": <integer or null>,
      "attributes": ["<dietary/portion tags: vegan, gluten-free, family-size, …>"],
      "note": "<short qualifier, e.g. 'serves 2' — max 12 words or null>"
    }
  ],
  "suggestedWindow": "today" | "this_weekend" | "this_week" | "custom"
}

HARD RULES:
- NEVER invent a price. If the brief doesn't state a price for an item, emit "priceCents": null — the system fills it from history or flags it for the merchant.
- Prices are integer cents: "$14" → 1400, "14.50" → 1450. A number that is already cents (>100 integer) stays as-is.
- Emit ONLY dishes the merchant described — never add items they didn't mention.
- Category-agnostic: a "dish" is any sellable item — food plate, plant, haircut, plumbing part. Keep the merchant's wording for names.
- suggestedWindow: infer from the brief ("friday" → this_weekend when today is Mon–Thu, else today; "this week" → this_week). Default "this_week" when unsure.`;

/**
 * Extract a structured flyer draft from a merchant brief.
 * Returns the validated draft with price-default resolution applied.
 */
export async function extractFlyerDraft(tenantId: string, brief: string): Promise<FlyerDraftItem> {
  const result = await aiProviderFactory.generateChatCompletion({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: brief.slice(0, 4000) },
    ],
    maxTokens: 1200,
    temperature: 0.2,
  });

  const raw = result.content.trim();
  let jsonText = raw;
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```(?:json)?\n?/g, '').replace(/```$/g, '').trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('extraction_invalid_json');
  }

  const validated = flyerExtractionOutputSchema.safeParse(parsed);
  if (!validated.success) {
    logger.warn('[FlyerExtraction] output failed schema validation', undefined, {
      tenantId,
      issues: validated.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`),
    });
    throw new Error('extraction_invalid_shape');
  }

  const draft = validated.data;

  // Price-default pass — repertoire history fills missing prices; dishes
  // with neither parsed price nor history are flagged for merchant review.
  const parents = await prisma.inventory_items.findMany({
    where: { tenant_id: tenantId, metadata: { path: ['flyer_special_parent'], equals: true } },
    select: { id: true },
  });
  const repertoire = parents.length
    ? await prisma.product_variants.findMany({
        where: { parent_item_id: { in: parents.map(p => p.id) } },
        orderBy: { updated_at: 'desc' },
        select: { variant_name: true, price_cents: true, sale_price_cents: true },
      })
    : [];

  const norm = (s: string) => s.trim().toLowerCase();
  const dishes = draft.dishes.map((dish) => {
    if (dish.priceCents != null) {
      return { ...dish, needsPriceConfirmation: false, priceSource: 'agent' as const };
    }
    const match = repertoire.find(v => norm(v.variant_name) === norm(dish.name));
    if (match?.price_cents != null) {
      return {
        ...dish,
        priceCents: match.price_cents,
        salePriceCents: dish.salePriceCents ?? match.sale_price_cents,
        needsPriceConfirmation: false,
        priceSource: 'repertoire_history' as const,
      };
    }
    return { ...dish, priceCents: null, needsPriceConfirmation: true, priceSource: 'none' as const };
  });

  return { ...draft, dishes };
}
