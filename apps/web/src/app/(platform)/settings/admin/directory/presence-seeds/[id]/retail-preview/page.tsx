'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, ExternalLink } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import directoryPresenceAdminService from '@/services/DirectoryPresenceAdminService';

interface RetailPreviewAdminPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Retail Preview Admin Controls — route stub.
 *
 * This page will house the operator controls for customizing the retail
 * preview page (/retail/{slug}?preview={token}) shown to business owners:
 *
 *   - Custom hero pitch message
 *   - Custom conversion benefits (instead of the hardcoded 3)
 *   - Section toggles (hero, map, contact, hours, QR, related stores)
 *   - Layout variant selection
 *   - Visual branding (hero/cover image, primary color, logo)
 *
 * The customized preview also applies to the future /local/{slug} "lite"
 * claimed directory presence page (sprint 1/2 goal).
 *
 * Path lifecycle:
 *   place  = unclaimed, public, foot in the door
 *   retail = private operator preview for the business owner
 *   local  = "lite" claimed directory presence (future)
 *   directory = converted platform tenant
 *
 * Storage: per-seed settings (new table or JSON column — TBD).
 *
 * Sprint: next
 */
export default function RetailPreviewAdminPage({ params }: RetailPreviewAdminPageProps) {
  const { id: seedId } = use(params);
  const [seed, setSeed] = useState<any>(null);
  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const detail = await directoryPresenceAdminService.getSeed(seedId);
        if (detail) {
          setSeed(detail.seed);
          setListing(detail.listing);
        }
      } catch {
        // ignore — stub page
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [seedId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  const slug = listing?.slug;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Customize Retail Preview"
        description={`Retail preview controls for ${listing?.business_name || seedId}`}
        backLink={{
          href: `/settings/admin/directory/presence-seeds/${seedId}`,
          label: 'Back to seed',
        }}
      />

      <div className="bg-white border border-gray-200 rounded-xl p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Retail Preview Customization</h2>
            <p className="text-sm text-gray-500">
              Operator controls for the private preview page shown to business owners.
              Customizations will also apply to the future /local/{'{slug}'} lite claimed
              directory presence page.
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-amber-900 mb-2">Coming Next Sprint</h3>
          <p className="text-sm text-amber-700 leading-relaxed">
            This page will house the full operator controls for the retail preview:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-amber-700">
            <li>• Custom hero pitch message</li>
            <li>• Custom conversion benefits (instead of the hardcoded 3)</li>
            <li>• Section toggles (hero, map, contact, hours, QR, related stores)</li>
            <li>• Layout variant selection</li>
            <li>• Visual branding (hero/cover image, primary color, logo)</li>
          </ul>
        </div>

        {slug && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Preview Links</h3>
            <div className="space-y-2">
              <Link
                href={`/place/${slug}`}
                target="_blank"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <ExternalLink className="w-4 h-4" /> View public place page (/place/{slug})
              </Link>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              The retail preview link (/retail/{slug}?preview={'{token}'}) is available
              after generating a claim invite on the seed detail page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
