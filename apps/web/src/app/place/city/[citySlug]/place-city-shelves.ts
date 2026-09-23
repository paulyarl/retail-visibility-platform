/**
 * Seed city shelf grouping — splits each shelf's members into the businesses
 * seen for the first time on that shelf (`fresh`, rendered as full cards) and
 * those already carded on an earlier shelf (`repeats`, rendered as compact
 * rows). A business lands in its primary shelf group AND each secondary shelf
 * group (spec §3.1 — each group is a legitimate shelf), so without this split a
 * multi-shelf business repeats as N identical cards.
 *
 * Pure — exported so the dedupe contract is unit-testable without rendering.
 */
export interface ShelfSection<T> {
  category: string;
  slug: string;
  iconEmoji: string | null;
  places: T[];
  fresh: T[];
  repeats: T[];
}

export function buildShelfSections<T extends { id: string }>(
  categories: Array<{ category: string; slug: string; iconEmoji: string | null; places: T[] }>,
): ShelfSection<T>[] {
  const seen = new Set<string>();
  return categories.map((cat) => {
    const fresh: T[] = [];
    const repeats: T[] = [];
    for (const place of cat.places) {
      if (seen.has(place.id)) repeats.push(place);
      else {
        seen.add(place.id);
        fresh.push(place);
      }
    }
    return { ...cat, fresh, repeats };
  });
}
