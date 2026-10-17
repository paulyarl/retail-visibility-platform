/**
 * Flyer Extraction Output Schema (spec §7a.1)
 *
 * Shape of the agent-drafted flyer returned by the extraction pass. The output
 * is a DRAFT — the composer opens it prefilled for merchant review; nothing is
 * persisted until the merchant confirms (draft-then-confirm is mandatory).
 *
 * The schema is passthrough-tolerant like the other extraction schemas so
 * minor agent additions don't fail validation, while the required draft
 * structure stays enforced.
 */

import { z } from 'zod';

/** Coerce "$14", "14", 14, 14.00 to integer cents. Returns null when absent. */
const priceCentsCoerced = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,\s]/g, '');
    const n = Number(cleaned);
    if (Number.isNaN(n)) return null;
    return cleaned.includes('.') ? Math.round(n * 100) : n;
  }
  if (typeof val === 'number') {
    return Number.isInteger(val) && val > 100 ? val : Math.round(val * 100);
  }
  return null;
}, z.number().int().min(0).nullable());

/**
 * A drafted dish/special. `priceCents` may be null — the price-default pass
 * fills it from the tenant's repertoire history or flags it for merchant
 * confirmation. The agent is instructed NEVER to invent a price.
 */
export const flyerDraftDishSchema = z.object({
  name: z.string().min(1).max(160),
  priceCents: priceCentsCoerced.optional(),
  salePriceCents: priceCentsCoerced.optional(),
  stock: z.coerce.number().int().min(0).nullish(),
  attributes: z.array(z.string().max(40)).max(8).nullish(),
  note: z.string().max(120).nullish(),
}).passthrough();

export type FlyerDraftDish = z.infer<typeof flyerDraftDishSchema>;

const suggestedWindowEnum = z.enum(['today', 'this_weekend', 'this_week', 'custom']);

export const flyerExtractionOutputSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().max(2000).nullish(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  dishes: z.array(flyerDraftDishSchema).min(1).max(20),
  suggestedWindow: suggestedWindowEnum.optional(),
}).passthrough();

export type FlyerExtractionOutput = z.infer<typeof flyerExtractionOutputSchema>;
export type FlyerDraftSuggestedWindow = z.infer<typeof suggestedWindowEnum>;
