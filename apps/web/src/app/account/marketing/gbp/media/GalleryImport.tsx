'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon, Upload, AlertCircle } from 'lucide-react';
import marketingCustomerService, { GbpGalleryAsset } from '@/services/MarketingCustomerService';

const PUBLISH_CATEGORIES = ['COVER', 'PROFILE', 'EXTERIOR', 'INTERIOR', 'PRODUCT', 'AT_WORK', 'FOOD_AND_DRINK', 'ADDITIONAL'];

interface GalleryImportProps {
  onPublished: () => void;
}

/**
 * Gallery Import — one-click handoff of Diagnostic Gallery deliverable
 * images to live GBP media (Spec §4 Subsystem 4).
 *
 * Lists the merchant's diagnostic gallery screenshots (from their claimed
 * GBP campaign) and publishes a selected image to GBP via the
 * /media/from-gallery endpoint.
 */
export function GalleryImport({ onPublished }: GalleryImportProps) {
  const [assets, setAssets] = useState<GbpGalleryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [categoryById, setCategoryById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    marketingCustomerService
      .listGalleryAssets()
      .then((list) => {
        if (!cancelled) setAssets(list);
      })
      .catch(() => {
        // No gallery assets — section renders nothing
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || assets.length === 0) return null;

  const handlePublish = async (asset: GbpGalleryAsset) => {
    try {
      setPublishingId(asset.id);
      setError(null);
      await marketingCustomerService.publishGalleryAsset({
        fileId: asset.id,
        category: categoryById[asset.id] || 'ADDITIONAL',
        description: asset.fileName,
      });
      onPublished();
    } catch (err: any) {
      setError(err.message || 'Failed to publish to GBP');
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-1">
        <ImageIcon className="w-4 h-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">From Your Diagnostic Gallery</h2>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Publish deliverable images from your diagnostic gallery directly to your Google Business Profile.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 flex items-start gap-2 text-sm mb-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {assets.map((asset) => (
          <div key={asset.id} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="aspect-square">
              {asset.signedUrl ? (
                <img src={asset.signedUrl} alt={asset.fileName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-gray-300" />
                </div>
              )}
            </div>
            <div className="p-2 space-y-2">
              <select
                value={categoryById[asset.id] || 'ADDITIONAL'}
                onChange={(e) => setCategoryById((prev) => ({ ...prev, [asset.id]: e.target.value }))}
                className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {PUBLISH_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handlePublish(asset)}
                disabled={!asset.signedUrl || publishingId !== null}
                className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-xs transition-colors"
              >
                <Upload className="w-3 h-3" />
                {publishingId === asset.id ? 'Publishing...' : 'Publish to GBP'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
