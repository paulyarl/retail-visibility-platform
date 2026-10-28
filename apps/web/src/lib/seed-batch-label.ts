/**
 * Human label for a seed-batch cohort.
 *
 * Seed batches are labels, not entities — the stored value is a convention
 * slug (`pg-<campaign>-<yyyymmdd>` for proving grounds, `from-campaign-<id>`
 * for campaign births). In a selector a wall of those slugs is unreadable, so
 * the label leads with the facts that identify the cohort: when it was born,
 * which shelf it stocks, and where. The raw slug stays available (option
 * `title`, table caption) for anyone who needs to correlate it with logs.
 */

export interface SeedBatchLabelInput {
  seedBatch: string;
  /** Earliest seed created_at (ISO) — the cohort's birth date. */
  createdAt?: string | null;
  seedCount?: number | null;
  /** Dominant shelf in the cohort (or any single representative). */
  category?: string | null;
  /** Distinct shelves — the surplus collapses to "+N". */
  categoryCount?: number | null;
  /** Dominant "City, ST" (or a bare city) in the cohort. */
  place?: string | null;
  /** Distinct places — the surplus collapses to "+N". */
  placeCount?: number | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** `pg-…-20261028` embeds the cohort date — fallback when created_at is absent. */
function dateFromLabel(label: string): string | null {
  const m = label.match(/-(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${MONTHS[month - 1]} ${day}`;
}

function collapse(value?: string | null, count?: number | null): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  return typeof count === 'number' && count > 1 ? `${trimmed} +${count - 1}` : trimmed;
}

/**
 * `Oct 28 · African Grocery Store · Kansas City, MO · 10 seeds`
 *
 * Falls back to the raw slug when nothing else is known, so a legacy batch
 * never renders as an empty option. `includePgTag` appends "PG" for plain-text
 * surfaces (`<option>`); tables that render a badge leave it off.
 */
export function seedBatchDisplayLabel(
  input: SeedBatchLabelInput,
  opts?: { includePgTag?: boolean },
): string {
  const parts: string[] = [];
  const date = shortDate(input.createdAt) ?? dateFromLabel(input.seedBatch);
  if (date) parts.push(date);

  const category = collapse(input.category, input.categoryCount);
  if (category) parts.push(category);

  const place = collapse(input.place, input.placeCount);
  if (place) parts.push(place);

  if (typeof input.seedCount === 'number' && input.seedCount > 0) {
    parts.push(`${input.seedCount} seed${input.seedCount === 1 ? '' : 's'}`);
  }

  if (opts?.includePgTag && input.seedBatch.startsWith('pg-')) parts.push('PG');

  return parts.length > 0 ? parts.join(' · ') : input.seedBatch;
}
