import Link from 'next/link';
import { MapPin, Phone, ArrowLeft, Info } from 'lucide-react';

/**
 * PlaceCard — minimal shopper-facing card for directory presence seeds
 * (unclaimed listings seeded from public information).
 *
 * Scope is intentionally bare: name, address, phone, claim CTA, and a
 * provenance disclaimer. We do not render hours, map, SNAP/EBT, products,
 * or other detail data for listings the business owner has not authorized.
 * Those surfaces light up after the owner claims the listing and upgrades.
 */
export interface PlaceCardProps {
  businessName: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  phone?: string | null;
  primaryCategory?: string | null;
  claimToken?: string | null;
  publicDisclaimer?: string | null;
  baseUrl: string;
  currentUrl: string;
}

export default function PlaceCard({
  businessName,
  address,
  city,
  state,
  zipCode,
  phone,
  primaryCategory,
  claimToken,
  publicDisclaimer,
  baseUrl,
  currentUrl,
}: PlaceCardProps) {
  const fullAddress = [address, city, state, zipCode].filter(Boolean).join(', ');
  const claimHref = claimToken ? `/directory/claim/${claimToken}` : '/directory';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/directory"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Directory
        </Link>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-8 sm:px-8 border-b border-gray-100">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {businessName}
            </h1>
            {primaryCategory && (
              <p className="mt-2 text-sm font-medium text-gray-500 uppercase tracking-wide">
                {primaryCategory}
              </p>
            )}
          </div>

          {/* NAP details */}
          <div className="px-6 py-6 sm:px-8 space-y-4">
            {fullAddress && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Address
                  </div>
                  <div className="text-gray-900 mt-0.5">{fullAddress}</div>
                </div>
              </div>
            )}

            {phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Phone
                  </div>
                  <a
                    href={`tel:${phone}`}
                    className="text-blue-600 hover:text-blue-700 mt-0.5 inline-block"
                  >
                    {phone}
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Claim CTA */}
          <div className="px-6 py-6 sm:px-8 bg-gray-50 border-t border-gray-100">
            <Link
              href={claimHref}
              className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              Are you the owner? Claim this listing
            </Link>
            <p className="mt-3 text-xs text-gray-500 text-center">
              Claiming is free and lets you update hours, add a photo, and verify your details.
            </p>
          </div>
        </div>

        {/* Provenance disclaimer */}
        <div className="mt-6 flex items-start gap-2 text-sm text-gray-500">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>
            {publicDisclaimer ||
              `${businessName} is listed from public information (address and phone). This is not a claimed profile and may be incomplete.`}
          </p>
        </div>
      </div>
    </div>
  );
}
