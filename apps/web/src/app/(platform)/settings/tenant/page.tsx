"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/useTranslation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Alert, Spinner, Modal, ModalFooter, Button } from "@/components/ui";
import BusinessProfileCard from "@/components/settings/BusinessProfileCard";
import GBPCategoryCard from "@/components/settings/GBPCategoryCard";
import MapCardSettings from "@/components/tenant/MapCardSettings";
import SwisPreviewSettings from "@/components/tenant/SwisPreviewSettings";
import GoogleConnectCard from "@/components/google/GoogleConnectCard";
import { isFeatureEnabled } from "@/lib/featureFlags";
import PageHeader, { Icons } from "@/components/PageHeader";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getAdminEmail } from "@/lib/admin-emails";
import { BusinessProfile, geocodeAddress } from "@/lib/validation/businessProfile";

type Tenant = {
  id: string;
  name: string;
  region?: string;
  language?: string;
  currency?: string;
  data_policy_accepted?: boolean;
  metadata?: any; // Business profile data
  organization?: {
    id: string;
    name: string;
  } | null;
};

type Organization = {
  id: string;
  name: string;
};

export default function TenantSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);
  const [editingRegional, setEditingRegional] = useState(false);
  const [savingRegional, setSavingRegional] = useState(false);
  const [regionalSettings, setRegionalSettings] = useState({
    region: '',
    language: '',
    currency: '',
  });

  // Organization assignment state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [editingOrg, setEditingOrg] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [savingOrg, setSavingOrg] = useState(false);
  
  // Organization request state (for non-admin users)
  const [pendingRequest, setPendingRequest] = useState<any>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestNotes, setRequestNotes] = useState('');

  // Redirect to canonical tenant-scoped settings if a tenant is selected
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = localStorage.getItem('tenantId');
    const override = localStorage.getItem('ff_tenant_urls') === 'on';
    if (id && (override || true)) {
      // Prefer canonical route; this avoids duplicate settings variants
      window.location.replace(`/t/${encodeURIComponent(id)}/settings`);
    }
  }, []);

  useEffect(() => {
    const loadTenant = async () => {
      try {
        const res = await api.get("/api/tenants");
        const tenants: Tenant[] = await res.json();
        
        if (!tenants || tenants.length === 0) {
          setError("No tenants found. Please create a tenant first.");
          setLoading(false);
          return;
        }

        // Get tenantId from localStorage or use first tenant
        let tenantId = typeof window !== "undefined" ? localStorage.getItem("tenantId") : null;
        let found = tenants.find((t) => t.id === tenantId);
        
        // If no tenant selected or selected tenant not found, use first tenant
        if (!found) {
          found = tenants[0];
          if (typeof window !== "undefined") {
            localStorage.setItem("tenantId", found.id);
          }
        }
        
        setTenant(found);
        setRegionalSettings({
          region: found.region || 'us-east-1',
          language: found.language || 'en-US',
          currency: found.currency || 'USD',
        });
        setSelectedOrgId(found.organization?.id || '');
      } catch (e) {
        setError("Failed to load tenant settings");
      } finally {
        setLoading(false);
      }
    };

    const loadOrganizations = async () => {
      try {
        const res = await api.get("/api/organizations");
        const data = await res.json();
        setOrganizations(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load organizations:", e);
      }
    };

    const loadPendingRequest = async (tenantId: string) => {
      try {
        const res = await api.get(`/api/organization-requests?tenantId=${tenantId}&status=pending`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPendingRequest(data[0]);
        }
      } catch (e) {
        console.error("Failed to load pending request:", e);
      }
    };

    loadTenant();
    loadOrganizations();
    
    // Load pending request for non-admin users
    const tenantId = typeof window !== "undefined" ? localStorage.getItem("tenantId") : null;
    if (tenantId) {
      loadPendingRequest(tenantId);
    }
  }, []);

  // Load business profile once tenant is determined
  useEffect(() => {
    const fetchProfile = async () => {
      if (!tenant?.id) return;
      setProfileLoading(true);
      try {
        const res = await api.get(`/api/tenant/profile?tenant_id=${encodeURIComponent(tenant.id)}`);
        if (res.ok) {
          const data = await res.json();
          // Normalize potential camelCase payload from API to our BusinessProfile shape
          const normalized: BusinessProfile = {
            tenant_id: tenant.id,
            business_name: data.business_name ?? data.businessName ?? tenant.name,
            address_line1: data.address_line1 ?? data.addressLine1 ?? '',
            address_line2: data.address_line2 ?? data.addressLine2 ?? '',
            city: data.city ?? '',
            state: data.state ?? '',
            postal_code: data.postal_code ?? data.postalCode ?? '',
            country_code: data.country_code ?? data.countryCode ?? 'US',
            phone_number: data.phone_number ?? data.phoneNumber ?? '',
            email: data.email ?? '',
            website: data.website ?? '',
            contact_person: data.contact_person ?? data.contactPerson ?? '',
            logo_url: data.logo_url ?? data.logoUrl ?? (tenant.metadata as any)?.logo_url ?? '',
            business_description: data.business_description ?? '',
            hours: data.hours ?? undefined,
            social_links: data.social_links ?? undefined,
            seo_tags: data.seo_tags ?? undefined,
            latitude: data.latitude,
            longitude: data.longitude,
            // Map settings
            // @ts-ignore augmenting shape locally for UI wiring
            display_map: data.display_map ?? false,
            // @ts-ignore
            map_privacy_mode: data.map_privacy_mode ?? 'precise',
          } as BusinessProfile;
          
          // Auto-geocode if coordinates are missing but address is complete
          if (!normalized.latitude && !normalized.longitude && 
              normalized.address_line1 && normalized.city && 
              normalized.postal_code && normalized.country_code) {
            console.log('[TenantSettings] Auto-geocoding address...');
            try {
              const coords = await geocodeAddress({
                address_line1: normalized.address_line1,
                address_line2: normalized.address_line2,
                city: normalized.city,
                state: normalized.state,
                postal_code: normalized.postal_code,
                country_code: normalized.country_code,
              });
              
              if (coords) {
                console.log('[TenantSettings] Got coordinates:', coords);
                normalized.latitude = coords.latitude;
                normalized.longitude = coords.longitude;
                
                // Save coordinates to database
                await api.patch('/api/tenant/profile', {
                  tenant_id: tenant.id,
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                });
                console.log('[TenantSettings] Coordinates saved to database');
              }
            } catch (err) {
              console.error('[TenantSettings] Auto-geocoding failed:', err);
            }
          }
          
          setProfile(normalized);
        } else {
          setProfile(null);
        }
      } catch {
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [tenant?.id]);

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

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Sticky Summary Bar */}
        <div className="sticky top-0 z-10 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {tenant.metadata && (tenant.metadata as any).logo_url && (
                <img
                  src={(tenant.metadata as any).logo_url}
                  alt="Business Logo"
                  className="h-12 w-12 object-contain rounded-lg border border-neutral-200"
                />
              )}
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{tenant.name}</h2>
                <p className="text-sm text-neutral-500">Profile Completion: {Math.round(((profile?.business_name ? 1 : 0) + (profile?.address_line1 ? 1 : 0) + (profile?.phone_number ? 1 : 0) + (profile?.email ? 1 : 0) + ((tenant.metadata as any)?.logo_url ? 1 : 0)) / 5 * 100)}%</p>
              </div>
            </div>
            <a
              href={`/tenant/${tenant.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
            >
              View Public Storefront
            </a>
          </div>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Primary Content */}
          <div className="space-y-6 lg:col-span-2">
            {/* Business Profile moved to top */}
            {isFeatureEnabled('FF_BUSINESS_PROFILE', tenant.id, tenant.region) && (
              <BusinessProfileCard
                profile={profile}
                loading={profileLoading}
                onUpdate={async (updated) => {
                  try {
                    console.log('[TenantSettings] Updating profile with:', updated);
                    const response = await api.patch('/api/tenant/profile', {
                      tenant_id: tenant.id,
                      ...updated,
                    });
                    if (!response.ok) {
                      const e = await response.json();
                      throw new Error(e?.error || 'Failed to update business profile');
                    }
                    const saved = await response.json();
                    const next: BusinessProfile = {
                      tenant_id: tenant.id,
                      business_name: (saved.businessName ?? updated.business_name) as any,
                      address_line1: saved.addressLine1 ?? updated.address_line1,
                      address_line2: saved.addressLine2 ?? updated.address_line2,
                      city: saved.city ?? updated.city,
                      state: saved.state ?? updated.state,
                      postal_code: saved.postalCode ?? updated.postal_code,
                      country_code: saved.countryCode ?? updated.country_code,
                      phone_number: saved.phoneNumber ?? updated.phone_number,
                      email: saved.email ?? updated.email,
                      website: saved.website ?? updated.website,
                      contact_person: saved.contactPerson ?? updated.contact_person,
                      logo_url: saved.logoUrl ?? saved.logo_url ?? updated.logo_url ?? '',
                      latitude: saved.latitude ?? updated.latitude,
                      longitude: saved.longitude ?? updated.longitude,
                    } as any;
                    setProfile(next);
                    setTenant((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        metadata: {
                          ...(prev.metadata || {}),
                          logo_url: next.logo_url || undefined,
                        },
                      };
                    });
                  } catch (err) {
                    console.error('Failed to update business profile:', err);
                    alert('Failed to update business profile');
                  }
                }}
              />
            )}

            {/* GBP Business Category - Feature Flag: FF_TENANT_GBP_CATEGORY_SYNC (M3) */}
            {isFeatureEnabled('FF_TENANT_GBP_CATEGORY_SYNC', tenant.id, tenant.region) && profile && (
              <GBPCategoryCard
                tenantId={tenant.id}
                initialCategory={
                  (profile as any).gbpCategoryId && (profile as any).gbpCategoryName
                    ? { id: (profile as any).gbpCategoryId, name: (profile as any).gbpCategoryName }
                    : null
                }
                syncStatus={(profile as any).gbpCategorySyncStatus}
                lastMirrored={(profile as any).gbpCategoryLastMirrored}
              />
            )}

            {/* Map Card Settings - Feature Flag: FF_MAP_CARD */}
            {isFeatureEnabled('FF_MAP_CARD', tenant.id, tenant.region) && profile && (
              <MapCardSettings
                businessProfile={{
                  business_name: profile.business_name || tenant.name,
                  address_line1: profile.address_line1 || '',
                  address_line2: profile.address_line2,
                  city: profile.city || '',
                  state: profile.state || '',
                  postal_code: profile.postal_code || '',
                  country_code: profile.country_code || 'US',
                  latitude: (profile as any).latitude,
                  longitude: (profile as any).longitude,
                }}
                displayMap={(profile as any).display_map ?? false}
                privacyMode={(profile as any).map_privacy_mode ?? 'precise'}
                onSave={async (settings) => {
                  try {
                    const response = await api.patch('/api/tenant/profile', {
                      tenant_id: tenant.id,
                      display_map: settings.displayMap,
                      map_privacy_mode: settings.privacyMode,
                    });
                    if (!response.ok) {
                      const e = await response.json();
                      throw new Error(e?.error || 'Failed to update map settings');
                    }
                    setProfile(prev => prev ? ({
                      ...prev,
                      display_map: settings.displayMap,
                      map_privacy_mode: settings.privacyMode,
                    }) as any : prev);
                  } catch (err) {
                    console.error('Failed to update map settings:', err);
                    alert('Failed to update map settings');
                  }
                }}
              />
            )}
          </div>

          {/* Right Column - Secondary Content */}
          <div className="space-y-6">
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

        {/* Organization Assignment - Different UI for ADMIN vs OWNER */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Organization / Chain Assignment</CardTitle>
                <CardDescription>
                  {user?.role === 'ADMIN' 
                    ? 'Assign this tenant to a chain organization (Admin Only)' 
                    : 'Request to join a chain organization'}
                </CardDescription>
              </div>
              {user?.role === 'ADMIN' && !editingOrg && (
                <button
                  onClick={() => setEditingOrg(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                >
                  {tenant.organization ? 'Change' : 'Assign'}
                </button>
              )}
              {user?.role === 'OWNER' && !tenant.organization && !pendingRequest && (
                <Button
                  size="sm"
                  onClick={() => setShowRequestModal(true)}
                >
                  Request to Join
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Current Organization Status */}
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Organization</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    {tenant.organization ? 'Part of a chain organization' : 'Standalone location'}
                  </p>
                </div>
                {user?.role === 'ADMIN' && editingOrg ? (
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-sm bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[200px]"
                  >
                    <option value="">None (Standalone)</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    {tenant.organization ? (
                      <>
                        <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <Badge variant="default" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                          {tenant.organization.name}
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="default">Standalone</Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Admin Edit Controls */}
              {user?.role === 'ADMIN' && editingOrg && (
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={async () => {
                      setSavingOrg(true);
                      try {
                        if (selectedOrgId) {
                          const response = await api.post(`/api/organizations/${selectedOrgId}/tenants`, {
                            tenantId: tenant.id
                          });
                          if (!response.ok) throw new Error('Failed to assign to organization');
                        } else if (tenant.organization) {
                          const response = await api.delete(`/api/organizations/${tenant.organization.id}/tenants/${tenant.id}`);
                          if (!response.ok) throw new Error('Failed to remove from organization');
                        }
                        
                        const res = await api.get("/api/tenants");
                        const tenants: Tenant[] = await res.json();
                        const updated = tenants.find((t) => t.id === tenant.id);
                        if (updated) setTenant(updated);
                        
                        setEditingOrg(false);
                      } catch (err) {
                        console.error('Failed to update organization:', err);
                        alert('Failed to save changes. Please try again.');
                      } finally {
                        setSavingOrg(false);
                      }
                    }}
                    disabled={savingOrg}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {savingOrg ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedOrgId(tenant.organization?.id || '');
                      setEditingOrg(false);
                    }}
                    className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Pending Request Status (for OWNER) */}
              {user?.role === 'OWNER' && pendingRequest && (
                <Alert variant="info" title="Request Pending">
                  <div className="space-y-2">
                    <p className="text-sm">
                      Your request to join <strong>{pendingRequest.organization?.name}</strong> is pending admin approval.
                    </p>
                    {pendingRequest.estimatedCost && (
                      <div className="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-lg">
                        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                          Estimated Cost: ${pendingRequest.estimatedCost.toFixed(2)} {pendingRequest.costCurrency}/month
                        </p>
                        {!pendingRequest.costAgreed && (
                          <Button
                            size="sm"
                            className="mt-2"
                            onClick={async () => {
                              try {
                                const res = await api.patch(`/api/organization-requests/${pendingRequest.id}`, {
                                  costAgreed: true
                                });
                                if (res.ok) {
                                  const updated = await res.json();
                                  setPendingRequest(updated);
                                }
                              } catch (err) {
                                console.error('Failed to agree to cost:', err);
                              }
                            }}
                          >
                            Agree to Cost
                          </Button>
                        )}
                        {pendingRequest.costAgreed && (
                          <Badge variant="success" className="mt-2">Cost Agreed</Badge>
                        )}
                      </div>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        if (confirm('Are you sure you want to cancel this request?')) {
                          try {
                            await api.delete(`/api/organization-requests/${pendingRequest.id}`);
                            setPendingRequest(null);
                          } catch (err) {
                            console.error('Failed to cancel request:', err);
                          }
                        }
                      }}
                    >
                      Cancel Request
                    </Button>
                  </div>
                </Alert>
              )}

              {/* No Organizations Alert */}
              {!editingOrg && organizations.length === 0 && user?.role === 'ADMIN' && (
                <Alert variant="info" title="No Organizations Available">
                  <p className="text-sm">
                    No chain organizations have been created yet. Create an organization first to assign this tenant to a chain.
                  </p>
                  <Link href="/admin/organizations" className="text-sm text-primary-600 hover:text-primary-700 font-medium mt-2 inline-block">
                    Go to Organizations →
                  </Link>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Request Modal (for OWNER) */}
        {showRequestModal && (
          <Modal
            isOpen={showRequestModal}
            onClose={() => {
              setShowRequestModal(false);
              setSelectedOrgId('');
              setRequestNotes('');
            }}
            title="Request to Join Organization"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Select Organization
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select an organization...</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Business Justification (Optional)
                </label>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  rows={4}
                  placeholder="Explain why you'd like to join this organization..."
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <Alert variant="info" title="What happens next?">
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  <li>Your request will be sent to platform administrators</li>
                  <li>Admin will review and provide estimated costs</li>
                  <li>You'll review and agree to the costs</li>
                  <li>Admin will approve and your tenant will be assigned</li>
                </ol>
              </Alert>
            </div>

            <ModalFooter>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRequestModal(false);
                  setSelectedOrgId('');
                  setRequestNotes('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!selectedOrgId) {
                    alert('Please select an organization');
                    return;
                  }
                  
                  try {
                    const res = await api.post('/api/organization-requests', {
                      tenantId: tenant.id,
                      organizationId: selectedOrgId,
                      requestedBy: user?.id,
                      notes: requestNotes,
                      requestType: 'join'
                    });
                    
                    if (res.ok) {
                      const newRequest = await res.json();
                      setPendingRequest(newRequest);
                      setShowRequestModal(false);
                      setSelectedOrgId('');
                      setRequestNotes('');
                      
                      // Open email client with pre-filled content for admin notification
                      const adminEmail = getAdminEmail('organization_requests');
                      const orgName = organizations.find(o => o.id === selectedOrgId)?.name || 'Organization';
                      const subject = encodeURIComponent(`Organization Request - ${tenant.name} → ${orgName}`);
                      const body = encodeURIComponent(
                        `Hello,\n\n` +
                        `A new organization request has been submitted:\n\n` +
                        `Tenant: ${tenant.name}\n` +
                        `Organization: ${orgName}\n` +
                        `Requested by: ${user?.email || user?.id}\n` +
                        `Notes: ${requestNotes || 'None'}\n\n` +
                        `Please review this request in the admin dashboard:\n` +
                        `${window.location.origin}/settings/admin/organization-requests\n\n` +
                        `Best regards,\n` +
                        `${tenant.name}`
                      );
                      window.location.href = `mailto:${adminEmail}?subject=${subject}&body=${body}`;
                    } else {
                      const error = await res.json();
                      alert(error.error || 'Failed to submit request');
                    }
                  } catch (err) {
                    console.error('Failed to submit request:', err);
                    alert('Failed to submit request. Please try again.');
                  }
                }}
                disabled={!selectedOrgId}
              >
                Submit Request
              </Button>
            </ModalFooter>
          </Modal>
        )}

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
                        const response = await api.put(`/api/tenants/${tenant.id}`, regionalSettings);
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

          </div>
        </div>
        {/* Business Profile and Map Card moved to left column */}

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
