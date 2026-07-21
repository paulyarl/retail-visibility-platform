'use client';

import { useState, useEffect } from 'react';
import { useDirectoryListing } from '@/hooks/directory/useDirectoryListing';
import DirectoryCategorySelectorAdapter from './DirectoryCategorySelectorAdapter';
import DirectoryListingPreview from './DirectoryListingPreview';
import DirectoryStatusBadge from './DirectoryStatusBadge';
import DirectoryPhotoGallery from './DirectoryPhotoGallery';
import { Button } from '@mantine/core';
import { unifiedCapabilityService } from '@/services/UnifiedCapabilityService';
import { tenantDirectoryManagementService } from '@/services/TenantDirectoryManagementService';
import type { DirectoryEntryLayoutKey } from '@/services/CapabilityResolutionService';
import LayoutPreviewCarousel from './LayoutPreviewCarousel';
import {
  DIRECTORY_ENTRY_LAYOUT_META,
  DIRECTORY_ENTRY_LAYOUT_ORDER,
  getLayoutPreviewSlides,
} from '@/utils/directoryEntryLayouts';
import { clientLogger } from '@/lib/client-logger';
import { Card, CardContent } from '@/components/ui/Card';
import { SectionBadge } from '@/components/qr/SectionBadge';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';
import { Tag, LayoutTemplate, FileText, Image as ImageIcon, ToggleRight } from 'lucide-react';

interface DirectorySettingsPanelProps {
  tenantId: string;
}

export default function DirectorySettingsPanel({ tenantId }: DirectorySettingsPanelProps) {
  const { listing, loading, error, publish, unpublish, updateSettings, syncProfile } = useDirectoryListing(tenantId);
  
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [primaryCategory, setPrimaryCategory] = useState('');
  const [secondaryCategories, setSecondaryCategories] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [directoryEntryLayout, setDirectoryEntryLayout] = useState<DirectoryEntryLayoutKey>('classic');
  const [allowedLayouts, setAllowedLayouts] = useState<DirectoryEntryLayoutKey[]>(['classic']);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [layoutSaveMessage, setLayoutSaveMessage] = useState('');
  const [capState, setCapState] = useState<any>(null);
  const [rawSettings, setRawSettings] = useState<Record<string, any>>({});
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionSaveMessage, setSectionSaveMessage] = useState('');

  // Sync form state with listing data
  useEffect(() => {
    if (listing) {
      setSeoDescription(listing.seoDescription || '');
      setSeoKeywords(listing.seoKeywords || []);
      setPrimaryCategory(listing.primaryCategory || '');
      setSecondaryCategories(listing.secondaryCategories || []);
    }
  }, [listing]);

  // Fetch directory entry options for layout gating
  useEffect(() => {
    if (!tenantId) return;
    unifiedCapabilityService.getDirectoryEntryOptionsState(tenantId)
      .then((opts) => {
        if (opts?.effectiveLayout) {
          setDirectoryEntryLayout(opts.effectiveLayout);
        }
        if (opts?.allowedLayouts?.length) {
          setAllowedLayouts(opts.allowedLayouts);
        }
        setCapState(opts);
      })
      .catch((err) => {
        clientLogger.error('Error fetching directory entry options:', { detail: err });
      });
  }, [tenantId]);

  // Fetch raw merchant settings for section toggles
  useEffect(() => {
    if (!tenantId) return;
    tenantDirectoryManagementService.getDirectoryEntryOptions(tenantId)
      .then((settings) => {
        if (settings) setRawSettings(settings);
      })
      .catch((err) => clientLogger.error('Error fetching directory entry raw settings:', { detail: err }));
  }, [tenantId]);

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
      
      // Store the initial published state
      const wasPublished = listing?.isPublished || false;
      
      await publish();
      
      // Check if the listing actually became published
      // This is more reliable than checking the error state
      const isNowPublished = listing?.isPublished || false;
      
      if (!wasPublished && isNowPublished) {
        setSaveMessage('Listing published successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (err: any) {
      // This catch block is only for unexpected errors
      // Validation errors are handled by the hook and displayed via the error state
      const errorMessage = err?.message || 'Failed to publish listing';
      setSaveMessage(errorMessage);
      setTimeout(() => setSaveMessage(''), 5000);
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

  const handleSyncProfile = async () => {
    try {
      setIsSaving(true);
      setSaveMessage('');
      
      const result = await syncProfile();
      
      if (result.success) {
        setSaveMessage('Profile synced successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage(result.message || 'Failed to sync profile');
      }
    } catch (err) {
      setSaveMessage('Failed to sync profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLayout = async () => {
    try {
      setLayoutSaving(true);
      setLayoutSaveMessage('');
      
      await tenantDirectoryManagementService.updateDirectoryEntryOptions(tenantId, {
        directory_entry_layout: directoryEntryLayout,
      });

      // Invalidate frontend capability cache so public endpoints pick up changes
      await unifiedCapabilityService.invalidateTenantCapabilities(tenantId);
      await tenantDirectoryManagementService.invalidateCache(`directory-entry-options-${tenantId}`);
      
      setLayoutSaveMessage('Layout saved successfully!');
      setTimeout(() => setLayoutSaveMessage(''), 3000);
    } catch (err: any) {
      setLayoutSaveMessage(err?.message || 'Failed to save layout');
    } finally {
      setLayoutSaving(false);
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

  const toggleRaw = (key: string, value: boolean) => {
    setRawSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const setGalleryMode = (mode: 'carousel' | 'magazine') => {
    setRawSettings((prev: any) => ({ ...prev, gallery_display_mode: mode }));
  };

  const handleSaveSections = async () => {
    try {
      setSectionSaving(true);
      setSectionSaveMessage('');

      await tenantDirectoryManagementService.updateDirectoryEntryOptions(tenantId, {
        hours_display: rawSettings.hours_display,
        map_display: rawSettings.map_display,
        location_display: rawSettings.location_display,
        storefront_contact: rawSettings.storefront_contact,
        storefront_social_media: rawSettings.storefront_social_media,
        interactive_maps: rawSettings.interactive_maps,
        enhanced_seo: rawSettings.enhanced_seo,
        gallery_display_mode: rawSettings.gallery_display_mode || 'carousel',
        external_link_enabled: rawSettings.external_link_enabled,
      });

      // Invalidate frontend capability cache so public endpoints pick up changes
      await unifiedCapabilityService.invalidateTenantCapabilities(tenantId);
      await tenantDirectoryManagementService.invalidateCache(`directory-entry-options-${tenantId}`);

      setSectionSaveMessage('Sections saved successfully!');
      setTimeout(() => setSectionSaveMessage(''), 3000);
    } catch (err: any) {
      setSectionSaveMessage(err?.message || 'Failed to save sections');
    } finally {
      setSectionSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  // Don't return early for error - let the page render with error message inline
  // Only return early if there's no listing data at all

  if (!listing) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <p className="text-gray-600 dark:text-gray-300">No listing data available</p>
      </div>
    );
  }

  const canPublish = !!primaryCategory && !!listing.businessProfile?.businessName;
  
  // Determine what's blocking publication
  const missingBusinessName = !listing.businessProfile?.businessName;
  const missingPrimaryCategory = !primaryCategory;

  const enabledSectionCount = [
    rawSettings.hours_display,
    rawSettings.map_display,
    rawSettings.storefront_contact,
    rawSettings.location_display,
    rawSettings.interactive_maps,
    rawSettings.storefront_social_media,
    rawSettings.enhanced_seo,
    rawSettings.external_link_enabled,
  ].filter(Boolean).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
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
          <Card>
            <CardContent className="p-0">
              <Accordion type="multiple" defaultValue={["categories"]} className="w-full">

                {/* Section: Categories */}
                <AccordionItem value="categories" className="border-b">
                  <AccordionTrigger className="px-6 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Tag className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-neutral-900">Categories</span>
                      <SectionBadge>{primaryCategory ? 'Set' : 'None'}</SectionBadge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6">
                    <DirectoryCategorySelectorAdapter
                      primary={primaryCategory}
                      secondary={secondaryCategories}
                      onPrimaryChange={setPrimaryCategory}
                      onSecondaryChange={setSecondaryCategories}
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* Section: Directory Page Layout */}
                <AccordionItem value="layout" className="border-b">
                  <AccordionTrigger className="px-6 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <LayoutTemplate className="h-5 w-5 text-purple-600" />
                      <span className="font-medium text-neutral-900">Page Layout</span>
                      <SectionBadge>{DIRECTORY_ENTRY_LAYOUT_META[directoryEntryLayout]?.label || 'Classic'}</SectionBadge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Choose how your directory listing page appears to visitors.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {DIRECTORY_ENTRY_LAYOUT_ORDER.map((layout) => {
                        const meta = DIRECTORY_ENTRY_LAYOUT_META[layout];
                        const isAllowed = allowedLayouts.includes(layout);
                        const isSelected = directoryEntryLayout === layout;
                        return (
                          <div
                            key={layout}
                            className={`relative rounded-xl border transition-all ${
                              isSelected
                                ? 'border-blue-500 ring-2 ring-blue-500/40'
                                : isAllowed
                                ? 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                : 'border-gray-100 dark:border-gray-700 opacity-60'
                            }`}
                          >
                            <button
                              type="button"
                              disabled={!isAllowed}
                              onClick={() => setDirectoryEntryLayout(layout)}
                              aria-pressed={isSelected}
                              aria-label={`Select ${meta.label} layout`}
                              className={`block w-full text-left ${isAllowed ? '' : 'cursor-not-allowed'}`}
                            >
                              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-gray-100 dark:bg-gray-700">
                                <LayoutPreviewCarousel slides={getLayoutPreviewSlides(layout, meta.label)} icon={meta.icon} />
                                {isSelected && (
                                  <span className="absolute right-2 top-2 z-10 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <div className="p-3">
                                <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                                  {meta.label}
                                </span>
                                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                                  {meta.description}
                                </span>
                                {!isAllowed && (
                                  <span className="mt-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                    {meta.isPremium ? 'Upgrade for Premium' : 'Not included in your plan'}
                                  </span>
                                )}
                              </div>
                            </button>

                            {isAllowed && listing?.slug && (
                              <a
                                href={`/directory/${listing.slug}?layout_preview=${layout}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block border-t border-gray-100 dark:border-gray-700 px-3 py-2 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                              >
                                Preview in new tab →
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        type="button"
                        onClick={handleSaveLayout}
                        disabled={layoutSaving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {layoutSaving ? 'Saving...' : 'Save Layout'}
                      </button>
                      {layoutSaveMessage && (
                        <span className={`text-sm ${layoutSaveMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                          {layoutSaveMessage}
                        </span>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section: Description & Keywords */}
                <AccordionItem value="content" className="border-b">
                  <AccordionTrigger className="px-6 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-neutral-900">Description & Keywords</span>
                      <SectionBadge>{seoDescription.length}/500 · {seoKeywords.length}/10</SectionBadge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6">
                    <div className="space-y-4">
                      <div>
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
                      <div>
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
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section: Store Gallery */}
                <AccordionItem value="gallery" className="border-b">
                  <AccordionTrigger className="px-6 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <ImageIcon className="h-5 w-5 text-orange-600" />
                      <span className="font-medium text-neutral-900">Store Gallery</span>
                      <SectionBadge>{rawSettings.gallery_display_mode === 'magazine' ? 'Magazine' : 'Carousel'}</SectionBadge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Add up to 10 photos to showcase your business on the directory page
                    </p>
                    {listing && (
                      <DirectoryPhotoGallery
                        listing={listing}
                        tenantId={tenantId}
                        onUpdate={() => {
                          // Refresh the listing preview when photos change
                          // The useDirectoryListing hook should automatically refresh
                        }}
                      />
                    )}

                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                        Gallery Display Mode
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        Choose how photos are displayed on the directory page. This setting also applies to product page galleries.
                      </p>
                      <div className="space-y-2">
                        <button
                          onClick={() => setGalleryMode('carousel')}
                          className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                            (rawSettings.gallery_display_mode || 'carousel') === 'carousel'
                              ? 'bg-orange-600 text-white shadow-md'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            <div className={`w-4 h-4 rounded-full border-2 ${(rawSettings.gallery_display_mode || 'carousel') === 'carousel' ? 'border-white' : 'border-gray-400'} flex items-center justify-center`}>
                              {(rawSettings.gallery_display_mode || 'carousel') === 'carousel' && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                          </div>
                          <div>
                            <p className="font-medium">Carousel</p>
                            <p className={`text-sm ${(rawSettings.gallery_display_mode || 'carousel') === 'carousel' ? 'text-orange-100' : 'text-gray-500 dark:text-gray-400'}`}>
                              One image at a time with navigation. Classic controlled viewing.
                            </p>
                          </div>
                        </button>
                        <button
                          onClick={() => setGalleryMode('magazine')}
                          className={`w-full flex items-start gap-3 px-4 py-3 rounded-lg text-left transition-all ${
                            rawSettings.gallery_display_mode === 'magazine'
                              ? 'bg-rose-600 text-white shadow-md'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                          }`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            <div className={`w-4 h-4 rounded-full border-2 ${rawSettings.gallery_display_mode === 'magazine' ? 'border-white' : 'border-gray-400'} flex items-center justify-center`}>
                              {rawSettings.gallery_display_mode === 'magazine' && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                          </div>
                          <div>
                            <p className="font-medium">Magazine</p>
                            <p className={`text-sm ${rawSettings.gallery_display_mode === 'magazine' ? 'text-rose-100' : 'text-gray-500 dark:text-gray-400'}`}>
                              All images displayed at once in a magazine mosaic. Maximum visual impact.
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section: Directory Sections */}
                <AccordionItem value="sections" className="border-b-0">
                  <AccordionTrigger className="px-6 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <ToggleRight className="h-5 w-5 text-teal-600" />
                      <span className="font-medium text-neutral-900">Directory Sections</span>
                      <SectionBadge>{enabledSectionCount} on</SectionBadge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Choose which sections appear on your directory listing
                    </p>
                    <div className="space-y-3">
                      {/* Hours */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Hours</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Business hours display</p>
                        </div>
                        <label className={`relative inline-flex items-center ${!capState?.canShowHours ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={!!rawSettings.hours_display}
                            disabled={!capState?.canShowHours}
                            onChange={(e) => toggleRaw('hours_display', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      {/* Map */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Map</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Interactive location map</p>
                        </div>
                        <label className={`relative inline-flex items-center ${!capState?.canShowMap ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={!!rawSettings.map_display}
                            disabled={!capState?.canShowMap}
                            onChange={(e) => toggleRaw('map_display', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      {/* Contact */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Contact Info</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Phone, email, address</p>
                        </div>
                        <label className={`relative inline-flex items-center ${!capState?.canShowContact ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={!!rawSettings.storefront_contact}
                            disabled={!capState?.canShowContact}
                            onChange={(e) => toggleRaw('storefront_contact', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      {/* Location */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Location</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Show business address</p>
                        </div>
                        <label className={`relative inline-flex items-center ${!capState?.canShowMap ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={!!rawSettings.location_display}
                            disabled={!capState?.canShowMap}
                            onChange={(e) => toggleRaw('location_display', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      {/* Interactive Maps */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Interactive Map</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Embedded map widget</p>
                        </div>
                        <label className={`relative inline-flex items-center ${!capState?.canShowMap ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={!!rawSettings.interactive_maps}
                            disabled={!capState?.canShowMap}
                            onChange={(e) => toggleRaw('interactive_maps', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      {/* Social */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Social Media</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Links to social profiles</p>
                        </div>
                        <label className={`relative inline-flex items-center ${!capState?.canShowSocial ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={!!rawSettings.storefront_social_media}
                            disabled={!capState?.canShowSocial}
                            onChange={(e) => toggleRaw('storefront_social_media', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      {/* SEO */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">SEO</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Search engine optimization</p>
                        </div>
                        <label className={`relative inline-flex items-center ${!capState?.canShowSeo ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={!!rawSettings.enhanced_seo}
                            disabled={!capState?.canShowSeo}
                            onChange={(e) => toggleRaw('enhanced_seo', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                      {/* External Link */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">External Website Link</span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Allow directory cards to link to your website</p>
                        </div>
                        <label className={`relative inline-flex items-center ${!capState?.canShowExternalLink ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={!!rawSettings.external_link_enabled}
                            disabled={!capState?.canShowExternalLink}
                            onChange={(e) => toggleRaw('external_link_enabled', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={handleSaveSections}
                        disabled={sectionSaving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                      >
                        {sectionSaving ? 'Saving...' : 'Save Sections'}
                      </button>
                      {sectionSaveMessage && (
                        <span className={`text-sm ${sectionSaveMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                          {sectionSaveMessage}
                        </span>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

              </Accordion>
            </CardContent>
          </Card>

          {/* Profile Sync */}
          {listing.isPublished && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    Sync from Profile
                  </h4>
                  <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                    Update logo, business name, and contact info from your profile to the directory listing.
                  </p>
                </div>
                <button
                  onClick={handleSyncProfile}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isSaving ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              variant="gradient"
              style={{color:'white'}}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            {listing.isPublished ? (
              <Button
                onClick={handleUnpublish}
                disabled={isSaving}
                variant="gradient"
                style={{color:'white'}}
              >
                Unpublish
              </Button>
            ) : (
              <Button
                onClick={handlePublish}
                disabled={isSaving || !canPublish}
                variant="gradient"
                style={{color:'white'}}
                title={
                  !canPublish 
                    ? missingBusinessName && missingPrimaryCategory
                      ? 'Complete business profile and select primary category'
                      : missingBusinessName
                      ? 'Add business name in profile settings'
                      : 'Select a primary category'
                    : ''
                }
              >
                Publish
              </Button>
            )}
          </div>

          {/* Publication Requirements Alert */}
          {(!canPublish && !listing.isPublished) || error ? (
            <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 p-4 rounded-r-lg mt-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Complete these requirements to publish your listing
                  </h3>
                  <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                    <ul className="list-disc list-inside space-y-1">
                      {missingBusinessName && (
                        <li>
                          <strong>Business Name:</strong> Add your business name in{' '}
                          <a 
                            href={`/t/${tenantId}/settings/tenant`}
                            className="underline hover:text-amber-900 dark:hover:text-amber-100"
                          >
                            Business Profile Settings
                          </a>
                        </li>
                      )}
                      {missingPrimaryCategory && (
                        <li>
                          <strong>Primary Category:</strong> Select a primary category below
                        </li>
                      )}
                      {error && error.includes('city') && (
                        <li>
                          <strong>City & State:</strong> Add your business location in{' '}
                          <a 
                            href={`/t/${tenantId}/settings/tenant`}
                            className="underline hover:text-amber-900 dark:hover:text-amber-100"
                          >
                            Business Profile Settings
                          </a>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mt-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {saveMessage && (
            <p className={`text-sm ${saveMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
              {saveMessage}
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

      {/* Value Proposition Guide */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-xl p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Why Join the Directory? It's a Win-Win! 🎯
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              The directory creates a powerful network effect that benefits everyone in the community.
            </p>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {/* Be Discovered */}
              <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-indigo-100 dark:border-indigo-900">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">Be Discovered</h4>
                </div>
                <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Customers find you through location search</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Category filtering brings targeted traffic</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Build trust with ratings and reviews</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span>Increase foot traffic to your store</span>
                  </li>
                </ul>
              </div>

              {/* Discover Others */}
              <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-lg p-4 border border-purple-100 dark:border-purple-900">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">Discover Others</h4>
                </div>
                <ul className="space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">✓</span>
                    <span>Find complementary businesses nearby</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">✓</span>
                    <span>Explore partnership opportunities</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">✓</span>
                    <span>Learn from successful local stores</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-0.5">✓</span>
                    <span>Build community connections</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-4 text-white">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className="text-sm font-medium">
                  <strong>The more stores in the directory, the more customers discover the platform — and you!</strong> 
                  {' '}Every listing strengthens the network and brings more visibility to all merchants.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
