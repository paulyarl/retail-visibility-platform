import type { PlaceListing } from '@/services/PlacesBrowsePublicService';

/**
 * Server-rendered crawl index for `/place` (spec §4.4.2).
 *
 * The category grid above it links shelves; this block links the listings
 * themselves and every city shelf, so detail pages have inbound links that do
 * not depend on JS. Plain <a> tags (not next/link) keep it provider-free and
 * fully present in the first HTML response. `<details>` keeps the A–Z list
 * collapsed visually while leaving every anchor in the DOM — crawlers still
 * follow them.
 */

/** Hard ceiling on server-rendered detail links — beyond this, paginate. */
export const MAX_INDEXED_PLACE_LINKS = 500;

export interface PlacesIndexCityLink {
  label: string;
  href: string;
}

interface PlacesIndexDirectoryProps {
  cities: PlacesIndexCityLink[];
  places: PlaceListing[];
}

export default function PlacesIndexDirectory({ cities, places }: PlacesIndexDirectoryProps) {
  const listed = places.slice(0, MAX_INDEXED_PLACE_LINKS);

  if (cities.length === 0 && listed.length === 0) return null;

  return (
    <section
      aria-labelledby="places-index-heading"
      className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16"
    >
      <div className="rounded-xl border border-neutral-200 bg-white p-6 sm:p-8">
        <h2 id="places-index-heading" className="text-lg font-semibold text-neutral-900">
          Browse every place
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Every published listing and every city shelf, in one place.
        </p>

        {cities.length > 0 && (
          <details className="mt-5" open>
            <summary className="cursor-pointer select-none text-sm font-medium text-neutral-800">
              Cities ({cities.length})
            </summary>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {cities.map((city) => (
                <li key={city.href}>
                  <a href={city.href} className="text-sm text-blue-700 hover:underline">
                    {city.label}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}

        {listed.length > 0 && (
          <details className="mt-5">
            <summary className="cursor-pointer select-none text-sm font-medium text-neutral-800">
              All places A–Z ({listed.length})
            </summary>
            <ul className="mt-3 columns-1 sm:columns-2 lg:columns-3 gap-6 text-sm">
              {listed.map((place) => (
                <li key={place.id} className="break-inside-avoid py-1">
                  <a
                    href={`/place/${place.slug}`}
                    className="text-neutral-700 hover:text-blue-700 hover:underline"
                  >
                    {place.businessName}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
