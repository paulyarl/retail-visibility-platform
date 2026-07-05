/**
 * Capability Management Admin Interface
 * 
 * Tabbed admin UI for managing:
 * - Features (features_list table)
 * - Capability Types (with allowed features)
 * - Tier Capabilities (feature toggles per tier)
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  adminCapabilityService,
  CapabilityData,
  TierCapability,
  Feature,
  CapabilityType,
  Tier as CapabilityTier,
  ConstraintData,
  ConstraintMetadata,
} from '@/services/AdminCapabilityService';
import {
  tenantTierService,
  Tier,
  TierFeature,
  TierSystemFeature,
} from '@/services/TenantTierService';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, Check, X, AlertTriangle } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Switch } from '@/components/ui/Switch';
import { Pagination } from '@/components/ui/Pagination';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';

export default function CapabilityManagement() {
  // Data state
  const [capabilities, setCapabilities] = useState<CapabilityData[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [capabilityTypes, setCapabilityTypes] = useState<CapabilityType[]>([]);
  const [tiers, setTiers] = useState<CapabilityTier[]>([]);
  const [tierCapabilities, setTierCapabilities] = useState<TierCapability[]>([]);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [selectedLegacyTier, setSelectedLegacyTier] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Dialog state
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);
  const [featureForm, setFeatureForm] = useState({ feature_key: '', feature_name: '', description: '' });

  const [capTypeDialogOpen, setCapTypeDialogOpen] = useState(false);
  const [editingCapType, setEditingCapType] = useState<CapabilityType | null>(null);
  const [capTypeForm, setCapTypeForm] = useState({ capability_type_key: '', capability_type_name: '', description: '', category: '', is_active: true, sort_order: 0, allowed_features: [] as string[], tier_key: '' });
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Legacy tier system state
  const [legacyTiers, setLegacyTiers] = useState<Tier[]>([]);
  const [legacyFeatures, setLegacyFeatures] = useState<TierSystemFeature[]>([]);
  const [legacyTierDialogOpen, setLegacyTierDialogOpen] = useState(false);
  const [editingLegacyTier, setEditingLegacyTier] = useState<Tier | null>(null);
  const [legacyTierForm, setLegacyTierForm] = useState({
    tierKey: '', name: '', displayName: '', description: '', priceMonthly: 0,
    maxSkus: null as number | null, maxLocations: null as number | null,
    tierType: 'individual', isActive: true, sortOrder: 0, reason: '',
    features: [] as Array<{ featureKey: string; featureName: string; isEnabled: boolean; isInherited: boolean }>,
  });
  const [legacyFeatureDialogOpen, setLegacyFeatureDialogOpen] = useState(false);
  const [editingLegacyTierFeature, setEditingLegacyTierFeature] = useState<{ tierKey: string; feature: TierFeature } | null>(null);
  const [legacyFeatureForm, setLegacyFeatureForm] = useState({
    featureKey: '', featureName: '', isEnabled: true, isInherited: false,
    isHighlighted: false, highlightOrder: 0, highlightDescription: '', marketingName: '',
  });

  // Filter & pagination state
  const [featureSearch, setFeatureSearch] = useState('');
  const [featurePage, setFeaturePage] = useState(1);
  const [featurePageSize, setFeaturePageSize] = useState(10);
  const [capTypeSearch, setCapTypeSearch] = useState('');
  const [capTypePage, setCapTypePage] = useState(1);
  const [capTypePageSize, setCapTypePageSize] = useState(10);
  const [tierCapSearch, setTierCapSearch] = useState('');
  const [tierCapPage, setTierCapPage] = useState(1);
  const [tierCapPageSize, setTierCapPageSize] = useState(10);

  // Constraint state
  const [constraints, setConstraints] = useState<ConstraintData[]>([]);
  const [constraintDialogOpen, setConstraintDialogOpen] = useState(false);
  const [editingConstraint, setEditingConstraint] = useState<ConstraintData | null>(null);
  const [constraintMetadata, setConstraintMetadata] = useState<ConstraintMetadata | null>(null);
  const [constraintForm, setConstraintForm] = useState({
    constraint_id: '',
    type: 'requires' as string,
    severity: 'warn' as string,
    source_capability: '',
    source_field: '',
    source_operator: 'equals' as string,
    source_value: '',
    target_capability: '',
    target_field: '',
    target_operator: 'equals' as string,
    target_value: '',
    message: '',
    resolution_hint: '',
    is_active: true,
    sort_order: 0,
  });

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'feature' | 'capType' | 'tierCap' | 'constraint'; key: string; tierKey?: string; label: string } | null>(null);

  // Tier Capability dialog state
  const [tierCapDialogOpen, setTierCapDialogOpen] = useState(false);
  const [editingTierCap, setEditingTierCap] = useState<TierCapability | null>(null);
  const [tierCapForm, setTierCapForm] = useState({
    tier_key: '',
    capability_type_key: '',
    capability_enabled: true,
    is_highlighted: false,
    highlight_order: 1,
    marketing_name: '',
    features: [] as Array<{ feature_key: string; is_enabled: boolean }>,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [caps, feats, capTypes, tierList, legacyTiersList, legacyFeatsList, constraintList, metadata] = await Promise.all([
        adminCapabilityService.getAllCapabilities().catch(() => []),
        adminCapabilityService.getFeatures().catch(() => []),
        adminCapabilityService.getCapabilityTypes().catch(() => []),
        adminCapabilityService.getTiers().catch(() => []),
        tenantTierService.getTierSystemTiersList().catch(() => []),
        tenantTierService.getTierSystemFeaturesList().catch(() => []),
        adminCapabilityService.getConstraints().catch(() => []),
        adminCapabilityService.getConstraintMetadata().catch(() => null),
      ]);
      setCapabilities(Array.isArray(caps) ? caps : []);
      setFeatures(Array.isArray(feats) ? feats : []);
      setCapabilityTypes(Array.isArray(capTypes) ? capTypes : []);
      setTiers(Array.isArray(tierList) ? tierList : []);
      setLegacyTiers(Array.isArray(legacyTiersList) ? legacyTiersList : []);
      setLegacyFeatures(Array.isArray(legacyFeatsList) ? legacyFeatsList : []);
      setConstraints(Array.isArray(constraintList) ? constraintList : []);
      setConstraintMetadata(metadata);
    } catch (err) {
      console.error('Failed to load capability data:', err);
      setError('Failed to load capability data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadTierCapabilities = async (tierKey: string) => {
    if (!tierKey) return;
    try {
      const data = await adminCapabilityService.getTierCapabilities(tierKey);
      setTierCapabilities(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load tier capabilities:', err);
      setTierCapabilities([]);
    }
  };

  const handleTierSelect = (tierKey: string) => {
    setSelectedTier(tierKey);
    setActiveTab('tier-capabilities');
    loadTierCapabilities(tierKey);
  };

  // ===== Tier Capability handlers =====
  const openTierCapDialog = (tierKey?: string) => {
    setEditingTierCap(null);
    const selectedCapType = capabilityTypes[0];
    const allowedFeatures = selectedCapType?.allowed_features || [];
    setTierCapForm({
      tier_key: tierKey || selectedTier || '',
      capability_type_key: '',
      capability_enabled: true,
      is_highlighted: false,
      highlight_order: 1,
      marketing_name: '',
      features: allowedFeatures.map(fk => ({ feature_key: fk, is_enabled: false })),
    });
    setTierCapDialogOpen(true);
  };

  const openTierCapEditDialog = (cap: TierCapability) => {
    setEditingTierCap(cap);
    const capType = capabilityTypes.find(ct => ct.capability_type_key === cap.capability_type_key);
    const allowedFeatures = capType?.allowed_features || [];
    const features = allowedFeatures.map(fk => {
      const existing = cap.features.find(f => f.feature_key === fk);
      return { feature_key: fk, is_enabled: existing?.is_enabled ?? false };
    });
    setTierCapForm({
      tier_key: cap.tier_key,
      capability_type_key: cap.capability_type_key,
      capability_enabled: cap.capability_enabled,
      is_highlighted: cap.is_highlighted,
      highlight_order: cap.highlight_order,
      marketing_name: cap.marketing_name || '',
      features,
    });
    setTierCapDialogOpen(true);
  };

  const handleTierCapFormCapTypeChange = (capTypeKey: string) => {
    const capType = capabilityTypes.find(ct => ct.capability_type_key === capTypeKey);
    const allowedFeatures = capType?.allowed_features || [];
    setTierCapForm(prev => ({
      ...prev,
      capability_type_key: capTypeKey,
      marketing_name: capType?.capability_type_name || '',
      features: allowedFeatures.map(fk => {
        const existing = prev.features.find(f => f.feature_key === fk);
        return { feature_key: fk, is_enabled: existing?.is_enabled || false };
      }),
    }));
  };

  const handleTierCapFeatureToggle = (featureKey: string) => {
    setTierCapForm(prev => ({
      ...prev,
      features: prev.features.map(f =>
        f.feature_key === featureKey ? { ...f, is_enabled: !f.is_enabled } : f
      ),
    }));
  };

  const handleTierCapSave = async () => {
    if (tierCapForm.features.length > 0 && !tierCapForm.features.some(f => f.is_enabled)) {
      setError('At least one feature must be enabled (including the _disabled key for explicit disengagement)');
      return;
    }
    try {
      setSaving(true);
      if (editingTierCap) {
        await adminCapabilityService.updateTierCapabilities(tierCapForm.tier_key, {
          tier_key: tierCapForm.tier_key,
          capability_type_key: tierCapForm.capability_type_key,
          capability_enabled: tierCapForm.capability_enabled,
          is_highlighted: tierCapForm.is_highlighted,
          highlight_order: tierCapForm.highlight_order,
          marketing_name: tierCapForm.marketing_name,
          features: tierCapForm.features,
        });
      } else {
        await adminCapabilityService.createTierCapability(tierCapForm);
      }
      setTierCapDialogOpen(false);
      if (tierCapForm.tier_key) {
        await loadTierCapabilities(tierCapForm.tier_key);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to save tier capability:', err);
      setError('Failed to save tier capability');
    } finally {
      setSaving(false);
    }
  };

  const handleTierCapDelete = (tierKey: string, capabilityTypeKey: string) => {
    setDeleteTarget({ type: 'tierCap', key: capabilityTypeKey, tierKey, label: `${capabilityTypeKey} from tier ${tierKey}` });
    setDeleteDialogOpen(true);
  };

  const handleTierCapDeleteConfirm = async () => {
    if (!deleteTarget || deleteTarget.type !== 'tierCap' || !deleteTarget.tierKey) return;
    try {
      await adminCapabilityService.deleteTierCapability(deleteTarget.tierKey, deleteTarget.key);
      await loadTierCapabilities(deleteTarget.tierKey);
      await loadData();
    } catch (err) {
      console.error('Failed to delete tier capability:', err);
      setError('Failed to delete tier capability');
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  // ===== Feature handlers =====
  const handleFeatureToggle = (capabilityIndex: number, featureIndex: number) => {
    const updated = [...tierCapabilities];
    updated[capabilityIndex].features[featureIndex].is_enabled = !updated[capabilityIndex].features[featureIndex].is_enabled;
    setTierCapabilities(updated);
  };

  const openFeatureDialog = (feature?: Feature) => {
    if (feature) {
      setEditingFeature(feature);
      setFeatureForm({ feature_key: feature.feature_key, feature_name: feature.feature_name, description: feature.description || '' });
    } else {
      setEditingFeature(null);
      setFeatureForm({ feature_key: '', feature_name: '', description: '' });
    }
    setFeatureDialogOpen(true);
  };

  const handleFeatureSave = async () => {
    try {
      setSaving(true);
      if (editingFeature) {
        await adminCapabilityService.updateFeature(featureForm);
      } else {
        await adminCapabilityService.createFeature(featureForm);
      }
      setFeatureDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save feature:', err);
      setError('Failed to save feature');
    } finally {
      setSaving(false);
    }
  };

  const handleFeatureDelete = (featureKey: string) => {
    setDeleteTarget({ type: 'feature', key: featureKey, label: featureKey });
    setDeleteDialogOpen(true);
  };

  const handleFeatureDeleteConfirm = async () => {
    if (!deleteTarget || deleteTarget.type !== 'feature') return;
    try {
      await adminCapabilityService.deleteFeature(deleteTarget.key);
      await loadData();
    } catch (err) {
      console.error('Failed to delete feature:', err);
      setError('Failed to delete feature');
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  // ===== Capability Type handlers =====
  const openCapTypeDialog = (capType?: CapabilityType) => {
    if (capType) {
      setEditingCapType(capType);
      const capData = capabilities.find(c => c.capability_type_key === capType.capability_type_key);
      setCapTypeForm({
        capability_type_key: capType.capability_type_key,
        capability_type_name: capType.capability_type_name,
        description: capType.description || '',
        category: capType.category || '',
        is_active: capType.is_active ?? true,
        sort_order: capType.sort_order ?? 0,
        allowed_features: capType.allowed_features || [],
        tier_key: capData?.tier_key || '',
      });
      setIsNewCategory(false);
      setNewCategoryName('');
    } else {
      setEditingCapType(null);
      setCapTypeForm({ capability_type_key: '', capability_type_name: '', description: '', category: '', is_active: true, sort_order: 0, allowed_features: [], tier_key: '' });
      setIsNewCategory(false);
      setNewCategoryName('');
    }
    setCapTypeDialogOpen(true);
  };

  const handleCapTypeFeatureToggle = (featureKey: string) => {
    setCapTypeForm(prev => ({
      ...prev,
      allowed_features: prev.allowed_features.includes(featureKey)
        ? prev.allowed_features.filter(f => f !== featureKey)
        : [...prev.allowed_features, featureKey],
    }));
  };

  const handleCapTypeSave = async () => {
    const data = { ...capTypeForm, category: isNewCategory ? newCategoryName : capTypeForm.category };
    try {
      setSaving(true);
      if (editingCapType) {
        await adminCapabilityService.updateCapabilityType(data);
      } else {
        await adminCapabilityService.createCapabilityType(data);
      }
      // If a tier was selected, also assign this capability type to that tier
      if (data.tier_key) {
        await adminCapabilityService.createTierCapability({
          tier_key: data.tier_key,
          capability_type_key: data.capability_type_key,
          capability_enabled: true,
          is_highlighted: false,
          highlight_order: 0,
          marketing_name: '',
          features: data.allowed_features.map(fk => ({ feature_key: fk, is_enabled: true })),
        });
      }
      setCapTypeDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save capability type:', err);
      setError('Failed to save capability type');
    } finally {
      setSaving(false);
    }
  };

  const handleCapTypeDelete = (key: string) => {
    const capType = capabilityTypes.find(ct => ct.capability_type_key === key);
    setDeleteTarget({ type: 'capType', key, label: capType?.capability_type_name || key });
    setDeleteDialogOpen(true);
  };

  const handleCapTypeDeleteConfirm = async () => {
    if (!deleteTarget || deleteTarget.type !== 'capType') return;
    try {
      await adminCapabilityService.deleteCapabilityType(deleteTarget.key);
      await loadData();
    } catch (err) {
      console.error('Failed to delete capability type:', err);
      setError('Failed to delete capability type');
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  // ===== Tier Capability save =====
  const handleTierSave = async () => {
    try {
      setSaving(true);
      const updateData = {
        tier_key: selectedTier,
        capability_type_key: tierCapabilities[0]?.capability_type_key || 'product_type',
        capability_enabled: true,
        is_highlighted: true,
        highlight_order: 1,
        marketing_name: `${selectedTier.charAt(0).toUpperCase() + selectedTier.slice(1)} Product Types`,
        features: tierCapabilities[0]?.features?.map(f => ({
          feature_key: f.feature_key,
          is_enabled: f.is_enabled,
        })) || [],
      };
      await adminCapabilityService.updateTierCapabilities(selectedTier, updateData);

      // Also update the tier's feature list
      const enabledFeatures = tierCapabilities[0]?.features?.filter(f => f.is_enabled).map(f => f.feature_key) || [];
      await adminCapabilityService.updateTier({
        tier_key: selectedTier,
        features: enabledFeatures,
      });

      await loadData();
      await loadTierCapabilities(selectedTier);
      setError(null);
    } catch (err) {
      console.error('Failed to save tier capabilities:', err);
      setError('Failed to save tier capabilities');
    } finally {
      setSaving(false);
    }
  };

  // ===== Legacy Tier handlers =====
  const openLegacyTierDialog = (tier?: Tier) => {
    if (tier) {
      setEditingLegacyTier(tier);
      setLegacyTierForm({
        tierKey: tier.tierKey,
        name: tier.name,
        displayName: tier.displayName,
        description: tier.description || '',
        priceMonthly: tier.priceMonthly,
        maxSkus: tier.maxSkus,
        maxLocations: tier.maxLocations,
        tierType: tier.tierType,
        isActive: tier.isActive,
        sortOrder: tier.sortOrder,
        reason: '',
        features: tier.features.map(f => ({
          featureKey: f.featureKey,
          featureName: f.featureName,
          isEnabled: f.isEnabled,
          isInherited: f.isInherited,
        })),
      });
    } else {
      setEditingLegacyTier(null);
      setLegacyTierForm({
        tierKey: '', name: '', displayName: '', description: '', priceMonthly: 0,
        maxSkus: null, maxLocations: null, tierType: 'individual', isActive: true, sortOrder: 0, reason: '',
        features: [],
      });
    }
    setLegacyTierDialogOpen(true);
  };

  const handleLegacyTierSave = async () => {
    try {
      setSaving(true);
      if (editingLegacyTier) {
        const { tierKey, reason, ...updateData } = legacyTierForm;
        await tenantTierService.patchTier(tierKey, {
          ...updateData,
          features: legacyTierForm.features,
          reason: reason || 'Updated via admin UI',
        });
      } else {
        await tenantTierService.createTier({
          ...legacyTierForm,
          features: legacyTierForm.features.map((f, idx) => ({
            id: `new-${idx}`,
            featureKey: f.featureKey,
            featureName: f.featureName,
            isEnabled: f.isEnabled,
            isInherited: f.isInherited,
            isHighlighted: false,
            highlightOrder: 0,
            highlightDescription: null,
            marketingName: null,
          })),
          reason: legacyTierForm.reason || 'Created via admin UI',
        });
      }
      setLegacyTierDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save legacy tier:', err);
      setError('Failed to save legacy tier');
    } finally {
      setSaving(false);
    }
  };

  const handleLegacyTierDelete = async (tierKey: string) => {
    if (!confirm('Are you sure you want to deactivate this tier?')) return;
    try {
      await tenantTierService.deleteTier(tierKey, 'Deactivated via admin UI');
      await loadData();
    } catch (err) {
      console.error('Failed to delete legacy tier:', err);
      setError('Failed to delete legacy tier');
    }
  };

  const openLegacyFeatureDialog = (tierKey: string, feature?: TierFeature) => {
    if (feature) {
      setEditingLegacyTierFeature({ tierKey, feature });
      setLegacyFeatureForm({
        featureKey: feature.featureKey,
        featureName: feature.featureName,
        isEnabled: feature.isEnabled,
        isInherited: feature.isInherited,
        isHighlighted: feature.isHighlighted,
        highlightOrder: feature.highlightOrder,
        highlightDescription: feature.highlightDescription || '',
        marketingName: feature.marketingName || '',
      });
    } else {
      setEditingLegacyTierFeature(null);
      setLegacyFeatureForm({
        featureKey: '', featureName: '', isEnabled: true, isInherited: false,
        isHighlighted: false, highlightOrder: 0, highlightDescription: '', marketingName: '',
      });
    }
    setLegacyFeatureDialogOpen(true);
  };

  const handleLegacyFeatureSave = async () => {
    if (!editingLegacyTierFeature && !legacyTierForm.tierKey) return;
    const tierKey = editingLegacyTierFeature?.tierKey || legacyTierForm.tierKey;
    const tier = legacyTiers.find(t => t.tierKey === tierKey);
    if (!tier) return;

    try {
      setSaving(true);
      const existingFeatures = tier.features.filter(f =>
        !editingLegacyTierFeature || f.featureKey !== editingLegacyTierFeature.feature.featureKey
      );

      const newFeature: TierFeature = {
        id: editingLegacyTierFeature?.feature.id || '',
        featureKey: legacyFeatureForm.featureKey,
        featureName: legacyFeatureForm.featureName,
        isEnabled: legacyFeatureForm.isEnabled,
        isInherited: legacyFeatureForm.isInherited,
        isHighlighted: legacyFeatureForm.isHighlighted,
        highlightOrder: legacyFeatureForm.highlightOrder,
        highlightDescription: legacyFeatureForm.highlightDescription || null,
        marketingName: legacyFeatureForm.marketingName || null,
      };

      const allFeatures = [...existingFeatures, newFeature];

      await tenantTierService.patchTier(tierKey, {
        features: allFeatures.map(f => ({
          id: f.id || undefined,
          featureKey: f.featureKey,
          featureName: f.featureName,
          isEnabled: f.isEnabled,
          isInherited: f.isInherited,
          isHighlighted: f.isHighlighted,
          highlightOrder: f.highlightOrder,
          highlightDescription: f.highlightDescription,
          marketingName: f.marketingName,
        })),
        reason: `Updated feature ${legacyFeatureForm.featureKey} via admin UI`,
      });

      setLegacyFeatureDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save legacy feature:', err);
      setError('Failed to save legacy feature');
    } finally {
      setSaving(false);
    }
  };

  const handleLegacyFeatureDelete = async (tierKey: string, featureKey: string) => {
    if (!confirm('Remove this feature from the tier?')) return;
    const tier = legacyTiers.find(t => t.tierKey === tierKey);
    if (!tier) return;

    try {
      const remainingFeatures = tier.features.filter(f => f.featureKey !== featureKey);
      await tenantTierService.patchTier(tierKey, {
        features: remainingFeatures.map(f => ({
          id: f.id,
          featureKey: f.featureKey,
          featureName: f.featureName,
          isEnabled: f.isEnabled,
          isInherited: f.isInherited,
          isHighlighted: f.isHighlighted,
          highlightOrder: f.highlightOrder,
          highlightDescription: f.highlightDescription,
          marketingName: f.marketingName,
        })),
        reason: `Removed feature ${featureKey} via admin UI`,
      });
      await loadData();
    } catch (err) {
      console.error('Failed to remove legacy feature:', err);
      setError('Failed to remove legacy feature');
    }
  };

  // ===== Constraint handlers =====
  const openConstraintDialog = (constraint?: ConstraintData) => {
    if (constraint) {
      setEditingConstraint(constraint);
      setConstraintForm({
        constraint_id: constraint.constraint_id,
        type: constraint.type,
        severity: constraint.severity,
        source_capability: constraint.source_capability,
        source_field: constraint.source_field,
        source_operator: constraint.source_operator,
        source_value: constraint.source_value,
        target_capability: constraint.target_capability,
        target_field: constraint.target_field,
        target_operator: constraint.target_operator,
        target_value: constraint.target_value,
        message: constraint.message,
        resolution_hint: constraint.resolution_hint,
        is_active: constraint.is_active,
        sort_order: constraint.sort_order,
      });
    } else {
      setEditingConstraint(null);
      setConstraintForm({
        constraint_id: '', type: 'requires', severity: 'warn',
        source_capability: '', source_field: '', source_operator: 'equals', source_value: '',
        target_capability: '', target_field: '', target_operator: 'equals', target_value: '',
        message: '', resolution_hint: '', is_active: true, sort_order: 0,
      });
    }
    setConstraintDialogOpen(true);
  };

  const getCapOptions = () => {
    if (!constraintMetadata) return [];
    return [...constraintMetadata.capabilities]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(c => ({ value: c.key, label: c.label }));
  };

  const getFieldOptions = (capKey: string) => {
    if (!constraintMetadata) return [];
    const cap = constraintMetadata.capabilities.find(c => c.key === capKey);
    if (!cap) return [];
    return [...cap.fields]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(f => ({ value: f.field, label: f.label }));
  };

  const getOperatorOptions = (capKey: string, field: string) => {
    if (!constraintMetadata) return [];
    const cap = constraintMetadata.capabilities.find(c => c.key === capKey);
    if (!cap) return [];
    const f = cap.fields.find(fld => fld.field === field);
    if (!f) return [];
    return f.operators.map(op => ({ value: op, label: op }));
  };

  const getValueOptions = (capKey: string, field: string) => {
    if (!constraintMetadata) return [];
    const cap = constraintMetadata.capabilities.find(c => c.key === capKey);
    if (!cap) return [];
    const f = cap.fields.find(fld => fld.field === field);
    if (!f || !f.values) return [];
    return f.values.map(v => ({ value: v, label: v }));
  };

  const handleSourceCapChange = (capKey: string) => {
    const fields = getFieldOptions(capKey);
    const firstField = fields[0]?.value || '';
    const ops = getOperatorOptions(capKey, firstField);
    const firstOp = ops[0]?.value || 'equals';
    const vals = getValueOptions(capKey, firstField);
    const firstVal = vals[0]?.value || '';
    setConstraintForm(prev => ({
      ...prev,
      source_capability: capKey,
      source_field: firstField,
      source_operator: firstOp,
      source_value: firstVal,
    }));
  };

  const handleSourceFieldChange = (field: string) => {
    const ops = getOperatorOptions(constraintForm.source_capability, field);
    const firstOp = ops[0]?.value || 'equals';
    const vals = getValueOptions(constraintForm.source_capability, field);
    const firstVal = vals[0]?.value || '';
    setConstraintForm(prev => ({
      ...prev,
      source_field: field,
      source_operator: firstOp,
      source_value: firstVal,
    }));
  };

  const handleTargetCapChange = (capKey: string) => {
    const fields = getFieldOptions(capKey);
    const firstField = fields[0]?.value || '';
    const ops = getOperatorOptions(capKey, firstField);
    const firstOp = ops[0]?.value || 'equals';
    const vals = getValueOptions(capKey, firstField);
    const firstVal = vals[0]?.value || '';
    setConstraintForm(prev => ({
      ...prev,
      target_capability: capKey,
      target_field: firstField,
      target_operator: firstOp,
      target_value: firstVal,
    }));
  };

  const handleTargetFieldChange = (field: string) => {
    const ops = getOperatorOptions(constraintForm.target_capability, field);
    const firstOp = ops[0]?.value || 'equals';
    const vals = getValueOptions(constraintForm.target_capability, field);
    const firstVal = vals[0]?.value || '';
    setConstraintForm(prev => ({
      ...prev,
      target_field: field,
      target_operator: firstOp,
      target_value: firstVal,
    }));
  };

  const handleConstraintSave = async () => {
    try {
      setSaving(true);
      if (editingConstraint) {
        await adminCapabilityService.updateConstraint(editingConstraint.id, constraintForm);
      } else {
        await adminCapabilityService.createConstraint(constraintForm);
      }
      setConstraintDialogOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save constraint:', err);
      setError('Failed to save constraint');
    } finally {
      setSaving(false);
    }
  };

  const handleConstraintDelete = (constraint: ConstraintData) => {
    setDeleteTarget({ type: 'constraint', key: constraint.id, label: constraint.constraint_id });
    setDeleteDialogOpen(true);
  };

  const handleConstraintDeleteConfirm = async () => {
    if (!deleteTarget || deleteTarget.type !== 'constraint') return;
    try {
      await adminCapabilityService.deleteConstraint(deleteTarget.key);
      await loadData();
    } catch (err) {
      console.error('Failed to delete constraint:', err);
      setError('Failed to delete constraint');
    } finally {
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  // Helper: find features from features_list that are NOT in the tier's tier_features_list
  const getAvailableFeaturesForLegacyTier = (tier: Tier): TierSystemFeature[] => {
    const tierFeatureKeys = new Set(tier.features.map(f => f.featureKey));
    return legacyFeatures.filter(f => !tierFeatureKeys.has(f.featureKey));
  };

  if (loading) return <div className="p-6 text-center text-gray-500">Loading capability management...</div>;
  if (error && !capabilities.length) return <div className="p-6 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Capability Management</h1>
        <p className="text-gray-500">Manage features, capability types, and tier capability assignments</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">{error}</div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="capability-types">Capability Types</TabsTrigger>
          <TabsTrigger value="tier-capabilities">Tier Capabilities</TabsTrigger>
          <TabsTrigger value="legacy-tiers">Legacy Tiers</TabsTrigger>
          <TabsTrigger value="constraints">Constraints</TabsTrigger>
          <TabsTrigger value="tier-coverage">Tier Coverage</TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW TAB ===== */}
        <TabsContent value="overview">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Capability Overview</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capability Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Features</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {capabilities.map((cap) => (
                    <tr key={`${cap.tier_key}-${cap.capability_type_key}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{cap.tier_name}</div>
                        <div className="text-xs text-gray-500">{cap.tier_key}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{cap.capability_type_name}</div>
                        <div className="text-xs text-gray-500">{cap.capability_type_key}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="info">{cap.category}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{cap.feature_count} features</div>
                        <div className="text-xs text-gray-500">{cap.features_in_capability}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button variant="gradient" style={{ color: 'white' }} size="md" onClick={() => handleTierSelect(cap.tier_key)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ===== FEATURES TAB ===== */}
        <TabsContent value="features">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Features</h2>
                <p className="text-sm text-gray-500">Manage the features available in the system</p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Search features..."
                  value={featureSearch}
                  onChange={(e) => { setFeatureSearch(e.target.value); setFeaturePage(1); }}
                  className="w-56"
                />
                <Button variant="gradient" style={{ color: 'white' }} onClick={() => openFeatureDialog()} size="md">
                  + Add Feature
                </Button>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {(() => {
                const filtered = features.filter(f =>
                  !featureSearch ||
                  f.feature_name.toLowerCase().includes(featureSearch.toLowerCase()) ||
                  f.feature_key.toLowerCase().includes(featureSearch.toLowerCase()) ||
                  (f.description || '').toLowerCase().includes(featureSearch.toLowerCase())
                );
                const start = (featurePage - 1) * featurePageSize;
                const paged = filtered.slice(start, start + featurePageSize);
                if (filtered.length === 0) return <div className="px-6 py-8 text-center text-gray-500">{featureSearch ? 'No features match your search' : 'No features defined yet'}</div>;
                return paged.map((feature) => (
                  <div key={feature.feature_key} className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{feature.feature_name}</div>
                      <div className="text-xs text-gray-500">{feature.feature_key}</div>
                      {feature.description && (
                        <div className="text-xs text-gray-400 mt-1">{feature.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openFeatureDialog(feature)}>
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleFeatureDelete(feature.feature_key)} className="text-red-600 hover:text-red-800">
                        Delete
                      </Button>
                    </div>
                  </div>
                ));
              })()}
            </div>
            <Pagination
              currentPage={featurePage}
              totalItems={features.filter(f =>
                !featureSearch ||
                f.feature_name.toLowerCase().includes(featureSearch.toLowerCase()) ||
                f.feature_key.toLowerCase().includes(featureSearch.toLowerCase()) ||
                (f.description || '').toLowerCase().includes(featureSearch.toLowerCase())
              ).length}
              pageSize={featurePageSize}
              onPageChange={setFeaturePage}
              onPageSizeChange={(s) => { setFeaturePageSize(s); setFeaturePage(1); }}
            />
          </div>
        </TabsContent>

        {/* ===== CAPABILITY TYPES TAB ===== */}
        <TabsContent value="capability-types">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Capability Types</h2>
                <p className="text-sm text-gray-500">Define capability types — each type groups a collection of features from the master features list</p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Search capability types..."
                  value={capTypeSearch}
                  onChange={(e) => { setCapTypeSearch(e.target.value); setCapTypePage(1); }}
                  className="w-56"
                />
                <Button onClick={() => openCapTypeDialog()} size="sm">
                  + Add Capability Type
                </Button>
              </div>
            </div>
            <div className="p-6 grid gap-4">
              {(() => {
                const filtered = capabilityTypes.filter(ct =>
                  !capTypeSearch ||
                  ct.capability_type_name.toLowerCase().includes(capTypeSearch.toLowerCase()) ||
                  ct.capability_type_key.toLowerCase().includes(capTypeSearch.toLowerCase()) ||
                  (ct.description || '').toLowerCase().includes(capTypeSearch.toLowerCase())
                );
                const start = (capTypePage - 1) * capTypePageSize;
                const paged = filtered.slice(start, start + capTypePageSize);
                if (filtered.length === 0) return <div className="py-8 text-center text-gray-500">{capTypeSearch ? 'No capability types match your search' : 'No capability types defined yet. Create one to group features for tier assignment.'}</div>;
                return paged.map((capType) => (
                  <div key={capType.capability_type_key} className="rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-slate-50/80">
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{capType.capability_type_name}</span>
                          <Badge variant="info">{capType.allowed_features?.length || 0} features</Badge>
                          {capType.category && <Badge variant="default">{capType.category}</Badge>}
                          {capType.is_active === false && <Badge variant="destructive">Inactive</Badge>}
                        </div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">{capType.capability_type_key}{capType.sort_order ? ` · sort: ${capType.sort_order}` : ''}</div>
                        {capType.description && (
                          <div className="text-xs text-gray-500 mt-1">{capType.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openCapTypeDialog(capType)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleCapTypeDelete(capType.capability_type_key)} className="text-red-600 hover:text-red-800">
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className="mx-5 mb-4 rounded-lg border border-gray-100 bg-white/60 p-3">
                      <div className="text-xs font-medium text-gray-600 mb-2">Feature Collection:</div>
                      {capType.allowed_features && capType.allowed_features.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          {[...capType.allowed_features].sort((a, b) => a.localeCompare(b)).map((featKey) => {
                            const feat = features.find(f => f.feature_key === featKey);
                            return (
                              <div key={featKey} className="flex items-center gap-1.5 text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                <span className="text-gray-800">{feat?.feature_name || featKey}</span>
                                <span className="text-gray-400 font-mono">({featKey})</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No features assigned — edit to add features from the master list</span>
                      )}
                    </div>
                  </div>
                ));
              })()}
            </div>
            <Pagination
              currentPage={capTypePage}
              totalItems={capabilityTypes.filter(ct =>
                !capTypeSearch ||
                ct.capability_type_name.toLowerCase().includes(capTypeSearch.toLowerCase()) ||
                ct.capability_type_key.toLowerCase().includes(capTypeSearch.toLowerCase()) ||
                (ct.description || '').toLowerCase().includes(capTypeSearch.toLowerCase())
              ).length}
              pageSize={capTypePageSize}
              onPageChange={setCapTypePage}
              onPageSizeChange={(s) => { setCapTypePageSize(s); setCapTypePage(1); }}
            />
          </div>
        </TabsContent>

        {/* ===== TIER CAPABILITIES TAB ===== */}
        <TabsContent value="tier-capabilities">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Tier Capabilities</h2>
                <p className="text-sm text-gray-500">Assign capability types to tiers and toggle features</p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  placeholder="Search capabilities..."
                  value={tierCapSearch}
                  onChange={(e) => { setTierCapSearch(e.target.value); setTierCapPage(1); }}
                  className="w-56"
                />
                <Button onClick={() => openTierCapDialog()} size="sm" disabled={legacyTiers.length === 0 || capabilityTypes.length === 0}>
                  + Add Capability
                </Button>
              </div>
            </div>

            {/* Tier selector from Legacy Tiers */}
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-gray-700">Select Tier:</span>
              <div className="flex gap-2 flex-wrap">
                {legacyTiers.map((tier) => (
                  <Button
                    key={tier.tierKey}
                    variant={selectedTier === tier.tierKey ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTierSelect(tier.tierKey)}
                  >
                    {tier.displayName}
                    {!tier.isActive && <span className="ml-1 text-xs opacity-60">(inactive)</span>}
                  </Button>
                ))}
              </div>
            </div>

            {selectedTier ? (
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-md font-semibold text-gray-900">
                    {legacyTiers.find(t => t.tierKey === selectedTier)?.displayName || selectedTier} Tier
                  </h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setSelectedTier(''); setTierCapabilities([]); }}>
                      Deselect
                    </Button>
                    <Button size="sm" onClick={handleTierSave} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>

                {(() => {
                  const filtered = tierCapabilities.filter(tc =>
                    !tierCapSearch ||
                    tc.capability_type_name.toLowerCase().includes(tierCapSearch.toLowerCase()) ||
                    tc.capability_type_key.toLowerCase().includes(tierCapSearch.toLowerCase()) ||
                    tc.features.some(f => f.feature_name.toLowerCase().includes(tierCapSearch.toLowerCase()) || f.feature_key.toLowerCase().includes(tierCapSearch.toLowerCase()))
                  );
                  const start = (tierCapPage - 1) * tierCapPageSize;
                  const paged = filtered.slice(start, start + tierCapPageSize);
                  if (filtered.length === 0) return (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-3">{tierCapSearch ? 'No capabilities match your search' : 'No capability types assigned to this tier yet.'}</p>
                      {!tierCapSearch && <Button size="sm" onClick={() => openTierCapDialog(selectedTier)}>+ Add Capability Type</Button>}
                    </div>
                  );
                  return (
                    <>
                      {paged.map((capability, capIdx) => {
                        const isUncategorized = !capability.capability_category;
                        return (
                    <div key={capability.capability_type_key} className="mb-6 border rounded-lg overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-800">{capability.capability_type_name}</h4>
                          <p className="text-xs text-gray-500">{capability.capability_type_key}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={capability.capability_enabled ? 'success' : 'default'}>
                            {capability.capability_enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                          {capability.is_highlighted && (
                            <Badge variant="info">Highlighted</Badge>
                          )}
                          {!isUncategorized && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openTierCapEditDialog(capability)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleTierCapDelete(selectedTier, capability.capability_type_key)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Remove
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="p-4 space-y-3">
                        {capability.features.map((feature, featIdx) => (
                          <div
                            key={feature.feature_key}
                            className={`border rounded-lg p-4 flex items-center justify-between transition-colors ${
                              feature.is_enabled ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {!isUncategorized && (
                                <Switch
                                  checked={feature.is_enabled}
                                  onCheckedChange={() => handleFeatureToggle(capIdx, featIdx)}
                                />
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">{feature.feature_name}</div>
                                <div className="text-xs text-gray-500">{feature.feature_key}</div>
                              </div>
                            </div>
                            <Badge variant={feature.is_enabled ? 'success' : 'default'}>
                              {feature.is_enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                        );
                      })}
                      <Pagination
                        currentPage={tierCapPage}
                        totalItems={filtered.length}
                        pageSize={tierCapPageSize}
                        onPageChange={setTierCapPage}
                        onPageSizeChange={(s) => { setTierCapPageSize(s); setTierCapPage(1); }}
                      />
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="p-6">
                {(() => {
                  const unassigned = capabilities.filter(c => !c.tier_key);
                  if (unassigned.length === 0) return (
                    <div className="py-8 text-center text-gray-500">
                      Select a tier above to manage its capabilities
                    </div>
                  );
                  return (
                    <>
                      <h3 className="text-md font-semibold text-gray-900 mb-4">Unassigned Capability Types</h3>
                      <p className="text-sm text-gray-500 mb-4">These capability types are not assigned to any tier. Use the <strong>Capability Types</strong> tab to edit and assign a tier, or the <strong>Legacy Tiers</strong> tab to manage feature toggles.</p>
                      <div className="space-y-4">
                        {unassigned.map(cap => (
                          <div key={cap.capability_type_key} className="border rounded-lg overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-800">{cap.capability_type_name}</h4>
                                <p className="text-xs text-gray-500">{cap.capability_type_key}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {cap.category && <Badge variant="default">{cap.category}</Badge>}
                                <Badge variant="default">{cap.feature_count} features</Badge>
                              </div>
                            </div>
                            <div className="p-4">
                              <div className="text-xs text-gray-500">
                                Features: {cap.features_in_capability || 'none'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </TabsContent>
        {/* ===== LEGACY TIERS TAB ===== */}
        <TabsContent value="legacy-tiers">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Legacy Tiers</h2>
                <p className="text-sm text-gray-500">
                  Manage subscription_tiers_list &amp; tier_features_list (legacy inheritance system)
                </p>
              </div>
              <Button onClick={() => openLegacyTierDialog()} size="sm">
                + Add Tier
              </Button>
            </div>

            {/* Tier selector */}
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-gray-700">Select Tier:</span>
              <div className="flex gap-2 flex-wrap">
                {legacyTiers.map((tier) => (
                  <Button
                    key={tier.tierKey}
                    variant={selectedLegacyTier === tier.tierKey ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedLegacyTier(tier.tierKey)}
                  >
                    {tier.displayName}
                    {!tier.isActive && <span className="ml-1 text-xs opacity-60">(inactive)</span>}
                  </Button>
                ))}
              </div>
            </div>

            {legacyTiers.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">No legacy tiers found</div>
            ) : selectedLegacyTier ? (() => {
              const tier = legacyTiers.find(t => t.tierKey === selectedLegacyTier);
              if (!tier) return <div className="px-6 py-8 text-center text-gray-500">Tier not found</div>;
              return (
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-md font-semibold text-gray-900">{tier.displayName}</h3>
                        <Badge variant={tier.isActive ? 'success' : 'default'}>
                          {tier.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="info">{tier.tierType}</Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Key: {tier.tierKey} · ${tier.priceMonthly}/mo
                        {tier.maxSkus && ` · Max SKUs: ${tier.maxSkus}`}
                        {tier.maxLocations && ` · Max Locations: ${tier.maxLocations}`}
                      </div>
                      {tier.description && (
                        <div className="text-xs text-gray-400 mt-1">{tier.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedLegacyTier('')}>
                        Deselect
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openLegacyTierDialog(tier)}>
                        Edit Tier
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLegacyTierDelete(tier.tierKey)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Deactivate
                      </Button>
                    </div>
                  </div>

                  {/* Tier Features */}
                  <div className="border-l-2 border-gray-100 pl-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                        Features ({tier.features.length})
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openLegacyFeatureDialog(tier.tierKey)}
                        className="text-xs"
                      >
                        + Add Feature
                      </Button>
                    </div>
                    {tier.features.length === 0 ? (
                      <div className="text-xs text-gray-400 py-2">No features assigned</div>
                    ) : (
                      <div className="space-y-1.5">
                        {tier.features.map((feat) => (
                          <div
                            key={feat.id || feat.featureKey}
                            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                              feat.isEnabled
                                ? 'bg-green-50 border border-green-200'
                                : 'bg-gray-50 border border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={feat.isEnabled}
                                onCheckedChange={async (checked) => {
                                  const updatedFeatures = tier.features.map(f =>
                                    f.featureKey === feat.featureKey ? { ...f, isEnabled: checked } : f
                                  );
                                  try {
                                    await tenantTierService.patchTier(tier.tierKey, {
                                      features: updatedFeatures.map(f => ({
                                        id: f.id,
                                        featureKey: f.featureKey,
                                        featureName: f.featureName,
                                        isEnabled: f.isEnabled,
                                        isInherited: f.isInherited,
                                        isHighlighted: f.isHighlighted,
                                        highlightOrder: f.highlightOrder,
                                        highlightDescription: f.highlightDescription,
                                        marketingName: f.marketingName,
                                      })),
                                      reason: `Toggled ${feat.featureKey} ${checked ? 'on' : 'off'} via admin UI`,
                                    });
                                    await loadData();
                                  } catch (err) {
                                    console.error('Failed to toggle feature:', err);
                                    setError('Failed to toggle feature');
                                  }
                                }}
                              />
                              <div>
                                <span className="font-medium text-gray-800">
                                  {feat.marketingName || feat.featureName}
                                </span>
                                <span className="text-xs text-gray-400 ml-2">{feat.featureKey}</span>
                                {feat.isInherited && (
                                  <Badge variant="info" className="ml-2 text-xs">Inherited</Badge>
                                )}
                                {feat.isHighlighted && (
                                  <Badge variant="success" className="ml-2 text-xs">Highlighted</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openLegacyFeatureDialog(tier.tierKey, feat)}
                                className="text-xs"
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLegacyFeatureDelete(tier.tierKey, feat.featureKey)}
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Available features from features_list not yet in this tier */}
                    {getAvailableFeaturesForLegacyTier(tier).length > 0 && (
                      <div className="mt-3 pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-400">
                          Available from features_list: {getAvailableFeaturesForLegacyTier(tier).map(f => f.featureKey).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="p-8 text-center text-gray-500">
                Select a tier above to manage its features
              </div>
            )}
          </div>
        </TabsContent>

        {/* ===== CONSTRAINTS TAB ===== */}
        <TabsContent value="constraints">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Cross-Capability Constraints</h2>
                <p className="text-sm text-gray-500">Manage declarative constraints between capabilities (CCL)</p>
              </div>
              <Button onClick={() => openConstraintDialog()} size="sm">
                + Add Constraint
              </Button>
            </div>
            <div className="divide-y divide-gray-200">
              {constraints.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">
                  No constraints defined. Constraints enforce rules between capabilities (e.g. digital products require fulfillment shipping to be off).
                </div>
              ) : (
                constraints.map((c) => (
                  <div key={c.id} className="px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 font-mono">{c.constraint_id}</span>
                          <Badge variant={c.severity === 'block' ? 'destructive' : c.severity === 'warn' ? 'default' : 'info'}>
                            {c.severity}
                          </Badge>
                          <Badge variant="outline">{c.type}</Badge>
                          {!c.is_active && <Badge variant="default">Inactive</Badge>}
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{c.message}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{c.resolution_hint}</p>
                        <div className="text-xs text-gray-400 mt-1 font-mono">
                          {c.source_capability}.{c.source_field} {c.source_operator} &quot;{c.source_value}&quot;
                          {' → '}
                          {c.target_capability}.{c.target_field} {c.target_operator} &quot;{c.target_value}&quot;
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                        <Button variant="ghost" size="sm" onClick={() => openConstraintDialog(c)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleConstraintDelete(c)} className="text-red-600 hover:text-red-800">
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* ===== TIER COVERAGE TAB ===== */}
        <TabsContent value="tier-coverage">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Tier Coverage Matrix</h2>
              <p className="text-sm text-gray-500">Compare capability type assignments across tiers — identify missing assignments before they become issues</p>
            </div>

            {(() => {
              const activeTiers = legacyTiers.filter(t => t.isActive);
              const activeCapTypes = capabilityTypes.filter(ct => ct.is_active !== false);

              if (activeTiers.length === 0 || activeCapTypes.length === 0) {
                return (
                  <div className="px-6 py-8 text-center text-gray-500">
                    {activeTiers.length === 0 ? 'No active tiers available.' : 'No active capability types available.'}
                  </div>
                );
              }

              // Build lookup: tier_key + capability_type_key -> CapabilityData
              const assignmentMap = new Map<string, CapabilityData>();
              capabilities.forEach(c => {
                if (c.tier_key && c.capability_type_key) {
                  assignmentMap.set(`${c.tier_key}:${c.capability_type_key}`, c);
                }
              });

              // Calculate missing count per tier
              const missingByTier = activeTiers.map(tier => {
                const missing = activeCapTypes.filter(ct => !assignmentMap.has(`${tier.tierKey}:${ct.capability_type_key}`));
                return { tier, missingCount: missing.length, missingCaps: missing };
              });

              const totalMissing = missingByTier.reduce((sum, m) => sum + m.missingCount, 0);
              const totalCells = activeTiers.length * activeCapTypes.length;
              const coveragePct = totalCells > 0 ? Math.round(((totalCells - totalMissing) / totalCells) * 100) : 0;

              return (
                <>
                  {/* Summary cards */}
                  <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
                      <div className="text-xs text-gray-500 uppercase font-medium">Coverage</div>
                      <div className={`text-2xl font-bold ${coveragePct >= 80 ? 'text-green-600' : coveragePct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{coveragePct}%</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
                      <div className="text-xs text-gray-500 uppercase font-medium">Assigned</div>
                      <div className="text-2xl font-bold text-green-600">{totalCells - totalMissing}</div>
                      <div className="text-xs text-gray-400">of {totalCells} cells</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
                      <div className="text-xs text-gray-500 uppercase font-medium">Missing</div>
                      <div className={`text-2xl font-bold ${totalMissing === 0 ? 'text-green-600' : 'text-red-600'}`}>{totalMissing}</div>
                      <div className="text-xs text-gray-400">gaps to close</div>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3 bg-gray-50/50">
                      <div className="text-xs text-gray-500 uppercase font-medium">Tiers with Gaps</div>
                      <div className={`text-2xl font-bold ${missingByTier.filter(m => m.missingCount > 0).length === 0 ? 'text-green-600' : 'text-amber-600'}`}>{missingByTier.filter(m => m.missingCount > 0).length}</div>
                      <div className="text-xs text-gray-400">of {activeTiers.length} tiers</div>
                    </div>
                  </div>

                  {/* Missing assignments alert */}
                  {totalMissing > 0 && (
                    <div className="px-6 py-3 border-b border-gray-100 bg-amber-50/50">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800">
                          <strong>{totalMissing} missing capability type assignment{totalMissing !== 1 ? 's' : ''}</strong> across {missingByTier.filter(m => m.missingCount > 0).length} tier{missingByTier.filter(m => m.missingCount > 0).length !== 1 ? 's' : ''}.
                          Click a missing cell to jump to that tier and assign the capability type.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Coverage matrix table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Capability Type</th>
                          {activeTiers.map(tier => {
                            const tierMissing = missingByTier.find(m => m.tier.tierKey === tier.tierKey)?.missingCount || 0;
                            return (
                              <th key={tier.tierKey} className="px-3 py-3 text-center text-xs font-medium uppercase whitespace-nowrap">
                                <div className={`flex items-center justify-center gap-1 ${tierMissing > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                                  {tier.displayName}
                                  {tierMissing > 0 && (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{tierMissing}</span>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {activeCapTypes.map(capType => {
                          const capMissingCount = activeTiers.filter(t => !assignmentMap.has(`${t.tierKey}:${capType.capability_type_key}`)).length;
                          return (
                            <tr key={capType.capability_type_key} className={capMissingCount > 0 ? 'bg-amber-50/30' : ''}>
                              <td className="px-4 py-3 sticky left-0 bg-inherit z-10">
                                <div className="text-sm font-medium text-gray-900">{capType.capability_type_name}</div>
                                <div className="text-xs text-gray-500 font-mono">{capType.capability_type_key}</div>
                                {capType.category && <div className="text-xs text-gray-400 mt-0.5">{capType.category}</div>}
                              </td>
                              {activeTiers.map(tier => {
                                const assignment = assignmentMap.get(`${tier.tierKey}:${capType.capability_type_key}`);
                                const isAssigned = !!assignment;
                                return (
                                  <td key={tier.tierKey} className="px-3 py-3 text-center">
                                    {isAssigned ? (
                                      <div className="flex items-center justify-center" title={`${assignment.feature_count} features assigned`}>
                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-600">
                                          <Check className="w-4 h-4" />
                                        </span>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleTierSelect(tier.tierKey)}
                                        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 text-red-500 hover:bg-red-200 transition-colors cursor-pointer"
                                        title={`Click to assign ${capType.capability_type_name} to ${tier.displayName}`}
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Per-tier missing breakdown */}
                  {totalMissing > 0 && (
                    <div className="px-6 py-4 border-t border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Missing Assignments by Tier</h3>
                      <div className="space-y-3">
                        {missingByTier.filter(m => m.missingCount > 0).map(({ tier, missingCount, missingCaps }) => (
                          <div key={tier.tierKey} className="rounded-lg border border-amber-200 bg-amber-50/30 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">{tier.displayName}</span>
                                <Badge variant="destructive">{missingCount} missing</Badge>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTierSelect(tier.tierKey)}
                              >
                                Manage Tier
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {missingCaps.map(ct => (
                                <span key={ct.capability_type_key} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-amber-200 text-xs text-gray-700">
                                  <X className="w-3 h-3 text-red-400" />
                                  {ct.capability_type_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Legend */}
                  <div className="px-6 py-3 border-t border-gray-200 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600"><Check className="w-3 h-3" /></span> Assigned</span>
                    <span className="flex items-center gap-1"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-500"><X className="w-3 h-3" /></span> Missing — click to assign</span>
                  </div>
                </>
              );
            })()}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== Feature Dialog ===== */}
      <Dialog open={featureDialogOpen} onOpenChange={setFeatureDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFeature ? 'Edit Feature' : 'Add Feature'}</DialogTitle>
            <DialogDescription>
              {editingFeature ? 'Update the feature name and description' : 'Create a new feature for the features list'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingFeature ? (
              <>
                <div className="px-3 py-2 bg-gray-50 rounded-md border">
                  <span className="text-xs text-gray-500">Key:</span>{' '}
                  <span className="text-sm font-mono text-gray-700">{editingFeature.feature_key}</span>
                </div>
                <Input
                  label="Feature Name"
                  placeholder="e.g. Custom Product"
                  value={featureForm.feature_name}
                  onChange={(e) => setFeatureForm(prev => ({ ...prev, feature_name: e.target.value }))}
                />
                <Input
                  label="Description"
                  placeholder="Optional description"
                  value={featureForm.description}
                  onChange={(e) => setFeatureForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </>
            ) : (
              <>
                {legacyFeatures.length > 0 && (
                  <SearchableSelect
                    label="Pick from existing features"
                    placeholder="Search and select a feature..."
                    options={legacyFeatures
                      .filter(f => !features.some(ef => ef.feature_key === f.featureKey))
                      .map(f => ({ value: f.featureKey, label: `${f.featureName} (${f.featureKey})` }))}
                    value={featureForm.feature_key || ''}
                    onChange={(key) => {
                      const found = legacyFeatures.find(f => f.featureKey === key);
                      if (found) setFeatureForm(prev => ({ ...prev, feature_key: found.featureKey, feature_name: found.featureName }));
                    }}
                  />
                )}
                <Input
                  label="Feature Key"
                  placeholder="e.g. custom_product"
                  value={featureForm.feature_key}
                  onChange={(e) => setFeatureForm(prev => ({ ...prev, feature_key: e.target.value }))}
                />
                <Input
                  label="Feature Name"
                  placeholder="e.g. Custom Product"
                  value={featureForm.feature_name}
                  onChange={(e) => setFeatureForm(prev => ({ ...prev, feature_name: e.target.value }))}
                />
                <Input
                  label="Description"
                  placeholder="Optional description"
                  value={featureForm.description}
                  onChange={(e) => setFeatureForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeatureDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleFeatureSave} disabled={saving || !featureForm.feature_key || !featureForm.feature_name}>
              {saving ? 'Saving...' : editingFeature ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Capability Type Dialog ===== */}
      <Dialog open={capTypeDialogOpen} onOpenChange={setCapTypeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCapType ? 'Edit Capability Type' : 'Add Capability Type'}</DialogTitle>
            <DialogDescription>
              {editingCapType
                ? 'Update the capability type and its feature collection'
                : 'Create a capability type by selecting features from the master features list'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingCapType ? (
              <div className="px-3 py-2 bg-gray-50 rounded-md border">
                <span className="text-xs text-gray-500">Key:</span>{' '}
                <span className="text-sm font-mono text-gray-700">{editingCapType.capability_type_key}</span>
              </div>
            ) : (
              <Input
                label="Capability Type Key"
                placeholder="e.g. inventory_management"
                value={capTypeForm.capability_type_key}
                onChange={(e) => setCapTypeForm(prev => ({ ...prev, capability_type_key: e.target.value }))}
              />
            )}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Assign to Tier</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={capTypeForm.tier_key}
                onChange={(e) => setCapTypeForm(prev => ({ ...prev, tier_key: e.target.value }))}
              >
                <option value="">-- No tier (unassigned) --</option>
                {legacyTiers.map(t => (
                  <option key={t.tierKey} value={t.tierKey}>{t.displayName} ({t.tierKey})</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Optionally assign this capability type to a tier upon creation</p>
            </div>
            <Input
              label="Capability Type Name"
              placeholder="e.g. Inventory Management"
              value={capTypeForm.capability_type_name}
              onChange={(e) => setCapTypeForm(prev => ({ ...prev, capability_type_name: e.target.value }))}
            />
            <Input
              label="Description"
              placeholder="Optional description"
              value={capTypeForm.description}
              onChange={(e) => setCapTypeForm(prev => ({ ...prev, description: e.target.value }))}
            />
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Category</label>
              {(() => {
                const existingCategories = [...new Set(capabilityTypes.map(ct => ct.category).filter((c): c is string => typeof c === 'string' && c.length > 0))].sort();
                return (
                  <>
                    <select
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      value={isNewCategory ? '__new__' : capTypeForm.category}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__new__') {
                          setIsNewCategory(true);
                          setNewCategoryName('');
                        } else {
                          setIsNewCategory(false);
                          setNewCategoryName('');
                          setCapTypeForm(prev => ({ ...prev, category: val }));
                        }
                      }}
                    >
                      <option value="">-- No category --</option>
                      {existingCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__new__">+ New category...</option>
                    </select>
                    {isNewCategory && (
                      <Input
                        placeholder="Enter new category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={capTypeForm.is_active}
                  onCheckedChange={(checked) => setCapTypeForm(prev => ({ ...prev, is_active: checked }))}
                />
                <span className="text-sm text-gray-700">Active</span>
              </div>
              <div className="flex-1">
                <Input
                  label="Sort Order"
                  type="number"
                  value={capTypeForm.sort_order}
                  onChange={(e) => setCapTypeForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-neutral-700">Feature Collection</label>
                <span className="text-xs text-gray-500">
                  {capTypeForm.allowed_features.length} of {features.length} features selected
                </span>
              </div>
              {features.length === 0 ? (
                <div className="border rounded-md p-4 text-center">
                  <p className="text-sm text-gray-500">No features in master list.</p>
                  <p className="text-xs text-gray-400 mt-1">Add features in the Features tab first.</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto border rounded-md p-3">
                  {[...features].sort((a, b) => a.feature_key.localeCompare(b.feature_key)).map((feature) => {
                    const isSelected = capTypeForm.allowed_features.includes(feature.feature_key);
                    return (
                      <div
                        key={feature.feature_key}
                        className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                        onClick={() => handleCapTypeFeatureToggle(feature.feature_key)}
                      >
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isSelected}
                            onCheckedChange={() => handleCapTypeFeatureToggle(feature.feature_key)}
                          />
                          <div>
                            <span className="text-sm text-gray-800">{feature.feature_name}</span>
                            {feature.description && (
                              <span className="text-xs text-gray-400 ml-2">{feature.description}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 font-mono">{feature.feature_key}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCapTypeDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCapTypeSave} disabled={saving || !capTypeForm.capability_type_key || !capTypeForm.capability_type_name}>
              {saving ? 'Saving...' : editingCapType ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Legacy Tier Dialog ===== */}
      <Dialog open={legacyTierDialogOpen} onOpenChange={setLegacyTierDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLegacyTier ? 'Edit Legacy Tier' : 'Add Legacy Tier'}</DialogTitle>
            <DialogDescription>
              {editingLegacyTier
                ? 'Update tier details in subscription_tiers_list'
                : 'Create a new tier in subscription_tiers_list'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingLegacyTier ? (
              <div className="px-3 py-2 bg-gray-50 rounded-md border">
                <span className="text-xs text-gray-500">Key:</span>{' '}
                <span className="text-sm font-mono text-gray-700">{editingLegacyTier.tierKey}</span>
              </div>
            ) : (
              <Input
                label="Tier Key"
                placeholder="e.g. professional"
                value={legacyTierForm.tierKey}
                onChange={(e) => setLegacyTierForm(prev => ({ ...prev, tierKey: e.target.value }))}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Name"
                placeholder="e.g. Professional"
                value={legacyTierForm.name}
                onChange={(e) => setLegacyTierForm(prev => ({ ...prev, name: e.target.value }))}
              />
              <Input
                label="Display Name"
                placeholder="e.g. Professional Plan"
                value={legacyTierForm.displayName}
                onChange={(e) => setLegacyTierForm(prev => ({ ...prev, displayName: e.target.value }))}
              />
            </div>
            <Input
              label="Description"
              placeholder="Optional description"
              value={legacyTierForm.description}
              onChange={(e) => setLegacyTierForm(prev => ({ ...prev, description: e.target.value }))}
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Price Monthly ($)"
                type="number"
                value={legacyTierForm.priceMonthly}
                onChange={(e) => setLegacyTierForm(prev => ({ ...prev, priceMonthly: parseFloat(e.target.value) || 0 }))}
              />
              <Input
                label="Max SKUs"
                type="number"
                value={legacyTierForm.maxSkus ?? ''}
                onChange={(e) => setLegacyTierForm(prev => ({ ...prev, maxSkus: e.target.value ? parseInt(e.target.value) : null }))}
              />
              <Input
                label="Max Locations"
                type="number"
                value={legacyTierForm.maxLocations ?? ''}
                onChange={(e) => setLegacyTierForm(prev => ({ ...prev, maxLocations: e.target.value ? parseInt(e.target.value) : null }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Tier Type</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  value={legacyTierForm.tierType}
                  onChange={(e) => setLegacyTierForm(prev => ({ ...prev, tierType: e.target.value }))}
                >
                  <option value="individual">Individual</option>
                  <option value="organization">Organization</option>
                </select>
              </div>
              <Input
                label="Sort Order"
                type="number"
                value={legacyTierForm.sortOrder}
                onChange={(e) => setLegacyTierForm(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
              />
            </div>
            <Input
              label="Reason (required for audit trail)"
              placeholder="e.g. Adding new tier for Q3 launch"
              value={legacyTierForm.reason}
              onChange={(e) => setLegacyTierForm(prev => ({ ...prev, reason: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLegacyTierDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleLegacyTierSave}
              disabled={saving || !legacyTierForm.tierKey || !legacyTierForm.name || !legacyTierForm.displayName}
            >
              {saving ? 'Saving...' : editingLegacyTier ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Legacy Feature Dialog ===== */}
      <Dialog open={legacyFeatureDialogOpen} onOpenChange={setLegacyFeatureDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLegacyTierFeature ? 'Edit Tier Feature' : 'Add Tier Feature'}</DialogTitle>
            <DialogDescription>
              {editingLegacyTierFeature
                ? `Update feature in tier_features_list for ${editingLegacyTierFeature.tierKey}`
                : 'Add a feature to this tier from tier_features_list'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingLegacyTierFeature ? (
              <div className="px-3 py-2 bg-gray-50 rounded-md border">
                <span className="text-xs text-gray-500">Key:</span>{' '}
                <span className="text-sm font-mono text-gray-700">{editingLegacyTierFeature.feature.featureKey}</span>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Feature Key</label>
                {legacyFeatures.length > 0 ? (
                  <select
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={legacyFeatureForm.featureKey}
                    onChange={(e) => {
                      const selected = legacyFeatures.find(f => f.featureKey === e.target.value);
                      setLegacyFeatureForm(prev => ({
                        ...prev,
                        featureKey: e.target.value,
                        featureName: selected?.featureName || prev.featureName,
                      }));
                    }}
                  >
                    <option value="">-- Select from features_list --</option>
                    {legacyFeatures.map(f => (
                      <option key={f.featureKey} value={f.featureKey}>{f.featureKey} ({f.featureName})</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    placeholder="e.g. custom_product"
                    value={legacyFeatureForm.featureKey}
                    onChange={(e) => setLegacyFeatureForm(prev => ({ ...prev, featureKey: e.target.value }))}
                  />
                )}
              </div>
            )}
            <Input
              label="Feature Name"
              placeholder="e.g. Custom Product"
              value={legacyFeatureForm.featureName}
              onChange={(e) => setLegacyFeatureForm(prev => ({ ...prev, featureName: e.target.value }))}
            />
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={legacyFeatureForm.isEnabled}
                  onCheckedChange={(checked) => setLegacyFeatureForm(prev => ({ ...prev, isEnabled: checked }))}
                />
                <span className="text-sm text-gray-700">Enabled</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={legacyFeatureForm.isInherited}
                  onCheckedChange={(checked) => setLegacyFeatureForm(prev => ({ ...prev, isInherited: checked }))}
                />
                <span className="text-sm text-gray-700">Inherited</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={legacyFeatureForm.isHighlighted}
                  onCheckedChange={(checked) => setLegacyFeatureForm(prev => ({ ...prev, isHighlighted: checked }))}
                />
                <span className="text-sm text-gray-700">Highlighted</span>
              </div>
            </div>
            <Input
              label="Marketing Name"
              placeholder="e.g. Custom Products"
              value={legacyFeatureForm.marketingName}
              onChange={(e) => setLegacyFeatureForm(prev => ({ ...prev, marketingName: e.target.value }))}
            />
            <Input
              label="Highlight Description"
              placeholder="Optional highlight description"
              value={legacyFeatureForm.highlightDescription}
              onChange={(e) => setLegacyFeatureForm(prev => ({ ...prev, highlightDescription: e.target.value }))}
            />
            <Input
              label="Highlight Order"
              type="number"
              value={legacyFeatureForm.highlightOrder}
              onChange={(e) => setLegacyFeatureForm(prev => ({ ...prev, highlightOrder: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLegacyFeatureDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleLegacyFeatureSave}
              disabled={saving || !legacyFeatureForm.featureKey || !legacyFeatureForm.featureName}
            >
              {saving ? 'Saving...' : editingLegacyTierFeature ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tier Capability Dialog (Create / Edit) */}
      <Dialog open={tierCapDialogOpen} onOpenChange={setTierCapDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTierCap ? 'Edit Tier Capability' : 'Add Capability to Tier'}</DialogTitle>
            <DialogDescription>
              {editingTierCap
                ? `Update ${editingTierCap.capability_type_name} settings for ${editingTierCap.tier_name} tier`
                : 'Assign a capability type to a tier and configure feature toggles'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingTierCap ? (
              <div className="px-3 py-2 bg-gray-50 rounded-md border space-y-1">
                <div><span className="text-xs text-gray-500">Tier:</span> <span className="text-sm font-mono text-gray-700">{editingTierCap.tier_key}</span></div>
                <div><span className="text-xs text-gray-500">Capability:</span> <span className="text-sm font-mono text-gray-700">{editingTierCap.capability_type_key}</span></div>
              </div>
            ) : (<>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Tier</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={tierCapForm.tier_key}
                onChange={(e) => setTierCapForm(prev => ({ ...prev, tier_key: e.target.value }))}
              >
                <option value="">-- Select Tier --</option>
                {legacyTiers.map(t => (
                  <option key={t.tierKey} value={t.tierKey}>{t.displayName} ({t.tierKey})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Capability Type</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={tierCapForm.capability_type_key}
                onChange={(e) => handleTierCapFormCapTypeChange(e.target.value)}
              >
                <option value="">-- Select Capability Type --</option>
                {capabilityTypes.map(ct => (
                  <option key={ct.capability_type_key} value={ct.capability_type_key}>
                    {ct.capability_type_name} ({ct.capability_type_key})
                  </option>
                ))}
              </select>
            </div>
            </>)}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={tierCapForm.capability_enabled}
                  onCheckedChange={(checked) => setTierCapForm(prev => ({ ...prev, capability_enabled: checked }))}
                />
                <span className="text-sm text-gray-700">Enabled</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={tierCapForm.is_highlighted}
                  onCheckedChange={(checked) => setTierCapForm(prev => ({ ...prev, is_highlighted: checked }))}
                />
                <span className="text-sm text-gray-700">Highlighted</span>
              </div>
            </div>
            <Input
              label="Marketing Name"
              placeholder="e.g. Professional Product Types"
              value={tierCapForm.marketing_name}
              onChange={(e) => setTierCapForm(prev => ({ ...prev, marketing_name: e.target.value }))}
            />
            <Input
              label="Highlight Order"
              type="number"
              value={tierCapForm.highlight_order}
              onChange={(e) => setTierCapForm(prev => ({ ...prev, highlight_order: parseInt(e.target.value) || 0 }))}
            />
            {tierCapForm.features.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-neutral-700">Feature Toggles</label>
                  <span className="text-xs text-gray-500">
                    {tierCapForm.features.filter(f => f.is_enabled).length} of {tierCapForm.features.length} enabled
                  </span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto border rounded-md p-3">
                  {[...tierCapForm.features].sort((a, b) => a.feature_key.localeCompare(b.feature_key)).map(f => {
                    const feat = features.find(ft => ft.feature_key === f.feature_key);
                    return (
                      <div
                        key={f.feature_key}
                        className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                          f.is_enabled ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                        onClick={() => handleTierCapFeatureToggle(f.feature_key)}
                      >
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={f.is_enabled}
                            onCheckedChange={() => handleTierCapFeatureToggle(f.feature_key)}
                          />
                          <div>
                            <span className="text-sm text-gray-800">{feat?.feature_name || f.feature_key}</span>
                            {feat && feat.feature_name !== f.feature_key && (
                              <span className="text-xs text-gray-400 ml-1.5 font-mono">({f.feature_key})</span>
                            )}
                          </div>
                        </div>
                        <Badge variant={f.is_enabled ? 'success' : 'default'}>
                          {f.is_enabled ? 'On' : 'Off'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {tierCapForm.capability_type_key && tierCapForm.features.length === 0 && (
              <div className="border rounded-md p-4 text-center">
                <p className="text-sm text-gray-500">This capability type has no features in its collection.</p>
                <p className="text-xs text-gray-400 mt-1">Edit the capability type to add features first.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTierCapDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleTierCapSave}
              disabled={saving || !tierCapForm.tier_key || !tierCapForm.capability_type_key || (tierCapForm.features.length > 0 && !tierCapForm.features.some(f => f.is_enabled))}
            >
              {saving ? 'Saving...' : editingTierCap ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Constraint Dialog ===== */}
      <Dialog open={constraintDialogOpen} onOpenChange={setConstraintDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingConstraint ? 'Edit Constraint' : 'Add Constraint'}</DialogTitle>
            <DialogDescription>
              {editingConstraint
                ? `Update constraint ${editingConstraint.constraint_id}`
                : 'Create a new cross-capability constraint'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Constraint ID</label>
                <Input
                  placeholder="e.g. digital_requires_no_shipping"
                  value={constraintForm.constraint_id}
                  onChange={(e) => setConstraintForm(prev => ({ ...prev, constraint_id: e.target.value }))}
                  disabled={!!editingConstraint}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
                  <select
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={constraintForm.type}
                    onChange={(e) => setConstraintForm(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="requires">requires</option>
                    <option value="recommends">recommends</option>
                    <option value="excludes">excludes</option>
                    <option value="implies">implies</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Severity</label>
                  <select
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={constraintForm.severity}
                    onChange={(e) => setConstraintForm(prev => ({ ...prev, severity: e.target.value }))}
                  >
                    <option value="block">block</option>
                    <option value="warn">warn</option>
                    <option value="info">info</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border rounded-md p-3 bg-gray-50">
              <div className="text-xs font-semibold text-gray-600 mb-2">Source (IF condition)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Capability</label>
                  <SearchableSelect
                    options={getCapOptions()}
                    value={constraintForm.source_capability}
                    onChange={handleSourceCapChange}
                    placeholder="Select capability..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Field</label>
                  <SearchableSelect
                    options={getFieldOptions(constraintForm.source_capability)}
                    value={constraintForm.source_field}
                    onChange={handleSourceFieldChange}
                    placeholder="Select field..."
                    disabled={!constraintForm.source_capability}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Operator</label>
                  <select
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={constraintForm.source_operator}
                    onChange={(e) => setConstraintForm(prev => ({ ...prev, source_operator: e.target.value }))}
                  >
                    {getOperatorOptions(constraintForm.source_capability, constraintForm.source_field).map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Value</label>
                  {getValueOptions(constraintForm.source_capability, constraintForm.source_field).length > 0 ? (
                    <SearchableSelect
                      options={getValueOptions(constraintForm.source_capability, constraintForm.source_field)}
                      value={constraintForm.source_value}
                      onChange={(v) => setConstraintForm(prev => ({ ...prev, source_value: v }))}
                      placeholder="Select value..."
                      disabled={!constraintForm.source_field}
                    />
                  ) : (
                    <Input
                      placeholder="value (e.g. digital)"
                      value={constraintForm.source_value}
                      onChange={(e) => setConstraintForm(prev => ({ ...prev, source_value: e.target.value }))}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="border rounded-md p-3 bg-gray-50">
              <div className="text-xs font-semibold text-gray-600 mb-2">Target (THEN condition)</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Capability</label>
                  <SearchableSelect
                    options={getCapOptions()}
                    value={constraintForm.target_capability}
                    onChange={handleTargetCapChange}
                    placeholder="Select capability..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Field</label>
                  <SearchableSelect
                    options={getFieldOptions(constraintForm.target_capability)}
                    value={constraintForm.target_field}
                    onChange={handleTargetFieldChange}
                    placeholder="Select field..."
                    disabled={!constraintForm.target_capability}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Operator</label>
                  <select
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    value={constraintForm.target_operator}
                    onChange={(e) => setConstraintForm(prev => ({ ...prev, target_operator: e.target.value }))}
                  >
                    {getOperatorOptions(constraintForm.target_capability, constraintForm.target_field).map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Value</label>
                  {getValueOptions(constraintForm.target_capability, constraintForm.target_field).length > 0 ? (
                    <SearchableSelect
                      options={getValueOptions(constraintForm.target_capability, constraintForm.target_field)}
                      value={constraintForm.target_value}
                      onChange={(v) => setConstraintForm(prev => ({ ...prev, target_value: v }))}
                      placeholder="Select value..."
                      disabled={!constraintForm.target_field}
                    />
                  ) : (
                    <Input
                      placeholder="value (e.g. false)"
                      value={constraintForm.target_value}
                      onChange={(e) => setConstraintForm(prev => ({ ...prev, target_value: e.target.value }))}
                    />
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Message</label>
              <Input
                placeholder="e.g. Digital products cannot have shipping enabled"
                value={constraintForm.message}
                onChange={(e) => setConstraintForm(prev => ({ ...prev, message: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Resolution Hint</label>
              <Input
                placeholder="e.g. Disable shipping in fulfillment settings"
                value={constraintForm.resolution_hint}
                onChange={(e) => setConstraintForm(prev => ({ ...prev, resolution_hint: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={constraintForm.is_active}
                  onCheckedChange={(checked) => setConstraintForm(prev => ({ ...prev, is_active: checked }))}
                />
                <span className="text-sm text-gray-700">Active</span>
              </div>
              <div>
                <Input
                  label="Sort Order"
                  type="number"
                  value={constraintForm.sort_order}
                  onChange={(e) => setConstraintForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConstraintDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleConstraintSave}
              disabled={saving || !constraintForm.constraint_id || !constraintForm.source_capability || !constraintForm.target_capability || !constraintForm.message}
            >
              {saving ? 'Saving...' : editingConstraint ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation Dialog ===== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === 'feature' && (
                <>Are you sure you want to delete the feature <strong className="text-gray-900">{deleteTarget.label}</strong>? This action cannot be undone.</>
              )}
              {deleteTarget?.type === 'capType' && (
                <>Are you sure you want to delete the capability type <strong className="text-gray-900">{deleteTarget.label}</strong>? This will also remove it from any tier assignments. This action cannot be undone.</>
              )}
              {deleteTarget?.type === 'tierCap' && (
                <>Are you sure you want to remove <strong className="text-gray-900">{deleteTarget.label}</strong>? This will disable the capability and all its features for the affected tier.</>
              )}
              {deleteTarget?.type === 'constraint' && (
                <>Are you sure you want to delete the constraint <strong className="text-gray-900">{deleteTarget.label}</strong>? This will remove the cross-capability rule. This action cannot be undone.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  {deleteTarget?.type === 'capType' ? 'Capability types are critical infrastructure.' : 'This is a critical operation.'}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  {deleteTarget?.type === 'capType'
                    ? 'Deleting a capability type will break tier assignments and may affect merchant feature availability.'
                    : deleteTarget?.type === 'feature'
                    ? 'Deleting a feature will remove it from all capability type collections that reference it.'
                    : deleteTarget?.type === 'constraint'
                    ? 'Deleting a constraint will remove the rule enforcement between capabilities. This may allow invalid configurations.'
                    : 'Removing a tier capability will disable features for merchants on that tier.'
                  }
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setDeleteTarget(null); }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget?.type === 'feature') handleFeatureDeleteConfirm();
                else if (deleteTarget?.type === 'capType') handleCapTypeDeleteConfirm();
                else if (deleteTarget?.type === 'tierCap') handleTierCapDeleteConfirm();
                else if (deleteTarget?.type === 'constraint') handleConstraintDeleteConfirm();
              }}
            >
              {deleteTarget?.type === 'tierCap' ? 'Remove' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
