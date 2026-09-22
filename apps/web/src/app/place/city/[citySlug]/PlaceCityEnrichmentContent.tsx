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
    <div className="bg-gray-100 border-t">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="prose max-w-none">
          {bodyCopy && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                About {locationName}
              </h2>
              <p className="text-gray-700 mb-4 whitespace-pre-line">{bodyCopy}</p>
            </>
          )}
        </div>

        {shopperGuide && (
          <div className="mt-8 prose max-w-none">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Shopping in {locationName}
            </h2>
            <p className="text-gray-700 whitespace-pre-line">{shopperGuide}</p>
          </div>
        )}

        {areaBreakdown.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Browse by Area
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {areaBreakdown.map((area, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-1">{area.area_name}</h3>
                  <p className="text-sm text-gray-600 mb-2">{area.description}</p>
                  {area.strong_categories && area.strong_categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {area.strong_categories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {metroContext && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Metro Area
            </h2>
            <p className="text-gray-700 whitespace-pre-line">{metroContext}</p>
          </div>
        )}

        {faq.length > 0 && (
          <div className="mt-8 prose max-w-none">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {faq.map((item, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-1">{item.question}</h3>
                  <p className="text-gray-700 text-sm">{item.answer}</p>
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
          </div>
        )}
      </div>
    </div>
  );
}
