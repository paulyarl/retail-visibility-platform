"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Alert, Spinner } from "@/components/ui";
import BusinessProfileCard from "@/components/settings/BusinessProfileCard";
import MapCardSettings from "@/components/tenant/MapCardSettings";
import SwisPreviewSettings from "@/components/tenant/SwisPreviewSettings";
import GoogleConnectCard from "@/components/google/GoogleConnectCard";
import { isFeatureEnabled } from "@/lib/featureFlags";
import PageHeader, { Icons } from "@/components/PageHeader";

type Tenant = {
  id: string;
  name: string;
  region?: string;
  language?: string;
  currency?: string;
  data_policy_accepted?: boolean;
  metadata?: any; // Business profile data
};

export default function TenantSettingsPage() {
  const { t } = useTranslation();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRegional, setEditingRegional] = useState(false);
  const [savingRegional, setSavingRegional] = useState(false);
  const [regionalSettings, setRegionalSettings] = useState({
    region: '',
    language: '',
    currency: '',
  });

  useEffect(() => {
    const loadTenant = async () => {
      try {
        // Get tenantId from localStorage (same pattern as ItemsClient)
        const tenantId = typeof window !== "undefined" ? localStorage.getItem("tenantId") : null;
        if (!tenantId) {
          setError("No tenant selected. Please select a tenant first.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/tenants");
        const tenants: Tenant[] = await res.json();
        const found = tenants.find((t) => t.id === tenantId);
        
        if (found) {
          setTenant(found);
          setRegionalSettings({
            region: found.region || 'us-east-1',
            language: found.language || 'en-US',
            currency: found.currency || 'USD',
          });
        } else {
          setError("Tenant not found");
        }
      } catch (e) {
        setError("Failed to load tenant settings");
      } finally {
        setLoading(false);
      }
    };

    loadTenant();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="bg-white border-b border-neutral-200 dark:border-neutral-700 mb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{t('settings.tenant.title', 'Tenant Settings')}</h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" className="text-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="bg-white border-b border-neutral-200 dark:border-neutral-700 mb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">{t('settings.tenant.title', 'Tenant Settings')}</h1>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Alert variant="error" title="Error">
            {error || t('common.error', 'An error occurred')}
          </Alert>
          <div className="mt-4">
            <Link href="/tenants" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              ← Back to Tenants
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title={t('settings.tenant.title', 'Tenant Settings')}
        description={tenant.name}
        icon={Icons.Tenants}
        backLink={{
          href: '/tenants',
          label: 'Back to Tenants'
        }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Business Logo */}
        {tenant.metadata && (tenant.metadata as any).logo_url && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center">
                <img
                  src={(tenant.metadata as any).logo_url}
                  alt="Business Logo"
                  className="max-h-32 max-w-full object-contain"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tenant Information */}
        <Card>
          <CardHeader>
            <CardTitle>Tenant Information</CardTitle>
            <CardDescription>Basic information about your tenant</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-neutral-200 dark:border-neutral-700">
                <div>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Tenant ID</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Unique identifier for your tenant</p>
                </div>
                <Badge variant="default">{tenant.id}</Badge>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-neutral-200 dark:border-neutral-700">
                <div>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Tenant Name</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Display name for your organization</p>
                </div>
                <p className="text-sm font-medium text-neutral-900 dark:text-white">{tenant.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regional Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Regional Settings</CardTitle>
                <CardDescription>Location and localization preferences</CardDescription>
              </div>
              {!editingRegional && (
                <button
                  onClick={() => setEditingRegional(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Edit
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-neutral-200 dark:border-neutral-700">
                <div>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('settings.tenant.region', 'Region')}</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Data center location</p>
                </div>
                {editingRegional ? (
                  <select
                    value={regionalSettings.region}
                    onChange={(e) => setRegionalSettings({ ...regionalSettings, region: e.target.value })}
                    className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="us-east-1">US East (N. Virginia)</option>
                    <option value="us-west-2">US West (Oregon)</option>
                    <option value="eu-west-1">EU (Ireland)</option>
                    <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <Badge variant="info">{regionalSettings.region}</Badge>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-3 border-b border-neutral-200 dark:border-neutral-700">
                <div>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('settings.tenant.language', 'Language')}</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Preferred language for the interface</p>
                </div>
                {editingRegional ? (
                  <select
                    value={regionalSettings.language}
                    onChange={(e) => setRegionalSettings({ ...regionalSettings, language: e.target.value })}
                    className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Español (Spanish)</option>
                    <option value="fr-FR">Français (French)</option>
                    <option value="de-DE">Deutsch (German)</option>
                    <option value="zh-CN">简体中文 (Chinese Simplified)</option>
                    <option value="ja-JP">日本語 (Japanese)</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                    <Badge variant="default">{regionalSettings.language}</Badge>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('settings.tenant.currency', 'Currency')}</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Default currency for pricing</p>
                </div>
                {editingRegional ? (
                  <select
                    value={regionalSettings.currency}
                    onChange={(e) => setRegionalSettings({ ...regionalSettings, currency: e.target.value })}
                    className="px-3 py-1.5 border border-neutral-300 rounded-lg text-sm bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <Badge variant="success">{regionalSettings.currency}</Badge>
                  </div>
                )}
              </div>

              {editingRegional && (
                <div className="flex items-center gap-2 pt-4">
                  <button
                    onClick={async () => {
                      setSavingRegional(true);
                      try {
                        const response = await fetch(`/api/tenants/${tenant.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(regionalSettings),
                        });
                        if (!response.ok) throw new Error('Failed to update');
                        const updated = await response.json();
                        setTenant(updated);
                        setEditingRegional(false);
                      } catch (err) {
                        console.error('Failed to update regional settings:', err);
                        alert('Failed to save changes');
                      } finally {
                        setSavingRegional(false);
                      }
                    }}
                    disabled={savingRegional}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {savingRegional ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setRegionalSettings({
                        region: tenant.region || 'us-east-1',
                        language: tenant.language || 'en-US',
                        currency: tenant.currency || 'USD',
                      });
                      setEditingRegional(false);
                    }}
                    className="px-4 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Compliance */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance & Privacy</CardTitle>
            <CardDescription>Data policy and compliance settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('settings.tenant.dataPolicy', 'Data Policy Accepted')}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Terms and conditions acceptance status</p>
              </div>
              <div className="flex items-center gap-2">
                {tenant.data_policy_accepted ? (
                  <>
                    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <Badge variant="success">Accepted</Badge>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <Badge variant="warning">Pending</Badge>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Profile - Feature Flag: FF_BUSINESS_PROFILE */}
        {isFeatureEnabled('FF_BUSINESS_PROFILE', tenant.id, tenant.region) && (
          <BusinessProfileCard
            profile={tenant.metadata || null}
            loading={false}
            onUpdate={async (profile) => {
              try {
                const response = await fetch('/api/tenant/profile', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    tenant_id: tenant.id,
                    ...profile,
                  }),
                });

                if (!response.ok) {
                  throw new Error('Failed to update business profile');
                }

                const updatedTenant = await response.json();
                setTenant(updatedTenant);
              } catch (err) {
                console.error('Failed to update business profile:', err);
                throw err;
              }
            }}
          />
        )}

        {/* Map Settings - Feature Flag: FF_MAP_CARD */}
        {isFeatureEnabled('FF_MAP_CARD', tenant.id, tenant.region) && tenant.metadata && (
          <MapCardSettings
            businessProfile={{
              business_name: tenant.metadata.business_name || tenant.name,
              address_line1: tenant.metadata.address_line1 || '',
              address_line2: tenant.metadata.address_line2,
              city: tenant.metadata.city || '',
              state: tenant.metadata.state || '',
              postal_code: tenant.metadata.postal_code || '',
              country_code: tenant.metadata.country_code || 'US',
            }}
            displayMap={false} // TODO: Fetch from API
            privacyMode="precise" // TODO: Fetch from API
            onSave={async (settings) => {
              console.log('Map settings updated:', settings);
              // TODO: Implement API call
            }}
          />
        )}

        {/* SWIS Preview Settings - Feature Flag: FF_SWIS_PREVIEW */}
        {isFeatureEnabled('FF_SWIS_PREVIEW', tenant.id, tenant.region) && (
          <SwisPreviewSettings
            tenantId={tenant.id}
            enabled={false} // TODO: Fetch from API
            previewLimit={12} // TODO: Fetch from API
            sortOrder="updated_desc" // TODO: Fetch from API
            badgesEnabled={true} // TODO: Fetch from API
            onSave={async (settings) => {
              console.log('SWIS settings updated:', settings);
              // TODO: Implement API call
            }}
          />
        )}

        {/* Google Connect Suite - Feature Flag: FF_GOOGLE_CONNECT_SUITE */}
        {isFeatureEnabled('FF_GOOGLE_CONNECT_SUITE', tenant.id, tenant.region) && (
          <GoogleConnectCard
            tenantId={tenant.id}
            onConnect={() => {
              console.log('[TenantSettings] Google account connecting...');
            }}
            onDisconnect={() => {
              console.log('[TenantSettings] Google account disconnected');
            }}
          />
        )}

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle>Need Help?</CardTitle>
            <CardDescription>Resources and support</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <a href="#" className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors">
                <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">Documentation</p>
                  <p className="text-xs text-neutral-500">Learn more about tenant settings</p>
                </div>
              </a>
              <a href="#" className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 transition-colors">
                <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-white">Contact Support</p>
                  <p className="text-xs text-neutral-500">Get help from our team</p>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
