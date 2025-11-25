"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, Badge, Button, Spinner, Alert } from '@/components/ui';
import { motion } from 'framer-motion';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { 
  CreateTierModal, 
  EditTierModal, 
  DeleteTierModal, 
  AddFeatureModal,
  EditFeatureModal,
  InheritTierModal
} from '@/components/admin/TierCRUDModals';

interface TierFeature {
  id: string;
  featureKey: string;
  featureName: string;
  isInherited: boolean;
}

interface Tier {
  id: string;
  tierKey: string;
  name: string;
  displayName: string;
  description?: string;
  priceMonthly: number;
  maxSkus?: number;
  maxLocations?: number;
  tierType: 'individual' | 'organization';
  isActive: boolean;
  sortOrder: number;
  features: TierFeature[];
}

export default function TierSystemPage() {
  const { hasAccess, loading: accessLoading, isPlatformAdmin, user } = useAccessControl(null, AccessPresets.PLATFORM_ADMIN_ONLY);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<TierFeature | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddFeatureModal, setShowAddFeatureModal] = useState(false);
  const [showEditFeatureModal, setShowEditFeatureModal] = useState(false);
  const [showInheritTierModal, setShowInheritTierModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  useEffect(() => {
    if (hasAccess) loadTiers();
  }, [hasAccess, includeInactive]);

  const loadTiers = async () => {
    try {
      setLoading(true);
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const url = `${apiBaseUrl}/api/admin/tier-system/tiers${includeInactive ? '?includeInactive=true' : ''}`;
      const res = await api.get(url);
      if (res.ok) {
        const data = await res.json();
        setTiers(data.tiers || []);
      }
    } catch (e) {
      setError('Failed to load tiers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTier = async (data: any) => {
    setSubmitting(true);
    setError(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const res = await api.post(`${apiBaseUrl}/api/admin/tier-system/tiers`, {
        ...data,
        priceMonthly: Math.round(data.priceMonthly * 100),
      });

      if (res.ok) {
        setSuccess('Tier created successfully');
        setShowCreateModal(false);
        await loadTiers();
      } else {
        const errorData = await res.json();
        setError(errorData.message || errorData.error || 'Failed to create tier');
      }
    } catch (e) {
      setError('Failed to create tier');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditTier = async (data: any) => {
    if (!selectedTier) return;
    setSubmitting(true);
    setError(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const res = await api.patch(`${apiBaseUrl}/api/admin/tier-system/tiers/${selectedTier.tierKey}`, {
        ...data,
        priceMonthly: Math.round(data.priceMonthly * 100),
      });

      if (res.ok) {
        setSuccess('Tier updated successfully');
        setShowEditModal(false);
        setSelectedTier(null);
        await loadTiers();
      } else {
        const errorData = await res.json();
        setError(errorData.message || errorData.error || 'Failed to update tier');
      }
    } catch (e) {
      setError('Failed to update tier');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTier = async (data: { reason: string; hardDelete: boolean }) => {
    if (!selectedTier) return;
    setSubmitting(true);
    setError(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const res = await api.delete(`${apiBaseUrl}/api/admin/tier-system/tiers/${selectedTier.tierKey}`, {
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setSuccess(data.hardDelete ? 'Tier deleted permanently' : 'Tier deactivated');
        setShowDeleteModal(false);
        setSelectedTier(null);
        await loadTiers();
      } else {
        const errorData = await res.json();
        setError(errorData.message || errorData.error || 'Failed to delete tier');
      }
    } catch (e) {
      setError('Failed to delete tier');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddFeature = async (data: any) => {
    if (!selectedTier) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const res = await api.post(`${apiBaseUrl}/api/admin/tier-system/tiers/${selectedTier.tierKey}/features`, data);

      if (res.ok) {
        setSuccess('Feature added successfully');
        setShowAddFeatureModal(false);
        await loadTiers();
      } else {
        const errorData = await res.json();
        let userMessage = 'Failed to add feature';
        
        switch (errorData.error) {
          case 'tier_not_found':
            userMessage = 'Tier not found. Please refresh the page and try again.';
            break;
          case 'feature_already_exists':
            userMessage = 'This feature already exists in the tier. Each feature can only be added once.';
            break;
          case 'invalid_payload':
            userMessage = 'Invalid request. Please ensure all required fields are filled out correctly.';
            break;
          default:
            userMessage = errorData.message || errorData.error || 'Failed to add feature';
        }
        
        setError(userMessage);
      }
    } catch (e) {
      setError('Network error occurred while adding feature. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditFeature = async (data: any) => {
    if (!selectedTier || !selectedFeature) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const res = await api.patch(`${apiBaseUrl}/api/admin/tier-system/tiers/${selectedTier.tierKey}/features/${selectedFeature.id}`, data);

      if (res.ok) {
        setSuccess('Feature updated successfully');
        setShowEditFeatureModal(false);
        setSelectedFeature(null);
        await loadTiers();
      } else {
        const errorData = await res.json();
        let userMessage = 'Failed to update feature';
        
        switch (errorData.error) {
          case 'tier_not_found':
          case 'feature_not_found':
            userMessage = 'Feature not found. Please refresh the page and try again.';
            break;
          case 'invalid_payload':
            userMessage = 'Invalid request. Please ensure all required fields are filled out correctly.';
            break;
          default:
            userMessage = errorData.message || errorData.error || 'Failed to update feature';
        }
        
        setError(userMessage);
      }
    } catch (e) {
      setError('Network error occurred while updating feature. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInheritTier = async (data: { sourceTierId: string; reason: string }) => {
    if (!selectedTier) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const res = await api.post(`${apiBaseUrl}/api/admin/tier-system/tiers/${selectedTier.tierKey}/inherit-features`, data);

      if (res.ok) {
        const result = await res.json();
        // Show detailed success message
        const messages = [];
        if (result.summary.created > 0) {
          messages.push(`${result.summary.created} new features added`);
        }
        if (result.summary.updated > 0) {
          messages.push(`${result.summary.updated} existing features marked as inherited`);
        }
        
        const successMessage = messages.length > 0 
          ? `Inheritance complete: ${messages.join(' and ')}`
          : 'Features inherited successfully';
          
        setSuccess(successMessage);
        setShowInheritTierModal(false);
        await loadTiers();
      } else {
        const errorData = await res.json();
        let userMessage = 'Failed to inherit features';
        
        // Handle specific error scenarios with user-friendly messages
        switch (errorData.error) {
          case 'no_features_to_process':
            userMessage = 'No features available to inherit. The source tier has no features to share.';
            break;
          case 'target_tier_not_found':
            userMessage = 'Target tier not found. Please refresh the page and try again.';
            break;
          case 'source_tier_not_found':
            userMessage = 'Source tier not found. Please select a valid tier to inherit from.';
            break;
          case 'cannot_inherit_from_self':
            userMessage = 'Cannot inherit features from the same tier. Please select a different source tier.';
            break;
          case 'invalid_tier_hierarchy':
            userMessage = errorData.message || 'You can only inherit from tiers with lower sort order.';
            break;
          case 'invalid_payload':
            userMessage = 'Invalid request. Please ensure all required fields are filled out.';
            break;
          default:
            userMessage = errorData.message || errorData.error || 'Failed to inherit features';
        }
        
        setError(userMessage);
      }
    } catch (e) {
      setError('Network error occurred while inheriting features. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveFeature = async (featureId: string) => {
    if (!selectedTier) return;
    const reason = prompt('Please provide a reason for removing this feature:');
    if (!reason) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const res = await api.delete(
        `${apiBaseUrl}/api/admin/tier-system/tiers/${selectedTier.tierKey}/features/${featureId}`,
        { body: JSON.stringify({ reason }) }
      );

      if (res.ok) {
        setSuccess('Feature removed successfully');
        await loadTiers();
      } else {
        const errorData = await res.json();
        let userMessage = 'Failed to remove feature';
        
        switch (errorData.error) {
          case 'tier_not_found':
          case 'feature_not_found':
            userMessage = 'Feature not found. Please refresh the page and try again.';
            break;
          case 'invalid_payload':
            userMessage = 'Invalid request. Please provide a valid reason for removal.';
            break;
          default:
            userMessage = errorData.message || errorData.error || 'Failed to remove feature';
        }
        
        setError(userMessage);
      }
    } catch (e) {
      setError('Network error occurred while removing feature. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (accessLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        pageTitle="Tier System Management"
        pageDescription="Manage subscription tier definitions"
        title="Platform Staff Access Required"
        message="This page is only accessible to platform staff."
        userRole={user?.role || 'User'}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Tier System Management"
        description="Manage subscription tier definitions and features"
        icon={Icons.Settings}
        backLink={{ href: '/settings/admin', label: 'Back to Admin' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {error && <Alert variant="error" title="Error" onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert variant="success" title="Success" onClose={() => setSuccess(null)}>{success}</Alert>}

        {!isPlatformAdmin && (
          <Alert variant="info" title="Read-Only Access">
            You have read-only access. Only platform administrators can modify tiers.
          </Alert>
        )}

        {/* Actions Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(e) => setIncludeInactive(e.target.checked)}
                    className="rounded border-neutral-300 dark:border-neutral-600"
                  />
                  Show inactive tiers
                </label>
              </div>

              {isPlatformAdmin && (
                <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Tier
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tiers List */}
        <div className="grid grid-cols-1 gap-4">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.tierKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`transition-all duration-200 ${
                    !tier.isActive 
                      ? 'opacity-60 border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10' 
                      : 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10'
                  }`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {/* Status Icon */}
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full ${
                          tier.isActive 
                            ? 'bg-green-100 dark:bg-green-900/30' 
                            : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          {tier.isActive ? (
                            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </div>
                        
                        <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{tier.displayName}</h3>
                        <Badge className={tier.tierType === 'organization' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}>
                          {tier.tierType}
                        </Badge>
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                          ${(tier.priceMonthly / 100).toFixed(2)}/mo
                        </Badge>
                        {!tier.isActive && (
                          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{tier.description || 'No description'}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-neutral-600 dark:text-neutral-400">Tier Key:</span>
                          <span className="ml-2 font-mono text-neutral-900 dark:text-neutral-100">{tier.tierKey}</span>
                        </div>
                        <div>
                          <span className="text-neutral-600 dark:text-neutral-400">Max SKUs:</span>
                          <span className="ml-2 font-semibold text-neutral-900 dark:text-neutral-100">
                            {tier.maxSkus ? tier.maxSkus.toLocaleString() : 'Unlimited'}
                          </span>
                        </div>
                        {tier.maxLocations && (
                          <div>
                            <span className="text-neutral-600 dark:text-neutral-400">Max Locations:</span>
                            <span className="ml-2 font-semibold text-neutral-900 dark:text-neutral-100">{tier.maxLocations}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-neutral-600 dark:text-neutral-400">Sort Order:</span>
                          <span className="ml-2 font-semibold text-neutral-900 dark:text-neutral-100">{tier.sortOrder}</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                            Features ({tier.features.length})
                          </h4>
                          {isPlatformAdmin && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTier(tier);
                                  setShowAddFeatureModal(true);
                                }}
                              >
                                Add Feature
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedTier(tier);
                                  setShowInheritTierModal(true);
                                }}
                              >
                                Inherit Tier
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tier.features.map((f) => (
                            <div
                              key={f.id}
                              className="group relative inline-flex items-center gap-1 px-3 py-1 bg-neutral-100 dark:bg-neutral-800 rounded-full text-xs"
                            >
                              <span className="text-neutral-900 dark:text-neutral-100">{f.featureName}</span>
                              {f.isInherited && (
                                <span className="text-neutral-500 dark:text-neutral-400" title="Inherited from lower tier">↑</span>
                              )}
                              {isPlatformAdmin && (
                                <div className="flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => {
                                      setSelectedTier(tier);
                                      setSelectedFeature(f);
                                      setShowEditFeatureModal(true);
                                    }}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                    title="Edit feature"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedTier(tier);
                                      handleRemoveFeature(f.id);
                                    }}
                                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                    title="Remove feature"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {isPlatformAdmin && (
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedTier(tier);
                            setShowEditModal(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedTier(tier);
                            setShowDeleteModal(true);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {tiers.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <p className="text-neutral-600 dark:text-neutral-400">No tiers found</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Modals */}
        <CreateTierModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTier}
          submitting={submitting}
        />

        <EditTierModal
          isOpen={showEditModal}
          tier={selectedTier}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTier(null);
          }}
          onSubmit={handleEditTier}
          submitting={submitting}
        />

        <DeleteTierModal
          isOpen={showDeleteModal}
          tier={selectedTier}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedTier(null);
          }}
          onSubmit={handleDeleteTier}
          submitting={submitting}
        />

        <AddFeatureModal
          isOpen={showAddFeatureModal}
          tier={selectedTier}
          onClose={() => {
            setShowAddFeatureModal(false);
            setSelectedTier(null);
          }}
          onSubmit={handleAddFeature}
          submitting={submitting}
        />

        <EditFeatureModal
          isOpen={showEditFeatureModal}
          tier={selectedTier}
          feature={selectedFeature}
          onClose={() => {
            setShowEditFeatureModal(false);
            setSelectedTier(null);
            setSelectedFeature(null);
          }}
          onSubmit={handleEditFeature}
          submitting={submitting}
        />

        <InheritTierModal
          isOpen={showInheritTierModal}
          tier={selectedTier}
          tiers={tiers}
          onClose={() => {
            setShowInheritTierModal(false);
            setSelectedTier(null);
          }}
          onSubmit={handleInheritTier}
          submitting={submitting}
        />
      </div>
    </div>
  );
}
