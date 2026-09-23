import type { LocationEnrichmentResponse } from '@/services/PlacesBrowsePublicService';

/**
 * Server-rendered location enrichment packet for the seed city shelf —
 * the same ('__location__', city, state) row /directory/location renders,
 * presented with the seed shelf's "listed from public information" framing.
 * Rendered in page.tsx (outside the client's loading gate) so the copy is
 * crawler-visible without waiting for the listings fetch.
 */
export default function PlaceCityEnrichmentContent({
  enrichment,
  city,
  state,
}: {
  enrichment: LocationEnrichmentResponse;
  city: string;
  state: string | null;
}) {
  const locationName = state ? `${city}, ${state}` : city;
  const bodyCopy = enrichment.bodyCopy;
  const shopperGuide = enrichment.shopperGuide;
  const faq = enrichment.faq ?? [];
  const areaBreakdown = enrichment.areaBreakdown ?? [];
  const metroContext = enrichment.context?.metro_context;

  if (!bodyCopy && !shopperGuide && faq.length === 0 && areaBreakdown.length === 0 && !metroContext) {
    return null;
  }

  return (
    <div className="bg-neutral-100 border-t border-neutral-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        {bodyCopy && (
          <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              About {locationName}
            </h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{bodyCopy}</p>
          </section>
        )}

        {shopperGuide && (
          <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Shopping in {locationName}
            </h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{shopperGuide}</p>
          </section>
        )}

        {areaBreakdown.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Browse by Area
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {areaBreakdown.map((area, idx) => (
                <div key={idx} className="rounded-lg p-4 border border-gray-200 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-1">{area.area_name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{area.description}</p>
                  {area.strong_categories && area.strong_categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {area.strong_categories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white text-gray-700 border border-gray-200"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {metroContext && (
          <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Metro Area
            </h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{metroContext}</p>
          </section>
        )}

        {faq.length > 0 && (
          <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Frequently Asked Questions
            </h2>
            <div className="divide-y divide-gray-200">
              {faq.map((item, idx) => (
                <div key={idx} className="py-4 last:pb-0">
                  <h3 className="font-semibold text-gray-900 mb-1">{item.question}</h3>
                  <p className="text-gray-700 text-sm leading-relaxed">{item.answer}</p>
                </div>
              ))}
            </div>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'FAQPage',
                  mainEntity: faq.map((item) => ({
                    '@type': 'Question',
                    name: item.question,
                    acceptedAnswer: {
                      '@type': 'Answer',
                      text: item.answer,
                    },
                  })),
                }),
              }}
            />
          </section>
        )}
      </div>
    </div>
  );
}
