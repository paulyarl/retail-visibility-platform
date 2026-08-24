'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, Upload, Image as ImageIcon, TrendingUp, Target } from 'lucide-react';
import marketingCustomerService, {
  GbpMediaItem,
  GbpMediaListResponse,
} from '@/services/MarketingCustomerService';
import { MediaUploader } from './MediaUploader';
import { GalleryImport } from './GalleryImport';

const categoryLabels: Record<string, string> = {
  COVER: 'Cover Photos',
  PROFILE: 'Profile Photos',
  LOGO: 'Logos',
  EXTERIOR: 'Exterior',
  INTERIOR: 'Interior',
  PRODUCT: 'Products',
  AT_WORK: 'At Work',
  FOOD_AND_DRINK: 'Food & Drink',
  MENU: 'Menus',
  COMMON_AREA: 'Common Areas',
  ROOMS: 'Rooms',
  TEAMS: 'Team',
  ADDITIONAL: 'Additional',
};

const categoryOrder = ['COVER', 'EXTERIOR', 'INTERIOR', 'PRODUCT', 'FOOD_AND_DRINK', 'MENU', 'TEAM', 'ADDITIONAL'];

export default function GbpMediaPage() {
  const [data, setData] = useState<GbpMediaListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      const result = await marketingCustomerService.listMedia();
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleUploaded = async () => {
    setShowUploader(false);
    await loadMedia();
  };

  // Group media by category
  const mediaByCategory = (data?.media || []).reduce((acc, item) => {
    const category = item.locationAssociation?.category || 'ADDITIONAL';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, GbpMediaItem[]>);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            {error}
            <button onClick={() => { setError(null); loadMedia(); }} className="ml-2 underline text-sm">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Media</h1>
          <p className="text-sm text-gray-500 mt-1">Manage photos on your Google Business Profile</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadMedia} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowUploader(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Photo
          </button>
        </div>
      </div>

      {/* Gold Standard Benchmark */}
      {data?.benchmark && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Gold Standard Benchmark</h2>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-gray-500">Your photos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.benchmark.currentPhotoCount}</p>
            </div>
            {data.benchmark.expectedPhotoCount !== null && (
              <>
                <div className="text-gray-300">→</div>
                <div>
                  <p className="text-xs text-gray-500">Gold Standard target</p>
                  <p className="text-2xl font-bold text-blue-600">{data.benchmark.expectedPhotoCount}</p>
                </div>
                <div className="ml-auto">
                  {data.benchmark.currentPhotoCount >= data.benchmark.expectedPhotoCount ? (
                    <span className="inline-flex items-center gap-1 text-sm text-green-600">
                      <TrendingUp className="w-4 h-4" />
                      Meets benchmark
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-orange-600">
                      <Target className="w-4 h-4" />
                      {data.benchmark.expectedPhotoCount - data.benchmark.currentPhotoCount} more to reach benchmark
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Diagnostic Gallery handoff — publish deliverable images to GBP */}
      <GalleryImport onPublished={loadMedia} />

      {/* Media Gallery */}
      {data && data.media.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No photos yet. Click &quot;Upload Photo&quot; to add photos to your Google Business Profile.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categoryOrder
            .filter((cat) => mediaByCategory[cat])
            .map((category) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  {categoryLabels[category] || category}
                  <span className="ml-2 text-xs text-gray-400">({mediaByCategory[category].length})</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {mediaByCategory[category].map((item, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      {item.sourceUrl ? (
                        <img src={item.sourceUrl} alt={item.description || ''} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Media Uploader Modal */}
      {showUploader && (
        <MediaUploader onClose={() => setShowUploader(false)} onUploaded={handleUploaded} />
      )}
    </div>
  );
}
