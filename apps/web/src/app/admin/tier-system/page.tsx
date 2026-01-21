'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Alert, Spinner, Input, Modal } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { api } from '@/lib/api';
import { Edit2, Save, X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

interface Tier {
  id: string;
  tierKey: string;
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number;
  maxSkus: number | null;
  maxLocations: number | null;
  tierType: string;
  isActive: boolean;
  sortOrder: number;
  features: TierFeature[];
  createdAt: string;
  updatedAt: string;
}

interface TierFeature {
  id: string;
  featureKey: string;
  featureName: string;
  isEnabled: boolean;
  isInherited: boolean;
}

interface TierSystem {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  tiers: Tier[];
}

export default function TierSystemPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Tier | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableFeatures, setAvailableFeatures] = useState<TierFeature[]>([]);
  const [showFeatureManager, setShowFeatureManager] = useState(false);
  const [newFeature, setNewFeature] = useState({ featureKey: '', featureName: '' });
  const [showNewFeatureForm, setShowNewFeatureForm] = useState(false);
  const [showAddTierModal, setShowAddTierModal] = useState(false);
  const [newTier, setNewTier] = useState<Partial<Tier>>({
    tierKey: '',
    name: '',
    displayName: '',
    description: '',
    priceMonthly: 0,
    maxSkus: null,
    maxLocations: 1,
    tierType: 'individual',
    isActive: true,
    sortOrder: tiers.length + 1,
    features: []
  });

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/api/admin/tier-system/tiers');
      const data = await response.json();
      
      if (response.ok) {
        setTiers(data.tiers || []);
      } else {
        setError(data.error || 'Failed to load tiers');
      }
    } catch (err) {
      console.error('Failed to load tiers:', err);
      setError('Failed to load tiers');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTier = async (tierId: string, isActive: boolean) => {
    try {
      setError(null);
      setSuccess(null);
      
      const response = await api.patch(`/api/admin/tier-system/tiers/${tierId}`, {
        isActive
      });
      
      if (response.ok) {
        setSuccess(`Tier ${isActive ? 'activated' : 'deactivated'} successfully`);
        loadTiers(); // Reload to show updated state
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update tier');
      }
    } catch (err) {
      console.error('Failed to toggle tier:', err);
      setError('Failed to update tier');
    }
  };

  const handleEditTier = (tier: Tier) => {
    setEditingTier(tier.id);
    setEditingData({ ...tier });
  };

  const handleCancelEdit = () => {
    setEditingTier(null);
    setEditingData(null);
  };

  const handleSaveTier = async () => {
    if (!editingData) return;

    try {
      setSaving(true);
      setError(null);
      
      const response = await api.put(`/api/admin/tier-system/tiers/${editingData.id}`, editingData);
      
      if (response.ok) {
        setSuccess('Tier updated successfully');
        setEditingTier(null);
        setEditingData(null);
        loadTiers();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update tier');
      }
    } catch (err) {
      console.error('Failed to save tier:', err);
      setError('Failed to save tier');
    } finally {
      setSaving(false);
    }
  };

  const handleEditChange = (field: keyof Tier, value: string | number | boolean | null) => {
    if (editingData) {
      setEditingData({
        ...editingData,
        [field]: value
      });
    }
  };

  const getLowerSortOrderTiers = (currentSortOrder: number) => {
    return tiers.filter(tier => tier.sortOrder < currentSortOrder).sort((a, b) => b.sortOrder - a.sortOrder);
  };

  const getInheritableFeatures = (currentSortOrder: number) => {
    const lowerTiers = getLowerSortOrderTiers(currentSortOrder);
    const currentFeatureKeys = new Set(editingData?.features.map(f => f.featureKey) || []);
    const allFeatures = new Map<string, { feature: TierFeature; sourceTier: string }>();
    
    // Collect all features from lower tiers with source tier info
    lowerTiers.forEach(tier => {
      tier.features.forEach(feature => {
        if (!allFeatures.has(feature.featureKey) && !currentFeatureKeys.has(feature.featureKey)) {
          allFeatures.set(feature.featureKey, { 
            feature, 
            sourceTier: tier.displayName 
          });
        }
      });
    });
    
    return Array.from(allFeatures.values());
  };

  const handleAddFeature = (feature: TierFeature) => {
    if (!editingData) return;
    
    const newFeature: TierFeature = {
      ...feature,
      id: `new_${Date.now()}`,
      isInherited: false,
      isEnabled: true
    };
    
    setEditingData({
      ...editingData,
      features: [...editingData.features, newFeature]
    });
  };

  const handleRemoveFeature = (featureKey: string) => {
    if (!editingData) return;
    
    setEditingData({
      ...editingData,
      features: editingData.features.filter(f => f.featureKey !== featureKey)
    });
  };

  const handleToggleFeature = (featureKey: string, enabled: boolean) => {
    if (!editingData) return;
    
    setEditingData({
      ...editingData,
      features: editingData.features.map(f => 
        f.featureKey === featureKey ? { ...f, isEnabled: enabled } : f
      )
    });
  };

  const handleInheritFeature = (featureKey: string) => {
    if (!editingData) return;
    
    const inheritableFeature = getInheritableFeatures(editingData.sortOrder)
      .find(item => item.feature.featureKey === featureKey);
    
    if (inheritableFeature) {
      const newFeature: TierFeature = {
        ...inheritableFeature.feature,
        id: `inherited_${Date.now()}`,
        isInherited: true,
        isEnabled: true
      };
      
      setEditingData({
        ...editingData,
        features: [...editingData.features.filter(f => f.featureKey !== featureKey), newFeature]
      });
    }
  };

  const handleSortOrderChange = async (tierId: string, newSortOrder: number) => {
    try {
      setSaving(true);
      setError(null);
      
      const response = await api.patch(`/api/admin/tier-system/tiers/${tierId}/sort-order`, {
        sortOrder: newSortOrder
      });
      
      if (response.ok) {
        setSuccess('Sort order updated successfully');
        loadTiers();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update sort order');
      }
    } catch (err) {
      console.error('Failed to update sort order:', err);
      setError('Failed to update sort order');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewFeature = () => {
    if (!newFeature.featureKey || !newFeature.featureName) {
      setError('Feature key and name are required');
      return;
    }

    const feature: TierFeature = {
      id: `new_${Date.now()}`,
      featureKey: newFeature.featureKey.toLowerCase().replace(/\s+/g, '_'),
      featureName: newFeature.featureName,
      isEnabled: true,
      isInherited: false
    };

    if (editingData) {
      setEditingData({
        ...editingData,
        features: [...editingData.features, feature]
      });
    }

    setNewFeature({ featureKey: '', featureName: '' });
    setShowNewFeatureForm(false);
  };

  const openFeatureManager = () => {
    if (editingData) {
      const inheritableFeatures = getInheritableFeatures(editingData.sortOrder);
      const currentFeatureKeys = new Set(editingData.features.map(f => f.featureKey));
      
      // Features that can be added (not already in tier)
      const availableToAdd = inheritableFeatures.filter(f => !currentFeatureKeys.has(f.feature.featureKey)).map(f => f.feature);
      setAvailableFeatures(availableToAdd);
      setShowFeatureManager(true);
    }
  };

  const handleCreateTier = async () => {
    try {
      setSaving(true);
      setError(null);

      // Validate required fields
      if (!newTier.tierKey || !newTier.displayName || !newTier.name) {
        setError('Tier key, name, and display name are required');
        return;
      }

      // Create the tier
      const response = await api.post('/api/admin/tier-system/tiers', {
        ...newTier,
        id: `tier_${newTier.tierKey}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      if (response.ok) {
        setSuccess('Tier created successfully');
        setShowAddTierModal(false);
        setNewTier({
          tierKey: '',
          name: '',
          displayName: '',
          description: '',
          priceMonthly: 0,
          maxSkus: null,
          maxLocations: 1,
          tierType: 'individual',
          isActive: true,
          sortOrder: tiers.length + 1,
          features: []
        });
        loadTiers(); // Reload to show new tier
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create tier');
      }
    } catch (err) {
      console.error('Failed to create tier:', err);
      setError('Failed to create tier');
    } finally {
      setSaving(false);
    }
  };

  const handleNewTierChange = (field: keyof Tier, value: string | number | boolean | null) => {
    setNewTier({
      ...newTier,
      [field]: value
    });
  };

  const getTierTypeColor = (tierType: string) => {
    switch (tierType) {
      case 'free':
        return 'bg-gray-100 text-gray-800';
      case 'basic':
        return 'bg-blue-100 text-blue-800';
      case 'premium':
        return 'bg-purple-100 text-purple-800';
      case 'enterprise':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tier System Management"
        description="Manage subscription tiers and pricing"
        icon={Icons.Settings}
      />

      {error && (
        <Alert variant="error">
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          {success}
        </Alert>
      )}

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Subscription Tiers</CardTitle>
              <div className="flex items-center gap-2">
                <Button onClick={() => setShowAddTierModal(true)} variant="default" size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Tier
                </Button>
                <Button onClick={loadTiers} variant="outline" size="sm">
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {tiers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No tiers configured
              </div>
            ) : (
              <div className="space-y-4">
                {tiers
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((tier) => (
                    <div
                      key={tier.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{tier.displayName}</h3>
                          <Badge className={getTierTypeColor(tier.tierType)}>
                            {tier.tierKey}
                          </Badge>
                          <Badge variant={tier.isActive ? 'success' : 'default'}>
                            {tier.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingTier === tier.id ? (
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={handleSaveTier}
                                disabled={saving}
                                variant="default"
                                size="sm"
                              >
                                <Save className="w-4 h-4 mr-1" />
                                {saving ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                onClick={handleCancelEdit}
                                disabled={saving}
                                variant="outline"
                                size="sm"
                              >
                                <X className="w-4 h-4 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => handleEditTier(tier)}
                                variant="outline"
                                size="sm"
                              >
                                <Edit2 className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                onClick={() => handleToggleTier(tier.id, !tier.isActive)}
                                variant={tier.isActive ? 'destructive' : 'default'}
                                size="sm"
                              >
                                {tier.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {editingTier === tier.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-1">Display Name</label>
                              <Input
                                value={editingData?.displayName || ''}
                                onChange={(e) => handleEditChange('displayName', e.target.value)}
                                placeholder="Tier display name"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Tier Key</label>
                              <Input
                                value={editingData?.tierKey || ''}
                                onChange={(e) => handleEditChange('tierKey', e.target.value)}
                                placeholder="tier_key"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Price Monthly</label>
                              <Input
                                type="number"
                                value={editingData?.priceMonthly || 0}
                                onChange={(e) => handleEditChange('priceMonthly', parseFloat(e.target.value) || 0)}
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Max SKUs</label>
                              <Input
                                type="number"
                                value={editingData?.maxSkus === null ? '' : editingData?.maxSkus || ''}
                                onChange={(e) => handleEditChange('maxSkus', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                                placeholder="Unlimited"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Max Locations</label>
                              <Input
                                type="number"
                                value={editingData?.maxLocations === null ? '' : editingData?.maxLocations || ''}
                                onChange={(e) => handleEditChange('maxLocations', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                                placeholder="Unlimited"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1">Sort Order</label>
                              <Input
                                type="number"
                                value={editingData?.sortOrder || 0}
                                onChange={(e) => handleEditChange('sortOrder', parseInt(e.target.value) || 0)}
                                placeholder="0"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Description</label>
                            <Input
                              value={editingData?.description || ''}
                              onChange={(e) => handleEditChange('description', e.target.value)}
                              placeholder="Tier description"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          {tier.description && (
                            <p className="text-gray-600 text-sm">{tier.description}</p>
                          )}

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Price:</span>
                              <span className="ml-2">${tier.priceMonthly / 100}/month</span>
                            </div>
                            <div>
                              <span className="font-medium">Max SKUs:</span>
                              <span className="ml-2">
                                {tier.maxSkus === null ? 'Unlimited' : tier.maxSkus.toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="font-medium">Max Locations:</span>
                              <span className="ml-2">
                                {tier.maxLocations === null ? 'Unlimited' : tier.maxLocations.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Sort Order:</span>
                              <span className="ml-2">{tier.sortOrder}</span>
                              {editingTier !== tier.id && (
                                <Button
                                  onClick={() => handleSortOrderChange(tier.id, tier.sortOrder - 1)}
                                  variant="outline"
                                  size="sm"
                                  disabled={tier.sortOrder <= 1}
                                >
                                  ↑
                                </Button>
                              )}
                              {editingTier !== tier.id && (
                                <Button
                                  onClick={() => handleSortOrderChange(tier.id, tier.sortOrder + 1)}
                                  variant="outline"
                                  size="sm"
                                  disabled={tier.sortOrder >= tiers.length}
                                >
                                  ↓
                                </Button>
                              )}
                            </div>
                            <div>
                              <span className="font-medium">Type:</span>
                              <span className="ml-2">{tier.tierType}</span>
                            </div>
                          </div>
                        </>
                      )}

                      {tier.features && tier.features.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">Features:</span>
                            {editingTier === tier.id && (
                              <Button
                                onClick={openFeatureManager}
                                variant="outline"
                                size="sm"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Manage Features
                              </Button>
                            )}
                          </div>
                          
                          {/* Group direct features */}
                          {editingTier === tier.id && (
                            <div className="mb-4">
                              <div className="text-xs font-medium text-gray-600 mb-2">Direct Features:</div>
                              <div className="flex flex-wrap gap-2">
                                {tier.features
                                  .filter(f => !f.isInherited)
                                  .map((feature, index) => (
                                    <Badge 
                                      key={index} 
                                      variant="success" 
                                      className="text-xs flex items-center gap-1"
                                    >
                                      {feature.featureName}
                                      <button
                                        onClick={() => handleRemoveFeature(feature.featureKey)}
                                        className="ml-1 text-red-500 hover:text-red-700"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </Badge>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* Group inherited features by source tier */}
                          {editingTier === tier.id && tier.features.filter(f => f.isInherited).length > 0 && (
                            <div className="mb-4">
                              <div className="text-xs font-medium text-gray-600 mb-2">Inherited Features:</div>
                              <div className="flex flex-wrap gap-2">
                                {tier.features
                                  .filter(f => f.isInherited)
                                  .map((feature, index) => (
                                    <Badge 
                                      key={index} 
                                      variant="default" 
                                      className="text-xs flex items-center gap-1"
                                    >
                                      {feature.featureName}
                                      <button
                                        onClick={() => handleRemoveFeature(feature.featureKey)}
                                        className="ml-1 text-red-500 hover:text-red-700"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </Badge>
                                  ))}
                              </div>
                            </div>
                          )}

                          {/* View mode: Show all features with inheritance status */}
                          {editingTier !== tier.id && (
                            <div className="space-y-3">
                              {/* Direct features */}
                              {tier.features.filter(f => !f.isInherited).length > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-gray-600 mb-2">Direct Features:</div>
                                  <div className="flex flex-wrap gap-2">
                                    {tier.features
                                      .filter(f => !f.isInherited)
                                      .map((feature, index) => (
                                        <Badge 
                                          key={index} 
                                          variant="success" 
                                          className="text-xs"
                                        >
                                          {feature.featureName}
                                        </Badge>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {/* Inherited features */}
                              {tier.features.filter(f => f.isInherited).length > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-gray-600 mb-2">Inherited Features:</div>
                                  <div className="flex flex-wrap gap-2">
                                    {tier.features
                                      .filter(f => f.isInherited)
                                      .map((feature, index) => (
                                        <Badge 
                                          key={index} 
                                          variant="default" 
                                          className="text-xs opacity-75"
                                        >
                                          {feature.featureName}
                                        </Badge>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-700">Total Tiers</div>
                <div className="text-2xl font-bold text-gray-900">{tiers.length}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="font-medium text-green-700">Active Tiers</div>
                <div className="text-2xl font-bold text-green-900">
                  {tiers.filter(t => t.isActive).length}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="font-medium text-gray-700">Inactive Tiers</div>
                <div className="text-2xl font-bold text-gray-900">
                  {tiers.filter(t => !t.isActive).length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Manager Modal */}
      <Modal
        isOpen={showFeatureManager}
        onClose={() => setShowFeatureManager(false)}
        title="Manage Features"
        size="lg"
      >
        <div className="space-y-6">
          {/* Add New Feature Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Add New Feature</h3>
              <Button
                onClick={() => setShowNewFeatureForm(!showNewFeatureForm)}
                variant="outline"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Feature
              </Button>
            </div>
            
            {showNewFeatureForm && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Feature Key</label>
                  <Input
                    value={newFeature.featureKey}
                    onChange={(e) => setNewFeature({ ...newFeature, featureKey: e.target.value })}
                    placeholder="feature_key"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Feature Name</label>
                  <Input
                    value={newFeature.featureName}
                    onChange={(e) => setNewFeature({ ...newFeature, featureName: e.target.value })}
                    placeholder="Feature Display Name"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateNewFeature} size="sm">
                    Add Feature
                  </Button>
                  <Button onClick={() => setShowNewFeatureForm(false)} variant="outline" size="sm">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Inheritable Features Section */}
          {availableFeatures.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Inherit from Lower Tiers</h3>
              <div className="text-sm text-gray-600 mb-3">
                Features available from tiers with lower sort order (higher tiers cannot inherit from lower tiers)
              </div>
              <div className="space-y-2">
                {availableFeatures.map((item) => (
                  <div key={item.featureKey} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{item.featureName}</div>
                      <div className="text-sm text-gray-500">
                        {item.featureKey}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleInheritFeature(item.featureKey)}
                        variant="outline"
                        size="sm"
                      >
                        Inherit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current Features Section */}
          {editingData && editingData.features.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Current Features</h3>
              
              {/* Group direct features */}
              {editingData.features.filter(f => !f.isInherited).length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-2">Direct Features:</div>
                  <div className="space-y-2">
                    {editingData.features
                      .filter(f => !f.isInherited)
                      .map((feature) => (
                        <div key={feature.featureKey} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">{feature.featureName}</div>
                            <div className="text-sm text-gray-500">
                              {feature.featureKey} • Direct
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleToggleFeature(feature.featureKey, !feature.isEnabled)}
                              variant={feature.isEnabled ? "default" : "outline"}
                              size="sm"
                            >
                              {feature.isEnabled ? 'Enabled' : 'Disabled'}
                            </Button>
                            <Button
                              onClick={() => handleRemoveFeature(feature.featureKey)}
                              variant="destructive"
                              size="sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Group inherited features */}
              {editingData.features.filter(f => f.isInherited).length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-600 mb-2">Inherited Features:</div>
                  <div className="space-y-2">
                    {editingData.features
                      .filter(f => f.isInherited)
                      .map((feature) => (
                        <div key={feature.featureKey} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                          <div>
                            <div className="font-medium">{feature.featureName}</div>
                            <div className="text-sm text-gray-500">
                              {feature.featureKey} • Inherited
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleToggleFeature(feature.featureKey, !feature.isEnabled)}
                              variant={feature.isEnabled ? "default" : "outline"}
                              size="sm"
                            >
                              {feature.isEnabled ? 'Enabled' : 'Disabled'}
                            </Button>
                            <Button
                              onClick={() => handleRemoveFeature(feature.featureKey)}
                              variant="destructive"
                              size="sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {availableFeatures.length === 0 && !showNewFeatureForm && (
            <div className="text-center py-8 text-gray-500">
              <div className="mb-4">
                <p className="font-medium">No inheritable features available</p>
                <p className="text-sm mt-1">
                  {editingData && editingData.sortOrder === 1 
                    ? "This is the lowest tier. Create new features or add lower tiers first."
                    : "All features from lower tiers are already inherited or this tier has all available features."
                  }
                </p>
              </div>
              <Button onClick={() => setShowNewFeatureForm(true)} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Create New Feature
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Add Tier Modal */}
      <Modal
        isOpen={showAddTierModal}
        onClose={() => setShowAddTierModal(false)}
        title="Add New Tier"
        size="lg"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tier Key *</label>
              <Input
                value={newTier.tierKey || ''}
                onChange={(e) => handleNewTierChange('tierKey', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="tier_key"
              />
              <p className="text-xs text-gray-500 mt-1">Used internally (lowercase, underscores)</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tier Name *</label>
              <Input
                value={newTier.name || ''}
                onChange={(e) => handleNewTierChange('name', e.target.value)}
                placeholder="Tier Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Display Name *</label>
              <Input
                value={newTier.displayName || ''}
                onChange={(e) => handleNewTierChange('displayName', e.target.value)}
                placeholder="Customer-facing name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Input
                value={newTier.description || ''}
                onChange={(e) => handleNewTierChange('description', e.target.value)}
                placeholder="Tier description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Price Monthly (cents)</label>
              <Input
                type="number"
                value={newTier.priceMonthly || 0}
                onChange={(e) => handleNewTierChange('priceMonthly', parseInt(e.target.value) || 0)}
                placeholder="9900"
              />
              <p className="text-xs text-gray-500 mt-1">Enter price in cents (e.g., 9900 = $99.00)</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max SKUs</label>
              <Input
                type="number"
                value={newTier.maxSkus === null ? '' : newTier.maxSkus || ''}
                onChange={(e) => handleNewTierChange('maxSkus', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                placeholder="Unlimited"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Locations</label>
              <Input
                type="number"
                value={newTier.maxLocations === null ? '' : newTier.maxLocations || ''}
                onChange={(e) => handleNewTierChange('maxLocations', e.target.value === '' ? null : parseInt(e.target.value) || 0)}
                placeholder="1"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tier Type</label>
              <select
                value={newTier.tierType || 'individual'}
                onChange={(e) => handleNewTierChange('tierType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="individual">Individual</option>
                <option value="organization">Organization</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sort Order</label>
              <Input
                type="number"
                value={newTier.sortOrder || tiers.length + 1}
                onChange={(e) => handleNewTierChange('sortOrder', parseInt(e.target.value) || 1)}
                placeholder={String(tiers.length + 1)}
              />
              <p className="text-xs text-gray-500 mt-1">Higher numbers appear later in list</p>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={newTier.isActive || false}
              onChange={(e) => handleNewTierChange('isActive', e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="isActive" className="text-sm font-medium">
              Active (tier is available for purchase)
            </label>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={handleCreateTier} disabled={saving}>
              {saving ? 'Creating...' : 'Create Tier'}
            </Button>
            <Button onClick={() => setShowAddTierModal(false)} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
