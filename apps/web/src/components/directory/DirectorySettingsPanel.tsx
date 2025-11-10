'use client';

import { useState, useEffect } from 'react';
import { useDirectoryListing } from '@/hooks/directory/useDirectoryListing';
import DirectoryCategorySelector from './DirectoryCategorySelector';
import DirectoryListingPreview from './DirectoryListingPreview';
import DirectoryStatusBadge from './DirectoryStatusBadge';

interface DirectorySettingsPanelProps {
  tenantId: string;
}

export default function DirectorySettingsPanel({ tenantId }: DirectorySettingsPanelProps) {
  const { listing, loading, error, publish, unpublish, updateSettings } = useDirectoryListing(tenantId);
  
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [primaryCategory, setPrimaryCategory] = useState('');
  const [secondaryCategories, setSecondaryCategories] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Sync form state with listing data
  useEffect(() => {
    if (listing) {
      setSeoDescription(listing.seoDescription || '');
      setSeoKeywords(listing.seoKeywords || []);
      setPrimaryCategory(listing.primaryCategory || '');
      setSecondaryCategories(listing.secondaryCategories || []);
    }
  }, [listing]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setSaveMessage('');
      
      await updateSettings({
        seoDescription,
        seoKeywords,
        primaryCategory,
        secondaryCategories,
      });
      
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!primaryCategory) {
      setSaveMessage('Please select a primary category before publishing');
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage('');
      await publish();
      setSaveMessage('Listing published successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage('Failed to publish listing');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnpublish = async () => {
    try {
      setIsSaving(true);
      setSaveMessage('');
      await unpublish();
      setSaveMessage('Listing unpublished');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage('Failed to unpublish listing');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddKeyword = () => {
    const keyword = keywordInput.trim();
    if (keyword && !seoKeywords.includes(keyword) && seoKeywords.length < 10) {
      setSeoKeywords([...seoKeywords, keyword]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setSeoKeywords(seoKeywords.filter(k => k !== keyword));
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <p className="text-gray-600 dark:text-gray-300">No listing data available</p>
      </div>
    );
  }

  const canPublish = !!primaryCategory && !!listing.businessProfile?.businessName;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Directory Listing
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage how your business appears in the public directory
          </p>
        </div>
        <DirectoryStatusBadge
          isPublished={listing.isPublished}
          isFeatured={listing.isFeatured}
        />
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`p-4 rounded-lg ${
          saveMessage.includes('success') || saveMessage.includes('published')
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        }`}>
          {saveMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Settings Form */}
        <div className="space-y-6">
          {/* Categories */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Categories
            </h3>
            <DirectoryCategorySelector
              primaryCategory={primaryCategory}
              secondaryCategories={secondaryCategories}
              onPrimaryCategoryChange={setPrimaryCategory}
              onSecondaryCategoriesChange={setSecondaryCategories}
            />
          </div>

          {/* SEO Description */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Description
            </h3>
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={6}
              maxLength={500}
              placeholder="Describe your business, products, and services..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {seoDescription.length}/500 characters • Helps customers find you in search
            </p>
          </div>

          {/* Keywords */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Keywords
            </h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                placeholder="Add keyword..."
                maxLength={30}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddKeyword}
                disabled={!keywordInput.trim() || seoKeywords.length >= 10}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {seoKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {seoKeywords.length}/10 keywords • Used for search optimization
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            {listing.isPublished ? (
              <button
                onClick={handleUnpublish}
                disabled={isSaving}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Unpublish
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={isSaving || !canPublish}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!canPublish ? 'Select a primary category to publish' : ''}
              >
                Publish
              </button>
            )}
          </div>

          {!canPublish && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              ⚠️ Complete your business profile and select a primary category to publish
            </p>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Preview
            </h3>
            <DirectoryListingPreview listing={listing} />
          </div>

          {/* Public Link */}
          {listing.isPublished && listing.slug && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                Your listing is live!
              </p>
              <a
                href={`/directory/${listing.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                View in directory →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
