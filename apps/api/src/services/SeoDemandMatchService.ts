/**
 * Search demand classification (data-driven seeding, phase 2).
 *
 * Classifies every open seo_query_signals row into an intent (brand / store /
 * category / market), matches it to an existing listing, seed, campaign or
 * prospect, and assigns the route an operator acts on:
 *
 *   pitch_now       store has a campaign with an audit → evidence for the pain pitch
 *   audit_triage    store is seeded (or has a campaign) but no audit yet
 *   seed_signal     store-name demand with no seed → click to queue (search_batch)
 *   in_queue        store already sits in mkt_prospect_queue
 *   claimed_client  claimed listing → proof of value, no outreach
 *   seek_batch      category demand in a market → proposed seek batch
 *   category / market / brand / other
 *
 * Rows an operator has confirmed, rejected or queued keep their match.
 */
import { getDirectPool } from '../utils/db-pool';
import { logger } from '../logger';

const BRAND_RE = /\bvisible\s*shelf\b/;

// Words that describe a kind of store rather than a specific business.
const GENERIC = new Set([
  'the', 'and', 'of', 'a', 'an', 'in', 'at', 'on', 'for', 'to', 'near', 'me', 'my', 'nearby', 'best', 'open', 'now',
  'llc', 'inc', 'co', 'corp', 'company', 'ltd',
  'store', 'stores', 'market', 'markets', 'grocery', 'groceries', 'grocer', 'mart', 'shop', 'shops', 'food', 'foods',
  'supermarket', 'mall', 'general', 'local', 'business', 'businesses', 'restaurant', 'restaurants', 'takeout', 'deli',
  'butcher', 'meat', 'meats', 'halal', 'international', 'african', 'ethiopian', 'eritrean', 'habesha', 'somali',
  'asian', 'caribbean', 'jamaican', 'indian', 'pakistani', 'middle', 'eastern', 'mediterranean', 'arab', 'latin',
  'mexican', 'hispanic', 'world', 'ethnic', 'goods', 'products', 'items', 'hours', 'address', 'phone',
]);

// Ordered most-specific first; first hit wins.
const CATEGORY_RULES: Array<{ re: RegExp; category: string }> = [
  { re: /\bhalal\s+(meat|butcher)/, category: 'Halal Meat Market' },
  { re: /\bhalal\b/, category: 'Halal Grocery Store' },
  { re: /\b(ethiopian|eritrean|habesha)\b/, category: 'Ethiopian Grocery Store' },
  { re: /\b(african|somali|nigerian|ghanaian|kenyan|congolese)\b/, category: 'African Grocery Store' },
  { re: /\b(caribbean|jamaican|haitian|trinidad)/, category: 'Caribbean Grocery Store' },
  { re: /\b(indian|pakistani|desi|bangladeshi|nepali)\b/, category: 'Indian Grocery Store' },
  { re: /\b(middle eastern|arab|arabic|mediterranean|persian|turkish|lebanese)\b/, category: 'Middle Eastern Grocery Store' },
  { re: /\b(asian|chinese|korean|vietnamese|filipino|thai|japanese)\b/, category: 'Asian Grocery Store' },
  { re: /\b(international|world|ethnic|global)\s+(food|foods|grocery|groceries|market|store|stores)\b/, category: 'International Grocery Store' },
  { re: /\b(grocery|groceries|supermarket)\b/, category: 'Grocery Store' },
  { re: /\bgeneral store\b/, category: 'Store' },
];

interface StoreEntity {
  kind: 'listing' | 'campaign' | 'prospect';
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  seedId: string | null;
  claimed: boolean;
  campaignId: string | null;
  hasAudit: boolean;
  tokens: string[];
}

interface Market { city: string; state: string; re: RegExp; slug: string; weight: number }

interface SignalRow { query_norm: string; top_page: string | null }

export interface Classification {
  query_norm: string;
  intent: string;
  route: string | null;
  match_kind: string | null;
  match_id: string | null;
  match_name: string | null;
  match_confidence: number | null;
  seed_id: string | null;
  campaign_id: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
}

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const distinctive = (tokens: string[]) => tokens.filter((t) => !GENERIC.has(t) && t.length > 1);

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function pageSlug(page: string | null, prefix: RegExp): string | null {
  if (!page) return null;
  try {
    const m = new URL(page).pathname.match(prefix);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

async function loadEntities(): Promise<{ stores: StoreEntity[]; markets: Market[] }> {
  const pool = getDirectPool();
  const [listings, campaigns, prospects] = await Promise.all([
    pool.query(
      `SELECT l.id, l.business_name AS name, l.slug, l.city, l.state, l.primary_category AS category,
              l.listing_origin, s.id AS seed_id, s.status AS seed_status, s.claimed_at, s.name_variants,
              lk.campaign_id,
              EXISTS (SELECT 1 FROM mkt_audits_list a WHERE a.campaign_id = lk.campaign_id) AS has_audit
       FROM directory_listings_list l
       LEFT JOIN LATERAL (
         SELECT * FROM directory_presence_seeds s WHERE s.listing_id = l.id
         ORDER BY (s.status = 'suppressed'), s.updated_at DESC LIMIT 1
       ) s ON true
       LEFT JOIN LATERAL (
         SELECT campaign_id FROM directory_seed_campaign_links k WHERE k.seed_id = s.id
         ORDER BY k.updated_at DESC LIMIT 1
       ) lk ON true`,
    ),
    pool.query(
      `SELECT c.id, coalesce(c.business_name, c.title) AS name, c.city, c.state, c.category,
              EXISTS (SELECT 1 FROM mkt_audits_list a WHERE a.campaign_id = c.id) AS has_audit
       FROM mkt_campaigns_list c
       WHERE coalesce(c.business_name, c.title) IS NOT NULL
         AND c.stage NOT IN ('dead', 'lost', 'closed', 'resolved_and_closed')
         AND NOT EXISTS (SELECT 1 FROM directory_seed_campaign_links k WHERE k.campaign_id = c.id)`,
    ),
    pool.query(
      `SELECT id, business_name AS name, city, state, category, seed_id, processed_campaign_id
       FROM mkt_prospect_queue
       WHERE business_name IS NOT NULL AND coalesce(status, '') <> 'dismissed'`,
    ),
  ]);

  const stores: StoreEntity[] = [];
  for (const r of listings.rows) {
    const variants: string[] = Array.isArray(r.name_variants) ? r.name_variants.filter((v: unknown) => typeof v === 'string') : [];
    for (const name of [r.name, ...variants]) {
      if (!name) continue;
      stores.push({
        kind: 'listing', id: r.id, name: r.name, slug: r.slug, city: r.city, state: r.state, category: r.category,
        seedId: r.seed_id, claimed: r.listing_origin === 'claimed' || !!r.claimed_at,
        campaignId: r.campaign_id, hasAudit: !!r.has_audit, tokens: tokenize(name),
      });
    }
  }
  for (const r of campaigns.rows) {
    stores.push({
      kind: 'campaign', id: r.id, name: r.name, slug: null, city: r.city, state: r.state, category: r.category,
      seedId: null, claimed: false, campaignId: r.id, hasAudit: !!r.has_audit, tokens: tokenize(r.name),
    });
  }
  for (const r of prospects.rows) {
    stores.push({
      kind: 'prospect', id: r.id, name: r.name, slug: null, city: r.city, state: r.state, category: r.category,
      seedId: r.seed_id, claimed: false, campaignId: r.processed_campaign_id, hasAudit: false, tokens: tokenize(r.name),
    });
  }

  const marketCounts = new Map<string, { city: string; state: string; weight: number }>();
  for (const s of stores) {
    if (!s.city || !s.state || s.kind !== 'listing') continue;
    const key = `${s.city.toLowerCase()}|${s.state.toUpperCase()}`;
    const m = marketCounts.get(key) || { city: s.city, state: s.state.toUpperCase(), weight: 0 };
    m.weight += 1;
    marketCounts.set(key, m);
  }
  const markets: Market[] = Array.from(marketCounts.values())
    .filter((m) => m.city.length > 2)
    .map((m) => ({
      ...m,
      slug: slugify(`${m.city}-${m.state}`),
      re: new RegExp(`\\b${escapeRe(m.city.toLowerCase())}\\b`),
    }))
    // Longest names first so "kansas city" wins over a shorter overlapping city.
    .sort((a, b) => b.city.length - a.city.length || b.weight - a.weight);

  return { stores, markets };
}

function matchMarket(query: string, topPage: string | null, markets: Market[]): Market | null {
  const hits = markets.filter((m) => m.re.test(query));
  if (hits.length) {
    const stateHit = hits.find((m) => new RegExp(`\\b${m.state.toLowerCase()}\\b`).test(query));
    return stateHit || hits[0];
  }
  const citySlug = pageSlug(topPage, /^\/place\/city\/([^/?#]+)/);
  return citySlug ? markets.find((m) => m.slug === citySlug) || null : null;
}

function scoreStore(qTokens: string[], qDistinct: string[], topSlug: string | null, s: StoreEntity): number {
  const nameDistinct = distinctive(s.tokens);
  if (!nameDistinct.length || !qDistinct.length) return 0;
  const qSet = new Set(qTokens);
  const nameHits = nameDistinct.filter((t) => qSet.has(t)).length;
  if (!nameHits) return 0;
  const nameSet = new Set(nameDistinct);
  const nameCoverage = nameHits / nameDistinct.length;
  const queryCoverage = qDistinct.filter((t) => nameSet.has(t)).length / qDistinct.length;
  const genericOverlap = s.tokens.some((t) => GENERIC.has(t) && qSet.has(t)) ? 1 : 0;
  let score = 0.55 * nameCoverage + 0.3 * queryCoverage + 0.15 * genericOverlap;
  // A single distinctive word ("royal") is weaker evidence than a full name.
  if (nameDistinct.length === 1 && !genericOverlap) score *= 0.8;
  if (topSlug && s.slug && topSlug === s.slug) score = Math.min(1, score + 0.25);
  return score;
}

const STORE_MATCH_MIN = 0.6;

function routeForStore(s: StoreEntity): string {
  if (s.claimed) return 'claimed_client';
  if (s.kind === 'prospect') return s.campaignId ? 'audit_triage' : 'in_queue';
  if (s.campaignId && s.hasAudit) return 'pitch_now';
  if (s.seedId || s.campaignId) return 'audit_triage';
  return 'seed_signal';
}

const KIND_RANK: Record<StoreEntity['kind'], number> = { listing: 0, campaign: 1, prospect: 2 };

export function classifyQuery(
  row: SignalRow,
  stores: StoreEntity[],
  markets: Market[],
): Classification {
  const q = row.query_norm;
  const base: Classification = {
    query_norm: q, intent: 'other', route: null, match_kind: null, match_id: null, match_name: null,
    match_confidence: null, seed_id: null, campaign_id: null, category: null, city: null, state: null,
  };

  if (BRAND_RE.test(q) || q === 'visibleshelf') {
    return { ...base, intent: 'brand', route: 'brand', match_kind: 'brand', match_name: 'VisibleShelf', match_confidence: 1 };
  }

  const market = matchMarket(q, row.top_page, markets);
  const category = CATEGORY_RULES.find((r) => r.re.test(q))?.category ?? null;
  const qTokens = tokenize(q);
  const marketTokens = new Set(market ? tokenize(`${market.city} ${market.state}`) : []);
  const qDistinct = distinctive(qTokens).filter((t) => !marketTokens.has(t));
  const topSlug = pageSlug(row.top_page, /^\/place\/(?!city\/|category\/|search|about|claim)([^/?#]+)/);

  let best: { s: StoreEntity; score: number } | null = null;
  if (qDistinct.length) {
    for (const s of stores) {
      let score = scoreStore(qTokens, qDistinct, topSlug, s);
      if (!score) continue;
      if (market && s.city && s.city.toLowerCase() !== market.city.toLowerCase()) score *= 0.85;
      if (
        !best || score > best.score + 1e-6
        || (Math.abs(score - best.score) <= 1e-6 && KIND_RANK[s.kind] < KIND_RANK[best.s.kind])
      ) {
        best = { s, score };
      }
    }
  }

  if (best && best.score >= STORE_MATCH_MIN) {
    const s = best.s;
    return {
      ...base,
      intent: 'store',
      route: routeForStore(s),
      match_kind: s.kind,
      match_id: s.id,
      match_name: s.name,
      match_confidence: Math.round(best.score * 1000) / 1000,
      seed_id: s.seedId,
      campaign_id: s.campaignId,
      category: s.category || category,
      city: s.city || market?.city || null,
      state: s.state || market?.state || null,
    };
  }

  // Distinctive words plus a store-type word ("gomez african grocery",
  // "arsema store") read as a specific business we have not seeded.
  const hasStoreWord = qTokens.some((t) => GENERIC.has(t) && !['near', 'me', 'the', 'and', 'of', 'in', 'best', 'open', 'now'].includes(t));
  if (qDistinct.length && hasStoreWord) {
    return {
      ...base,
      intent: 'store',
      route: 'seed_signal',
      match_kind: 'unmatched',
      match_name: row.query_norm,
      match_confidence: best ? Math.round(best.score * 1000) / 1000 : null,
      category,
      city: market?.city ?? null,
      state: market?.state ?? null,
    };
  }

  if (category) {
    return {
      ...base,
      intent: market ? 'category_market' : 'category',
      route: market ? 'seek_batch' : 'category',
      category,
      city: market?.city ?? null,
      state: market?.state ?? null,
    };
  }
  if (market) {
    return { ...base, intent: 'market', route: 'market', city: market.city, state: market.state };
  }
  return base;
}

/** Re-classifies every open seo_query_signals row. Returns the number updated. */
export async function classifyQuerySignals(): Promise<number> {
  const pool = getDirectPool();
  const [{ stores, markets }, signals] = await Promise.all([
    loadEntities(),
    pool.query<SignalRow>(`SELECT query_norm, top_page FROM seo_query_signals WHERE review_status = 'open'`),
  ]);
  const results = signals.rows.map((r) => classifyQuery(r, stores, markets));
  const CHUNK = 1000;
  for (let i = 0; i < results.length; i += CHUNK) {
    const c = results.slice(i, i + CHUNK);
    await pool.query(
      `UPDATE seo_query_signals s SET
         intent = u.intent, route = u.route, match_kind = u.match_kind, match_id = u.match_id,
         match_name = u.match_name, match_confidence = u.match_confidence, seed_id = u.seed_id,
         campaign_id = u.campaign_id, category = u.category, city = u.city, state = u.state, updated_at = now()
       FROM unnest($1::text[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[], $6::text[],
                   $7::numeric[], $8::varchar[], $9::varchar[], $10::varchar[], $11::varchar[], $12::varchar[])
         AS u(query_norm, intent, route, match_kind, match_id, match_name, match_confidence, seed_id,
              campaign_id, category, city, state)
       WHERE s.query_norm = u.query_norm AND s.review_status = 'open'`,
      [
        c.map((r) => r.query_norm), c.map((r) => r.intent), c.map((r) => r.route), c.map((r) => r.match_kind),
        c.map((r) => r.match_id), c.map((r) => r.match_name), c.map((r) => r.match_confidence),
        c.map((r) => r.seed_id), c.map((r) => r.campaign_id), c.map((r) => r.category),
        c.map((r) => r.city), c.map((r) => r.state),
      ],
    );
  }
  logger.info('[SeoDemandMatch] Classified query signals', undefined, { count: results.length });
  return results.length;
}

export default { classifyQuerySignals, classifyQuery };
