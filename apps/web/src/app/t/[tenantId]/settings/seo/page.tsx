'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Input, Alert, Spinner, Textarea } from '@/components/ui';
import { Button } from '@mantine/core';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { tenantSeoService } from '@/services/TenantSeoService';
import { clientLogger } from '@/lib/client-logger';

export const dynamic = 'force-dynamic';

export default function SeoSettingsPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const { hasAccess, loading: accessLoading, tenantRole } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [seoTags, setSeoTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');

  const loadSeo = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await tenantSeoService.getSeoSettings(tenantId);

      if (data) {
        setSeoTags(data.seo_tags || []);
        setSeoDescription(data.seo_description || '');
        setSeoKeywords(data.seo_keywords || []);
      }
    } catch (err) {
      clientLogger.error('Failed to load SEO settings:', { detail: err });
      setError('Failed to load SEO settings');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (hasAccess) {
      loadSeo();
    }
  }, [hasAccess, loadSeo]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || seoTags.includes(tag)) {
      setTagInput('');
      return;
    }
    setSeoTags([...seoTags, tag]);
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setSeoTags(seoTags.filter((t) => t !== tag));
  };

  const handleAddKeyword = () => {
    const kw = keywordInput.trim().toLowerCase();
    if (!kw || seoKeywords.includes(kw)) {
      setKeywordInput('');
      return;
    }
    if (seoKeywords.length >= 10) {
      setError('Maximum 10 directory keywords allowed');
      return;
    }
    setSeoKeywords([...seoKeywords, kw]);
    setKeywordInput('');
  };

  const handleRemoveKeyword = (kw: string) => {
    setSeoKeywords(seoKeywords.filter((k) => k !== kw));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const ok = await tenantSeoService.updateSeoSettings(tenantId, {
        seo_tags: seoTags,
        seo_description: seoDescription,
        seo_keywords: seoKeywords,
      });

      if (!ok) {
        throw new Error('Failed to save SEO settings');
      }

      setSuccess('SEO settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      clientLogger.error('Save error:', { detail: err });
      setError(err.message || 'Failed to save SEO settings');
    } finally {
      setSaving(false);
    }
  };

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        title="Admin Access Required"
        message="You need tenant administrator privileges to manage SEO settings."
        userRole={tenantRole}
        backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Store SEO"
        description="Configure SEO metadata for your storefront and directory listing"
        icon={Icons.Settings}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <Alert variant="error">
            <p>{error}</p>
          </Alert>
        )}

        {success && (
          <Alert variant="success" title="Success!">
            <p>{success}</p>
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            {/* Directory SEO Description */}
            <Card>
              <CardHeader>
                <CardTitle>Directory Meta Description</CardTitle>
                <CardDescription>
                  A concise description of your store shown in directory search results and search engine snippets. Aim for 150-160 characters.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder="e.g. Family-owned grocery store offering fresh produce, organic foods, and household essentials in downtown Seattle."
                  rows={3}
                  maxLength={500}
                  disabled={loading}
                />
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  {seoDescription.length}/500 characters
                  {seoDescription.length > 0 && seoDescription.length < 100 && (
                    <span className="text-amber-600 ml-2">- Consider adding more detail (100+ characters recommended)</span>
                  )}
                </p>
              </CardContent>
            </Card>

            {/* Directory SEO Keywords */}
            <Card>
              <CardHeader>
                <CardTitle>Directory Keywords</CardTitle>
                <CardDescription>
                  Keywords that help customers find your store in the directory search. Maximum 10 keywords.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    placeholder="Type a keyword and press Enter"
                    disabled={seoKeywords.length >= 10}
                  />
                  <Button
                    variant="secondary"
                    onClick={handleAddKeyword}
                    disabled={!keywordInput.trim() || seoKeywords.length >= 10}
                  >
                    Add
                  </Button>
                </div>
                {seoKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {seoKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        {kw}
                        <button
                          onClick={() => handleRemoveKeyword(kw)}
                          className="ml-1 text-blue-500 hover:text-blue-700"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {seoKeywords.length}/10 keywords
                </p>
              </CardContent>
            </Card>

            {/* Business Profile SEO Tags */}
            <Card>
              <CardHeader>
                <CardTitle>Business Profile Tags</CardTitle>
                <CardDescription>
                  Tags that describe your business for search and discovery. These appear in your business profile schema markup.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Type a tag and press Enter"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleAddTag}
                    disabled={!tagInput.trim()}
                  >
                    Add
                  </Button>
                </div>
                {seoTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {seoTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      >
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 text-green-500 hover:text-green-700"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Schema Markup Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Schema Markup Preview</CardTitle>
                <CardDescription>
                  JSON-LD structured data generated from your business profile for search engines.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 text-xs overflow-auto max-h-64">
                  <code>{JSON.stringify({
                    '@context': 'https://schema.org',
                    '@type': 'LocalBusiness',
                    keywords: seoTags.length > 0 ? seoTags : undefined,
                    description: seoDescription || undefined,
                  }, null, 2)}</code>
                </pre>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                style={{ color: 'white' }}
                onClick={loadSeo}
                disabled={loading || saving}
              >
                Reset
              </Button>
              <Button
                onClick={handleSave}
                variant="filled"
                style={{ color: 'white' }}
                disabled={loading || saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
