'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Alert, Spinner, Input, Modal, ToastContainer } from '@/components/ui';
import { Button } from '@mantine/core';
import PageHeader, { Icons } from '@/components/PageHeader';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { Edit2, Save, X, Plus, Trash2, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

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
  const [deactivatingTier, setDeactivatingTier] = useState<Tier | null>(null);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [showInactiveTiers, setShowInactiveTiers] = useState(false);
  const [showCommerceManager, setShowCommerceManager] = useState(false);
  const [editingCommerceTier, setEditingCommerceTier] = useState<Tier | null>(null);
  const { toast, toasts, removeToast } = useToast();
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
      
      // console.log('[TierSystem] Loading tiers with includeInactive:', showInactiveTiers);
      const tiers = await platformHomeService.getTierSystemTiers(showInactiveTiers);
      // console.log('[TierSystem] Loaded tiers:', tiers?.length, 'Inactive toggle:', showInactiveTiers);
      
      // Fix corrupted prices from API and ensure proper number format
      const correctedTiers = (tiers || []).map((tier: any) => {
        // Handle nested response structure
        const actualTier = tier?.tier || tier;
        
        // Get price from either priceMonthly or price field, convert to number
        const rawPrice = actualTier?.priceMonthly ?? (actualTier as any)?.price ?? 0;
        const numericPrice = typeof rawPrice === 'string' ? parseFloat(rawPrice) : Number(rawPrice);
        
        return {
          ...actualTier,
          priceMonthly: numericPrice
        };
      });
      
      setTiers(correctedTiers); // Handle null return
    } catch (err) {
      console.error('Failed to load tiers:', err);
      setError('Failed to load tiers');
      setTiers([]); // Ensure tiers is always an array
    } finally {
      setLoading(false);
    }
  };

  // Reload tiers when showInactiveTiers changes
  useEffect(() => {
    // console.log('[TierSystem] showInactiveTiers changed to:', showInactiveTiers);
    loadTiers();
  }, [showInactiveTiers]);

  const handleToggleTier = async (tierId: string, isActive: boolean) => {
    if (!isActive) {
      // Show confirmation modal for deactivation
      const tier = tiers.find(t => t.id === tierId);
      if (tier) {
        setDeactivatingTier(tier);
      }
      setDeactivationReason('');
      return;
    }

    // Direct activation (no confirmation needed)
    try {
      setError(null);
      
      // Use tierKey for API call
      const tier = tiers.find(t => t.id === tierId);
      const tierKey = tier?.tierKey || tierId;
      const updatedTier = await platformHomeService.updateTierStatus(tierKey, isActive);
      
      if (updatedTier) {
        // 🎯 Use the response data to update the local state immediately
        setTiers(prevTiers => 
          prevTiers.map(tier => 
            tier.id === tierId 
              ? { ...tier, isActive: true }
              : tier
          )
        );

        // 🎯 Show success toast
        const tierName = tiers.find(t => t.id === tierId)?.displayName || 'Tier';
        toast(`✅ Successfully activated "${tierName}"`, { variant: 'success' });
      } else {
        throw new Error('Failed to update tier');
      }
    } catch (err: any) {
      console.error('Failed to toggle tier:', err);
      setError(err.message || 'Failed to update tier');
      
      // Show error toast
      toast(err.message || 'Failed to update tier', { variant: 'error' });
    }
  };

  const handleConfirmDeactivation = async () => {
    if (!deactivatingTier || !deactivationReason.trim()) {
      setError('Deactivation reason is required');
      return;
    }

    try {
      setError(null);
      setSaving(true);
      
      // Use tierKey for API call
      const tierKey = deactivatingTier.tierKey || deactivatingTier.id;
      const updatedTier = await platformHomeService.updateTierStatus(tierKey, false, deactivationReason.trim());
      
      if (updatedTier) {
        // 🎯 Use the response data to update the local state immediately
        setTiers(prevTiers => 
          prevTiers.map(tier => 
            tier.id === deactivatingTier.id 
              ? { ...tier, isActive: false }
              : tier
          )
        );

        // 🎯 Show success toast
        toast(`✅ Successfully deactivated "${deactivatingTier.displayName}"`, { variant: 'success' });
        
        setDeactivatingTier(null);
        setDeactivationReason('');
      } else {
        throw new Error('Failed to deactivate tier');
      }
    } catch (err: any) {
      console.error('Failed to deactivate tier:', err);
      setError(err.message || 'Failed to deactivate tier');
      
      // Show error toast
      toast(err.message || 'Failed to deactivate tier', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelDeactivation = () => {
    setDeactivatingTier(null);
    setDeactivationReason('');
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
      
      // console.log('[TierSystem] Updating tier:', editingData.id, editingData);
      
      // Always use tierKey for API calls as the API expects tierKey in the URL path
      const tierId = editingData.tierKey || editingData.id;
      // console.log('[TierSystem] Using tierId for API call:', tierId);
      
      const updatedTier = await platformHomeService.updateTier(tierId, editingData);
      
      if (updatedTier) {
        // console.log('[TierSystem] Update response:', updatedTier);
        
        // updatedTier is now the extracted tier data (not nested)
        const tierData = updatedTier;
        // console.log('[TierSystem] Extracted tier data:', tierData);
        // console.log('[TierSystem] displayName:', tierData.displayName);
        // console.log('[TierSystem] name:', tierData.name);
        
        // 🎯 Use the response data to update the local state immediately
        setTiers(prevTiers => 
          prevTiers.map(tier => 
            tier.id === editingData.id 
              ? {
                  ...tier,
                  ...tierData, // Use the extracted tier data
                  priceMonthly: tierData.priceMonthly || tier.priceMonthly
                }
              : tier
          )
        );

        // 🎯 Show success toast with detailed information
        const displayName = tierData.displayName || tierData.name || 'Unknown';
        // console.log('[TierSystem] Toast displayName:', displayName);
        toast(`✅ Successfully updated "${displayName}"`, { variant: 'success' });
        
        setEditingTier(null);
        setEditingData(null);
      } else {
        throw new Error('Failed to save tier');
      }
    } catch (err: any) {
      console.error('Failed to save tier:', err);
      setError(err.message || 'Failed to save tier');
      
      // Show error toast
      toast(err.message || 'Failed to save tier', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Type-safe price validation
  const validateAndFormatPrice = (price: any): number => {
    // Convert to number if it's a string
    let numericPrice = typeof price === 'string' ? parseFloat(price) : price;
    
    // Validate it's a number
    if (isNaN(numericPrice) || numericPrice === null || numericPrice === undefined) {
      return 0;
    }
    
    // Ensure it's non-negative
    if (numericPrice < 0) {
      numericPrice = 0;
    }
    
    // Round to 2 decimal places to prevent floating point issues
    return Math.round(numericPrice * 100) / 100;
  };

  const handleEditChange = (field: keyof Tier, value: string | number | boolean | null) => {
    if (!editingData) return;
    
    // Special handling for price field with validation
    let processedValue = value;
    if (field === 'priceMonthly') {
      processedValue = validateAndFormatPrice(value);
    }
    
    setEditingData({
      ...editingData,
      [field]: processedValue
    });
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
      
      // Use tierKey for API call
      const tier = tiers.find(t => t.id === tierId);
      const tierKey = tier?.tierKey || tierId;
      
      // Use updateTier instead of updateTierSortOrder since the sort-order endpoint doesn't exist
      await platformHomeService.updateTier(tierKey, { sortOrder: newSortOrder });
      setSuccess('Sort order updated successfully');
      loadTiers();
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

  // V2 Commerce Feature Management Functions
  const handleOpenCommerceManager = (tier: Tier) => {
    setEditingCommerceTier(tier);
    setShowCommerceManager(true);
  };

  const handleCloseCommerceManager = () => {
    setShowCommerceManager(false);
    setEditingCommerceTier(null);
  };

  const handleToggleCommerceFeature = async (featureKey: string, isEnabled: boolean) => {
    if (!editingCommerceTier) return;

    try {
      setSaving(true);
      setError(null);

      // Update the tier's commerce features
      const updatedFeatures = editingCommerceTier.features.map(f => 
        f.featureKey === featureKey ? { ...f, isEnabled } : f
      );

      // If feature doesn't exist, add it
      if (!updatedFeatures.some(f => f.featureKey === featureKey)) {
        const newFeature: TierFeature = {
          id: `commerce_${featureKey}_${Date.now()}`,
          featureKey,
          featureName: getCommerceFeatureName(featureKey),
          isEnabled,
          isInherited: false
        };
        updatedFeatures.push(newFeature);
      }

      const updatedTier = await platformHomeService.updateTier(editingCommerceTier.tierKey, {
        ...editingCommerceTier,
        features: updatedFeatures
      });

      if (updatedTier) {
        // Update local state
        setEditingCommerceTier({ ...editingCommerceTier, features: updatedFeatures });
        setTiers(prevTiers => 
          prevTiers.map(tier => 
            tier.id === editingCommerceTier.id 
              ? { ...tier, features: updatedFeatures }
              : tier
          )
        );

        toast(`✅ ${featureKey} ${isEnabled ? 'enabled' : 'disabled'}`, { variant: 'success' });
      } else {
        throw new Error('Failed to update commerce feature');
      }
    } catch (err: any) {
      console.error('Failed to toggle commerce feature:', err);
      setError(err.message || 'Failed to update commerce feature');
      toast(err.message || 'Failed to update commerce feature', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const getCommerceFeatureName = (featureKey: string): string => {
    const names: Record<string, string> = {
      'commerce_disabled': 'Commerce Disabled',
      'commerce_enabled': 'Commerce Enabled',
      'commerce_deposit_only': 'Deposit Only Commerce',
      'commerce_full_payment': 'Full Payment Commerce',
      'commerce_both_options': 'Flexible Commerce (Both Options)'
    };
    return names[featureKey] || featureKey;
  };

  const getCommerceFeatureDescription = (featureKey: string): string => {
    const descriptions: Record<string, string> = {
      'commerce_disabled': 'Payment processing is disabled for this tier',
      'commerce_enabled': 'Basic payment processing is enabled',
      'commerce_deposit_only': 'Customers pay deposit now, complete payment in-store',
      'commerce_full_payment': 'Customers pay full amount online',
      'commerce_both_options': 'Customers choose between deposit or full payment'
    };
    return descriptions[featureKey] || 'Commerce feature';
  };

  const getCommerceFeatureState = (tier: Tier, featureKey: string): boolean => {
    const feature = tier.features.find(f => f.featureKey === featureKey);
    return feature?.isEnabled || false;
  };

  const validateCommerceFeatures = (tier: Tier): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const features = tier.features;

    // Check for conflicting commerce features
    const hasDisabled = getCommerceFeatureState(tier, 'commerce_disabled');
    const hasDepositOnly = getCommerceFeatureState(tier, 'commerce_deposit_only');
    const hasFullPayment = getCommerceFeatureState(tier, 'commerce_full_payment');
    const hasBothOptions = getCommerceFeatureState(tier, 'commerce_both_options');

    if (hasDisabled && (hasDepositOnly || hasFullPayment || hasBothOptions)) {
      errors.push('Cannot enable commerce features when commerce is disabled');
    }

    if (hasBothOptions && !hasFullPayment) {
      errors.push('Both options requires full payment to be enabled');
    }

    if (hasDepositOnly && (hasFullPayment || hasBothOptions)) {
      errors.push('Deposit only cannot be combined with other payment options');
    }

    return {
      valid: errors.length === 0,
      errors
    };
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
      const tier = await platformHomeService.createTier({
        tierKey: newTier.tierKey || '',
        name: newTier.name || '',
        displayName: newTier.displayName || '',
        description: newTier.description || '',
        priceMonthly: newTier.priceMonthly || 0,
        maxSkus: newTier.maxSkus ?? null,
        maxLocations: newTier.maxLocations || 1,
        tierType: newTier.tierType || 'individual',
        isActive: newTier.isActive ?? true,
        sortOrder: newTier.sortOrder || tiers.length + 1,
        features: newTier.features || []
      });
      
      if (tier) {
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
        setError('Failed to create tier');
      }
    } catch (err) {
      console.error('Failed to create tier:', err);
      setError('Failed to create tier');
    } finally {
      setSaving(false);
    }
  };

  const handleNewTierChange = (field: keyof Tier, value: string | number | boolean | null) => {
    // Special handling for price field with validation
    let processedValue = value;
    if (field === 'priceMonthly') {
      processedValue = validateAndFormatPrice(value);
    }
    
    setNewTier({
      ...newTier,
      [field]: processedValue
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

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Subscription Tiers</CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-4">
                  <input
                    type="checkbox"
                    id="showInactive"
                    checked={showInactiveTiers}
                    onChange={(e) => setShowInactiveTiers(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="showInactive" className="text-sm font-medium">
                    Show inactive tiers
                  </label>
                </div>
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
                {Array.isArray(tiers) && tiers
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((tier) => (
                    <div
                      key={tier.id}
                      className={`border rounded-lg p-4 space-y-3 ${!tier.isActive ? 'bg-gray-50 opacity-75 border-gray-300' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h3 className={`font-semibold text-lg ${!tier.isActive ? 'text-gray-600' : ''}`}>{tier.displayName}</h3>
                          <Badge className={getTierTypeColor(tier.tierType)}>
                            {tier.tierKey}
                          </Badge>
                          <Badge 
                            variant={tier.isActive ? 'success' : 'default'}
                            className={!tier.isActive ? 'bg-gray-200 text-gray-600 border-gray-300' : ''}
                          >
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
                              <label className="block text-sm font-medium mb-1">Price Monthly ($)</label>
                              <Input
                                type="number"
                                value={editingData?.priceMonthly ?? ''}
                                onChange={(e) => handleEditChange('priceMonthly', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                onFocus={(e) => e.target.select()}
                                placeholder="44.00"
                                step="1"
                                min="0"
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
                              <span className="ml-2">${tier.priceMonthly.toFixed(2)}/month</span>
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

                      {editingTier === tier.id && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">Features:</span>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleOpenCommerceManager(tier)}
                                variant="outline"
                                size="sm"
                              >
                                <CreditCard className="w-4 h-4 mr-1" />
                                Commerce
                              </Button>
                              <Button
                                onClick={openFeatureManager}
                                variant="outline"
                                size="sm"
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Manage Features
                              </Button>
                            </div>
                          </div>
                          
                          {/* Group direct features */}
                          {tier.features && tier.features.length > 0 ? (
                            <div className="mb-4">
                              <div className="text-xs font-medium text-gray-600 mb-2">Direct Features:</div>
                              <div className="flex flex-wrap gap-2">
                                {tier.features
                                  .filter(f => !f.isInherited)
                                  .map((feature, index) => (
                                    <Badge 
                                      key={feature.featureKey || `${feature.featureName}-${index}`} 
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
                          ) : (
                            <div className="mb-4 text-sm text-gray-500 italic">
                              No features added yet. Click "Manage Features" to add features to this tier.
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
                                      key={feature.featureKey || `${feature.featureName}-${index}`} 
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
                              {tier.features && tier.features.length > 0 ? (
                                <>
                                  {/* Direct features */}
                                  {tier.features.filter(f => !f.isInherited).length > 0 && (
                                    <div>
                                      <div className="text-xs font-medium text-gray-600 mb-2">Direct Features:</div>
                                      <div className="flex flex-wrap gap-2">
                                        {tier.features
                                          .filter(f => !f.isInherited)
                                          .map((feature, index) => (
                                            <Badge 
                                              key={feature.featureKey || `${feature.featureName}-${index}`} 
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
                                              key={feature.featureKey || `${feature.featureName}-${index}`} 
                                              variant="default" 
                                              className="text-xs opacity-75"
                                            >
                                              {feature.featureName}
                                            </Badge>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-sm text-gray-500 italic">
                                  No features configured for this tier.
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
                      .map((feature, index) => (
                        <div key={feature.featureKey || `${feature.featureName}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
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
                      .map((feature, index) => (
                        <div key={feature.featureKey || `${feature.featureName}-${index}`} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
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
              <label className="block text-sm font-medium mb-1">Price Monthly ($)</label>
              <Input
                type="number"
                value={newTier.priceMonthly ?? ''}
                onChange={(e) => handleNewTierChange('priceMonthly', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
                placeholder="44.00"
                step="1"
                min="0"
              />
              <p className="text-xs text-gray-500 mt-1">Enter price in dollars (e.g., 44 = $44.00/month)</p>
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

      {/* Deactivation Confirmation Modal */}
      <Modal
        isOpen={!!deactivatingTier}
        onClose={handleCancelDeactivation}
        title="Confirm Tier Deactivation"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> You are about to deactivate the tier "{deactivatingTier?.displayName}".
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              This will prevent new users from subscribing to this tier, but existing subscriptions will remain active.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Reason for deactivation <span className="text-red-500">*</span>
            </label>
            <textarea
              value={deactivationReason}
              onChange={(e) => setDeactivationReason(e.target.value)}
              placeholder="Please provide a reason for deactivating this tier..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            {error && error.includes('reason') && (
              <p className="text-red-500 text-sm mt-1">{error}</p>
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              onClick={handleConfirmDeactivation}
              disabled={saving || !deactivationReason.trim()}
              variant="destructive"
            >
              {saving ? 'Deactivating...' : 'Confirm Deactivation'}
            </Button>
            <Button onClick={handleCancelDeactivation} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      {/* Commerce Features Manager Modal */}
      <Modal
        isOpen={showCommerceManager}
        onClose={handleCloseCommerceManager}
        title={`Commerce Features - ${editingCommerceTier?.displayName}`}
        size="lg"
      >
        {editingCommerceTier && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">V2 Commerce Configuration</h3>
              <p className="text-sm text-gray-600 mb-4">
                Configure payment options for this tier. These features determine checkout behavior.
              </p>
              
              {/* Commerce Feature Validation */}
              {(() => {
                const validation = validateCommerceFeatures(editingCommerceTier);
                if (!validation.valid) {
                  return (
                    <Alert variant="destructive" className="mb-4">
                      <div className="font-medium">Configuration Issues:</div>
                      <ul className="mt-2 text-sm list-disc list-inside">
                        {validation.errors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </Alert>
                  );
                }
                return null;
              })()}

              {/* Commerce Features Grid */}
              <div className="space-y-4">
                {/* Commerce Disabled */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">Commerce Disabled</div>
                    <div className="text-sm text-gray-600">
                      Payment processing is disabled for this tier
                    </div>
                  </div>
                  <Button
                    onClick={() => handleToggleCommerceFeature('commerce_disabled', !getCommerceFeatureState(editingCommerceTier, 'commerce_disabled'))}
                    variant={getCommerceFeatureState(editingCommerceTier, 'commerce_disabled') ? 'default' : 'outline'}
                    size="sm"
                  >
                    {getCommerceFeatureState(editingCommerceTier, 'commerce_disabled') ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {/* Deposit Only Commerce */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">Deposit Only Commerce</div>
                    <div className="text-sm text-gray-600">
                      Customers pay deposit now, complete payment in-store
                    </div>
                    <div className="text-xs text-amber-600 mt-1">
                      Used by: Commitment tier
                    </div>
                  </div>
                  <Button
                    onClick={() => handleToggleCommerceFeature('commerce_deposit_only', !getCommerceFeatureState(editingCommerceTier, 'commerce_deposit_only'))}
                    variant={getCommerceFeatureState(editingCommerceTier, 'commerce_deposit_only') ? 'default' : 'outline'}
                    size="sm"
                  >
                    {getCommerceFeatureState(editingCommerceTier, 'commerce_deposit_only') ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {/* Full Payment Commerce */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">Full Payment Commerce</div>
                    <div className="text-sm text-gray-600">
                      Customers pay full amount online
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      Used by: Professional, Organization tiers
                    </div>
                  </div>
                  <Button
                    onClick={() => handleToggleCommerceFeature('commerce_full_payment', !getCommerceFeatureState(editingCommerceTier, 'commerce_full_payment'))}
                    variant={getCommerceFeatureState(editingCommerceTier, 'commerce_full_payment') ? 'default' : 'outline'}
                    size="sm"
                  >
                    {getCommerceFeatureState(editingCommerceTier, 'commerce_full_payment') ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {/* Flexible Commerce (Both Options) */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">Flexible Commerce (Both Options)</div>
                    <div className="text-sm text-gray-600">
                      Customers choose between deposit or full payment
                    </div>
                    <div className="text-xs text-purple-600 mt-1">
                      Used by: Enterprise, Chain Professional tiers
                    </div>
                  </div>
                  <Button
                    onClick={() => handleToggleCommerceFeature('commerce_both_options', !getCommerceFeatureState(editingCommerceTier, 'commerce_both_options'))}
                    variant={getCommerceFeatureState(editingCommerceTier, 'commerce_both_options') ? 'default' : 'outline'}
                    size="sm"
                  >
                    {getCommerceFeatureState(editingCommerceTier, 'commerce_both_options') ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>

                {/* Commerce Enabled (Fallback) */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                  <div className="flex-1">
                    <div className="font-medium text-gray-600">Commerce Enabled (Fallback)</div>
                    <div className="text-sm text-gray-500">
                      Basic payment processing enabled (used when no specific commerce features are set)
                    </div>
                  </div>
                  <Button
                    onClick={() => handleToggleCommerceFeature('commerce_enabled', !getCommerceFeatureState(editingCommerceTier, 'commerce_enabled'))}
                    variant={getCommerceFeatureState(editingCommerceTier, 'commerce_enabled') ? 'default' : 'outline'}
                    size="sm"
                  >
                    {getCommerceFeatureState(editingCommerceTier, 'commerce_enabled') ? 'Enabled' : 'Disabled'}
                  </Button>
                </div>
              </div>

              {/* Current Commerce Mode Display */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <div className="font-medium text-blue-800 mb-2">Current Checkout Mode:</div>
                <div className="text-sm text-blue-700">
                  {(() => {
                    const hasDisabled = getCommerceFeatureState(editingCommerceTier, 'commerce_disabled');
                    const hasDepositOnly = getCommerceFeatureState(editingCommerceTier, 'commerce_deposit_only');
                    const hasFullPayment = getCommerceFeatureState(editingCommerceTier, 'commerce_full_payment');
                    const hasBothOptions = getCommerceFeatureState(editingCommerceTier, 'commerce_both_options');

                    if (hasDisabled) return '❌ Commerce Disabled';
                    if (hasDepositOnly) return '💳 Deposit Only Required';
                    if (hasBothOptions) return '🔄 Flexible (Deposit or Full Payment)';
                    if (hasFullPayment) return '💰 Full Payment Only';
                    if (getCommerceFeatureState(editingCommerceTier, 'commerce_enabled')) return '✅ Commerce Enabled';
                    return '❓ No Commerce Configuration';
                  })()}
                </div>
              </div>

              {/* V2 Strategy Reference */}
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="font-medium text-amber-800 mb-2">V2 Strategy Reference:</div>
                <div className="text-sm text-amber-700 space-y-1">
                  <div><strong>Discovery/Storefront:</strong> Commerce Disabled</div>
                  <div><strong>Commitment:</strong> Deposit Only ($79/mo)</div>
                  <div><strong>E-commerce:</strong> Full Payment ($99/mo)</div>
                  <div><strong>Omnichannel:</strong> Both Options ($149/mo)</div>
                  <div><strong>Enterprise:</strong> Both Options ($499/mo)</div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={handleCloseCommerceManager}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
