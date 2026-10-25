/**
 * TierInheritanceService — the runtime home of the tier graph.
 *
 * The capability resolver answers "what does this tenant have"; it has never
 * known "what should this tier have". Order, inheritance and closure lived only
 * as codebase assertions (shared/tier-contract.json, web TIER_HIERARCHY, the
 * contract suites), so the capability admin UI could empty a tier and nothing
 * objected — the web path still gated on the static copy while the API resolver
 * served the emptied rows.
 *
 * `tier_inheritance_edges` (migration 361) stores the graph. The resolver walks
 * it so a higher tier consumes its parents' capabilities *because of its
 * inheritance structure*, not because someone copied the rows down.
 *
 * Raw SQL rather than a Prisma model on purpose: the table ships via
 * apply-sql-file, so the service works before the client is regenerated.
 */
import { prisma } from '../prisma';
import { logger } from '../logger';

export interface InheritanceEdge {
  child_tier_key: string;
  parent_tier_key: string;
}

export interface TierInheritance {
  tierKey: string;
  sortOrder: number;
  price: number;
  parents: string[];
}

export class TierInheritanceError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'TierInheritanceError';
  }
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; edges: InheritanceEdge[] } | null = null;

/** Pure — every ancestor of `seeds` over `edges`, excluding the seeds. Exported for tests. */
export function computeClosure(edges: InheritanceEdge[], seeds: string[]): string[] {
  const parentsOf = new Map<string, string[]>();
  for (const { child_tier_key, parent_tier_key } of edges) {
    const list = parentsOf.get(child_tier_key);
    if (list) list.push(parent_tier_key);
    else parentsOf.set(child_tier_key, [parent_tier_key]);
  }

  // Seeds count as seen, so a cycle back to a seed can never re-enter the output.
  const seen = new Set<string>(seeds);
  const out = new Set<string>();
  const queue = [...seeds];
  while (queue.length) {
    const tier = queue.shift() as string;
    for (const parent of parentsOf.get(tier) ?? []) {
      if (seen.has(parent)) continue;
      seen.add(parent);
      out.add(parent);
      queue.push(parent);
    }
  }
  return [...out];
}

export function invalidateTierInheritanceCache(): void {
  cache = null;
}

export async function loadEdges(): Promise<InheritanceEdge[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.edges;
  try {
    const edges = await prisma.$queryRaw<InheritanceEdge[]>`
      SELECT child_tier_key, parent_tier_key
      FROM tier_inheritance_edges
      ORDER BY child_tier_key, parent_tier_key
    `;
    cache = { at: Date.now(), edges };
    return edges;
  } catch (error) {
    // Table missing (migration not applied) → no inheritance, never a crash.
    logger.warn('[TierInheritance] edges unavailable; resolving without inheritance', undefined, {
      error: { name: (error as Error)?.name || 'Error', message: String((error as Error)?.message || error) },
    });
    return [];
  }
}

/** Every ancestor of the given tiers, excluding the seeds themselves. */
export async function getTierClosure(tierKeys: string[]): Promise<string[]> {
  if (!tierKeys.length) return [];
  const edges = await loadEdges();
  return computeClosure(edges, tierKeys);
}

/**
 * Every tier with its inherited set, for the admin Inheritance tab.
 *
 * Lists ALL tiers (not just those with edges) so a tier with no inherited set is
 * visible as such rather than silently absent.
 */
export async function listInheritance(): Promise<TierInheritance[]> {
  const [tiers, edges] = await Promise.all([
    prisma.subscription_tiers_list.findMany({
      select: { tier_key: true, sort_order: true, price_monthly: true },
      orderBy: { sort_order: 'asc' },
    }),
    loadEdges(),
  ]);

  const byChild = new Map<string, string[]>();
  for (const { child_tier_key, parent_tier_key } of edges) {
    const list = byChild.get(child_tier_key);
    if (list) list.push(parent_tier_key);
    else byChild.set(child_tier_key, [parent_tier_key]);
  }

  return tiers.map((t) => ({
    tierKey: t.tier_key,
    sortOrder: t.sort_order,
    price: Number(t.price_monthly),
    parents: (byChild.get(t.tier_key) ?? []).sort(),
  }));
}

/**
 * Would linking `child` to `parents` close a loop?
 *
 * Price direction alone does not prevent this: two tiers at the same price
 * (google_only and discovery are both $29) may legally inherit from each other,
 * which would make their closures symmetric.
 */
export function wouldCreateCycle(edges: InheritanceEdge[], child: string, parents: string[]): boolean {
  const parentsOf = new Map<string, string[]>();
  for (const { child_tier_key, parent_tier_key } of edges) {
    const list = parentsOf.get(child_tier_key);
    if (list) list.push(parent_tier_key);
    else parentsOf.set(child_tier_key, [parent_tier_key]);
  }

  const seen = new Set<string>();
  const queue = [...parents];
  while (queue.length) {
    const tier = queue.shift() as string;
    if (tier === child) return true;
    if (seen.has(tier)) continue;
    seen.add(tier);
    for (const parent of parentsOf.get(tier) ?? []) queue.push(parent);
  }
  return false;
}

/**
 * Replace a tier's inherited set.
 *
 * **Direction is enforced**: a tier may only inherit from tiers that sit BELOW
 * it (lower `sort_order`). A tier exists to be an upgrade over the ones beneath
 * it, so an emptied tier must fall back to its immediate lower tier — never
 * reach upward and act like a more expensive tier it didn't pay for.
 */
export async function setTierParents(childTierKey: string, parents: string[]): Promise<TierInheritance[]> {
  const clean = [...new Set(parents.map((p) => p.trim()).filter((p) => p && p !== childTierKey))];

  const rows = await prisma.subscription_tiers_list.findMany({
    where: { tier_key: { in: [childTierKey, ...clean] } },
    select: { tier_key: true, price_monthly: true },
  });
  const child = rows.find((r) => r.tier_key === childTierKey);
  if (!child) throw new TierInheritanceError('tier_not_found', `unknown tier: ${childTierKey}`);

  // Direction is measured in PRICE, not sort_order: the chain ladder carries
  // lower sort_orders than the retail ladder it mirrors (chain_professional is
  // sort 8 at $1,999, inheriting professional at sort 70 / $199), so ordering
  // by sort would reject every legitimate chain edge.
  const childPrice = Number(child.price_monthly);
  for (const parent of clean) {
    const row = rows.find((r) => r.tier_key === parent);
    if (!row) throw new TierInheritanceError('unknown_parent_tiers', `unknown tier: ${parent}`);
    if (Number(row.price_monthly) > childPrice) {
      throw new TierInheritanceError(
        'inheritance_direction',
        `${childTierKey} ($${childPrice}) may only inherit from tiers that cost no more — ${parent} ($${Number(row.price_monthly)}) does`,
      );
    }
  }

  const existing = (await loadEdges()).filter((e) => e.child_tier_key !== childTierKey);
  if (wouldCreateCycle(existing, childTierKey, clean)) {
    throw new TierInheritanceError(
      'inheritance_cycle',
      `${childTierKey} would end up inheriting from itself through ${clean.join(', ')}`,
    );
  }

  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM tier_inheritance_edges WHERE child_tier_key = ${childTierKey}`,
    ...clean.map(
      (parent) => prisma.$executeRaw`
        INSERT INTO tier_inheritance_edges (child_tier_key, parent_tier_key)
        VALUES (${childTierKey}, ${parent})
        ON CONFLICT (child_tier_key, parent_tier_key) DO NOTHING
      `,
    ),
  ]);

  invalidateTierInheritanceCache();
  return listInheritance();
}
