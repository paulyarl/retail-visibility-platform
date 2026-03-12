'use client';

import { useState, useEffect } from 'react';
import { Building2, TrendingUp, AlertTriangle, Info, Edit2, Save, X, Settings, ArrowUp, ArrowDown } from 'lucide-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@mantine/core';
import { Input, Badge } from '@/components/ui';
import { adminTenantLimitsService, type LimitsData, type FeaturedProductsLimit, type TierSystemTier } from '@/services/AdminTenantLimitsSingletonService';

export default function AdminLimitsPage() {
  const [limitsData, setLimitsData] = useState<LimitsData | null>(null);
  const [allTierLimits, setAllTierLimits] = useState<Record<string, FeaturedProductsLimit> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('tenant-limits');
  const [isEditing, setIsEditing] = useState(false);
  const [editingLimits, setEditingLimits] = useState<FeaturedProductsLimit | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string>('starter');
  const [focusedEdit, setFocusedEdit] = useState<{ tierKey: string; field: 'maxLocations' | 'priceMonthly' | 'maxSkus' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  useEffect(() => {
    fetchLimits();
  }, []);

  const fetchLimits = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get comprehensive limits data using the service
      const data = await adminTenantLimitsService.getLimitsData(false);
      
      if (!data) {
        throw new Error('Failed to load limits data');
      }

      setLimitsData(data);
      
      // Get all tier featured products limits
      const allLimits = await adminTenantLimitsService.getAllFeaturedProductsLimits();
      setAllTierLimits(allLimits || {});
      
    } catch (err) {
      console.error('Failed to fetch limits:', err);
      setError(err instanceof Error ? err.message : 'Failed to load limits data');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentTierLimits = (): FeaturedProductsLimit => {
    return allTierLimits?.[selectedTier] || {
      store_selection: 8,
      new_arrival: 12,
      seasonal: 6,
      sale: 10,
      staff_pick: 6,
      random_featured: 12,
    };
  };

  const handleEdit = () => {
    const currentLimits = getCurrentTierLimits();
    setEditingLimits({ ...currentLimits });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingLimits(null);
  };

  const handleSave = async () => {
    if (!editingLimits || !selectedTier) return;

    try {
      setSaving(true);
      setError(null);
      
      // Save featured products limits using the service
      const success = await adminTenantLimitsService.updateFeaturedProductsLimits(selectedTier, editingLimits);
      
      if (success) {
        // Update local state on successful save
        setAllTierLimits(prev => ({
          ...prev,
          [selectedTier]: editingLimits
        }));
        
        setIsEditing(false);
        setEditingLimits(null);
      } else {
        setError('Failed to save limits. Please try again.');
      }
    } catch (err) {
      console.error('Failed to save limits:', err);
      setError('Failed to save limits. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLimitChange = (type: keyof FeaturedProductsLimit, value: string) => {
    if (editingLimits) {
      const numValue = parseInt(value) || 0;
      setEditingLimits({
        ...editingLimits,
        [type]: Math.max(0, Math.min(999, numValue)), // Validate range 0-999
      });
    }
  };

  // Dynamic tier comparison generator
  const getTierComparison = () => {
    if (!limitsData?.tiers || limitsData.tiers.length === 0 || !allTierLimits) {
      return (
        <div className="text-sm text-gray-600 space-y-1">
          <p><strong>Google-Only:</strong> 3-3-2-3-2 <span className="text-purple-600 font-medium">+6 Random</span> (very limited)</p>
          <p><strong>Starter:</strong> 8-12-6-10-6 <span className="text-purple-600 font-medium">+12 Random</span> (good starting point)</p>
          <p><strong>Professional:</strong> 15-20-12-15-10 <span className="text-purple-600 font-medium">+18 Random</span> (substantial)</p>
          <p><strong>Enterprise:</strong> 25-30-20-25-15 <span className="text-purple-600 font-medium">+48 Random</span> (generous)</p>
          <p><strong>Organization:</strong> 50-50-40-50-30 <span className="text-purple-600 font-medium">+24 Random</span> (unlimited-like)</p>
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">Format: Store-New-Seasonal-Sale-Staff <span className="text-purple-600">+Random Directory</span></p>
          </div>
        </div>
      );
    }

    const activeTiers = limitsData.tiers
      .filter(tier => tier.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return (
      <div className="space-y-2">
        {activeTiers.map(tier => {
          const limits = allTierLimits[tier.tierKey] || getCurrentTierLimits();
          const isCurrentTier = tier.tierKey === selectedTier;
          
          return (
            <div 
              key={tier.tierKey}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isCurrentTier 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-medium text-gray-900">{tier.displayName}</div>
                  <div className="text-xs text-gray-500">
                    ${tier.priceMonthly?.toFixed(2) || '0.00'}/month
                  </div>
                </div>
                {isCurrentTier && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                    Current
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-mono text-sm font-medium text-gray-900">
                    {limits.store_selection}-{limits.new_arrival}-{limits.seasonal}-{limits.sale}-{limits.staff_pick}
                  </div>
                  <div className="text-xs text-purple-600 font-medium">
                    +{limits.random_featured} Random
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-xs text-gray-500">Total Slots</div>
                  <div className="font-bold text-gray-900">
                    {Object.values(limits).reduce((sum, val) => sum + val, 0)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Format: Store-New-Seasonal-Sale-Staff <span className="text-purple-600">+Random Directory</span> • 
            Total includes all featured product slots per tier
          </p>
        </div>
      </div>
    );
  };
  const handleFocusedEdit = (tierKey: string, field: 'maxLocations' | 'priceMonthly' | 'maxSkus', currentValue: string | number | null | undefined) => {
    setFocusedEdit({ tierKey, field });
    setEditValue(currentValue === null || currentValue === undefined ? '' : currentValue.toString());
  };

  const handleFocusedCancel = () => {
    setFocusedEdit(null);
    setEditValue('');
  };

  const handleFocusedSave = async (tierKey: string, field: 'maxLocations' | 'priceMonthly' | 'maxSkus') => {
    try {
      setSaving(true);
      setError(null);
      
      // Prepare update data based on field type
      let updateValue: any;
      if (field === 'priceMonthly') {
        updateValue = parseInt(editValue) || 0;
      } else if (field === 'maxSkus') {
        updateValue = editValue === '' ? null : parseInt(editValue) || 0;
      } else if (field === 'maxLocations') {
        updateValue = parseInt(editValue) || 0;
      }
      
      // Update the tier using the service
      const success = await adminTenantLimitsService.updateTierField(
        tierKey, 
        field, 
        updateValue, 
        `Updated ${field} via limits page`
      );
      
      if (success) {
        // Refresh the data to show updated values
        fetchLimits();
      } else {
        setError('Failed to update tier');
      }
      
      setFocusedEdit(null);
      setEditValue('');
    } catch (err) {
      console.error('Failed to update tier:', err);
      setError('Failed to update tier');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <h3 className="text-red-800 font-medium">Error Loading Limits</h3>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchLimits}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!limitsData) {
    return null;
  }

  // Merge tier system data with tenant limits for display
  const getEnhancedTierData = () => {
    if (!limitsData?.tiers || limitsData.tiers.length === 0) return [];
    
    return limitsData.tiers.map((tier) => {
      // Get tenant limit config if available, otherwise create from tier data
      const tenantConfig = limitsData?.tenantLimits[tier.tierKey];
      
      // Generate upgrade message based on actual tier hierarchy
      const generateUpgradeMessage = (currentTierKey: string, currentSortOrder: number) => {
        const higherTiers = limitsData.tiers
          .filter(t => t.isActive && t.sortOrder > currentSortOrder)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        
        if (higherTiers.length === 0) return '';
        
        const nextTier = higherTiers[0];
        const nextTierLimit = nextTier.maxLocations || 0;
        const currentLimit = tier.maxLocations || 0;
        
        if (nextTierLimit > currentLimit) {
          return `Upgrade to ${nextTier.displayName} for up to ${nextTierLimit} locations`;
        } else if (nextTierLimit === currentLimit && nextTier.sortOrder > currentSortOrder) {
          return `Upgrade to ${nextTier.displayName} for additional features`;
        } else {
          return `Upgrade to ${nextTier.displayName} for enhanced capabilities`;
        }
      };
      
      return {
        tierKey: tier.tierKey,
        config: tenantConfig || {
          limit: tier.maxLocations || 1,
          displayName: tier.displayName,
          description: tier.description,
          upgradeMessage: generateUpgradeMessage(tier.tierKey, tier.sortOrder),
          upgradeToTier: limitsData.tiers.find(t => t.isActive && t.sortOrder > tier.sortOrder)?.tierKey
        },
        tierData: tier,
        isActive: tier.isActive,
        sortOrder: tier.sortOrder,
        price: tier.priceMonthly || 0,
        maxSkus: tier.maxSkus,
        maxLocations: tier.maxLocations
      };
    }).sort((a, b) => a.sortOrder - b.sortOrder);
  };

  return (
    <>
      <PageHeader
        title="Platform Limits Configuration"
        description="Manage and view all platform limits by subscription tier"
        icon={<Settings className="w-5 h-5" />}
        backLink={{
          href: "/settings/admin",
          label: "Admin Settings"
        }}
      />
      
      <div className="container mx-auto py-8 space-y-8">
        <Tabs defaultValue="tenant-limits" className="space-y-6">
          <TabsList>
            <TabsTrigger value="tenant-limits">Tenant Limits</TabsTrigger>
            <TabsTrigger value="featured-products">Featured Products</TabsTrigger>
          </TabsList>

      <TabsContent value="tenant-limits" className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Tenant Location Limits
              </h2>
              <p className="text-gray-600 mt-1">
                Maximum number of locations (stores) each subscription tier can create
              </p>
            </div>
            <div className="grid gap-6">
              {getEnhancedTierData().map(({ tierKey, config, tierData, isActive, sortOrder, price, maxSkus, maxLocations }) => (
                <div
                  key={tierKey}
                  className={`border rounded-lg p-6 ${
                    tierKey === limitsData.currentTier
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-200'
                  } ${!isActive ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold capitalize">{tierKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h3>
                        {tierKey === limitsData.currentTier && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">
                            Current Tier
                          </span>
                        )}
                        {!isActive && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-600 text-white">
                            Inactive
                          </span>
                        )}
                        {tierData && (
                          <Badge variant="default" className="text-xs">
                            Sort: {sortOrder}
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-600">{config.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="font-medium">Tier Name:</span>
                        <span className="text-lg font-semibold text-gray-900">{config.displayName}</span>
                        <span className="text-gray-500">•</span>
                        <span className="font-medium">Max Locations:</span>
                        {focusedEdit?.tierKey === tierKey && focusedEdit?.field === 'maxLocations' ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="999"
                              value={config.limit === Infinity ? '' : config.limit}
                              onChange={(e) => {
                                if (limitsData) {
                                  const newLimit = e.target.value === '' ? Infinity : parseInt(e.target.value) || 0;
                                  setLimitsData({
                                    ...limitsData,
                                    tenantLimits: {
                                      ...limitsData.tenantLimits,
                                      [tierKey]: {
                                        ...limitsData.tenantLimits[tierKey],
                                        limit: newLimit
                                      }
                                    }
                                  });
                                }
                              }}
                              className="w-20 px-2 py-1 text-sm"
                              placeholder={config.limit === Infinity ? 'Unlimited' : config.limit.toString()}
                            />
                            <Button
                              onClick={() => handleFocusedSave(tierKey, 'maxLocations')}
                              disabled={saving}
                              variant="default"
                              size="sm"
                            >
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button
                              onClick={handleFocusedCancel}
                              variant="outline"
                              size="sm"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-gray-900">
                              {config.limit === Infinity ? 'Unlimited' : config.limit}
                            </span>
                            <Button
                              onClick={() => handleFocusedEdit(tierKey, 'maxLocations', config.limit)}
                              variant="outline"
                              size="sm"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                        <span className="text-gray-500">locations</span>
                        <span className="ml-2 text-sm text-gray-400">({config.displayName})</span>
                      </div>
                      
                      {/* Show additional tier data if available */}
                      {tierData && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
                          <div>
                            <span className="font-medium">Price:</span>
                            {focusedEdit?.tierKey === tierKey && focusedEdit?.field === 'priceMonthly' ? (
                              <div className="flex items-center gap-2 ml-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="999999"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-24 px-2 py-1 text-sm"
                                  placeholder="0"
                                />
                                <Button
                                  onClick={() => handleFocusedSave(tierKey, 'priceMonthly')}
                                  disabled={saving}
                                  variant="default"
                                  size="sm"
                                >
                                  <Save className="w-3 h-3" />
                                </Button>
                                <Button
                                  onClick={handleFocusedCancel}
                                  variant="outline"
                                  size="sm"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 ml-2">
                                <span className="font-semibold">${price}/month</span>
                                <Button
                                  onClick={() => handleFocusedEdit(tierKey, 'priceMonthly', tierData.priceMonthly)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="font-medium">Max SKUs:</span>
                            {focusedEdit?.tierKey === tierKey && focusedEdit?.field === 'maxSkus' ? (
                              <div className="flex items-center gap-2 ml-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="999999"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-24 px-2 py-1 text-sm"
                                  placeholder="Unlimited"
                                />
                                <Button
                                  onClick={() => handleFocusedSave(tierKey, 'maxSkus')}
                                  disabled={saving}
                                  variant="default"
                                  size="sm"
                                >
                                  <Save className="w-3 h-3" />
                                </Button>
                                <Button
                                  onClick={handleFocusedCancel}
                                  variant="outline"
                                  size="sm"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 ml-2">
                                <span className="font-semibold">
                                  {maxSkus === null ? 'Unlimited' : maxSkus.toLocaleString()}
                                </span>
                                <Button
                                  onClick={() => handleFocusedEdit(tierKey, 'maxSkus', maxSkus)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="font-medium">Max Locations:</span>
                            {focusedEdit?.tierKey === tierKey && focusedEdit?.field === 'maxLocations' ? (
                              <div className="flex items-center gap-2 ml-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="999"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-20 px-2 py-1 text-sm"
                                  placeholder="0"
                                />
                                <Button
                                  onClick={() => handleFocusedSave(tierKey, 'maxLocations')}
                                  disabled={saving}
                                  variant="default"
                                  size="sm"
                                >
                                  <Save className="w-3 h-3" />
                                </Button>
                                <Button
                                  onClick={handleFocusedCancel}
                                  variant="outline"
                                  size="sm"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 ml-2">
                                <span className="font-semibold">
                                  {maxLocations === null ? 'Unlimited' : maxLocations.toLocaleString()}
                                </span>
                                <Button
                                  onClick={() => handleFocusedEdit(tierKey, 'maxLocations', maxLocations)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <div>
                            <span className="font-medium">Type:</span>
                            <span className="ml-2">{tierData.tierType || 'individual'}</span>
                          </div>
                        </div>
                      )}
                      
                      {config.upgradeMessage && config.upgradeMessage.trim() && (
                        <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-200">
                          {config.upgradeMessage}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-gray-900">
                        {config.limit === Infinity ? '∞' : config.limit}
                      </div>
                      <div className="text-sm text-gray-500">Locations</div>
                      <div className="text-xs text-gray-400 mt-1">{config.displayName}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

      <TabsContent value="featured-products" className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Featured Products Limits by Tier
                  </h2>
                  <p className="text-gray-600 mt-1">
                    Maximum number of products that can be featured for each type by subscription tier
                  </p>
                </div>
                {!isEditing ? (
                  <button
                    onClick={handleEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Limits
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <span className="text-blue-800 font-medium">
                      Viewing limits for: <span className="font-bold">
                        {limitsData?.tiers && limitsData.tiers.length > 0 
                          ? limitsData.tiers.find((t: TierSystemTier) => t.tierKey === selectedTier)?.displayName || selectedTier
                          : selectedTier.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                        }
                      </span>
                    </span>
                  </div>
                  <select
                    value={selectedTier}
                    onChange={(e) => {
                      if (isEditing) {
                        // Cancel editing if tier changes during edit
                        handleCancel();
                      }
                      setSelectedTier(e.target.value);
                    }}
                    disabled={isEditing}
                    className="px-3 py-2 border border-blue-300 rounded-md bg-white text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {limitsData?.tiers && limitsData.tiers.length > 0 ? (
                      limitsData.tiers
                        .filter((tier: TierSystemTier) => tier.isActive)
                        .sort((a: TierSystemTier, b: TierSystemTier) => a.sortOrder - b.sortOrder)
                        .map((tier: TierSystemTier) => (
                          <option key={tier.tierKey} value={tier.tierKey}>
                            {tier.displayName}
                          </option>
                        ))
                    ) : (
                      <>
                        <option value="google_only">Google Only</option>
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="enterprise">Enterprise</option>
                        <option value="organization">Organization</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid gap-4">
                {Object.entries(isEditing ? (editingLimits || getCurrentTierLimits()) : getCurrentTierLimits()).map(([type, limit]) => {
                  const isRandomFeatured = type === 'random_featured';
                  return (
                    <div
                      key={type}
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        isRandomFeatured 
                          ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 border-2' 
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-medium capitalize ${isRandomFeatured ? 'text-purple-900' : ''}`}>
                            {type.replace('_', ' ')}
                          </h4>
                          {isRandomFeatured && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-600 text-white">
                              Directory
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${isRandomFeatured ? 'text-purple-700' : 'text-gray-600'}`}>
                          {isRandomFeatured 
                            ? 'Maximum products shown in random directory discovery (cross-tenant)'
                            : `Maximum products that can be featured as ${type.replace('_', ' ')}`
                          }
                        </p>
                        {isRandomFeatured && (
                          <p className="text-xs text-purple-600">
                            ⚡ Proximity-weighted random selection across all stores
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="999"
                            value={editingLimits?.[type as keyof FeaturedProductsLimit] || limit}
                            onChange={(e) => handleLimitChange(type as keyof FeaturedProductsLimit, e.target.value)}
                            className={`w-20 px-3 py-2 border rounded-md text-right focus:outline-none focus:ring-2 ${
                              isRandomFeatured 
                                ? 'border-purple-300 focus:ring-purple-500 bg-white' 
                                : 'border-gray-300 focus:ring-blue-500'
                            }`}
                          />
                        ) : (
                          <>
                            <div className={`text-2xl font-bold ${isRandomFeatured ? 'text-purple-900' : 'text-gray-900'}`}>
                              {limit}
                            </div>
                            <div className={`text-sm ${isRandomFeatured ? 'text-purple-600' : 'text-gray-500'}`}>
                              products
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">Tier Comparison</h4>
                  {limitsData?.tiers && limitsData.tiers.length > 0 && (
                    <div className="text-xs text-gray-500">
                      {limitsData.tiers.filter((t: TierSystemTier) => t.isActive).length} active tiers
                    </div>
                  )}
                </div>
                {getTierComparison()}
              </div>
            </div>
          </div>
        </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
