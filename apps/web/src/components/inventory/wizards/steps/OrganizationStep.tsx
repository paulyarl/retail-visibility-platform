/**
 * Organization & Categories Step (Step 6)
 * 
 * Product organization with:
 * - Category selection and management
 * - Google Business Profile category mapping
 * - Shop category assignment
 * - Tag management and suggestions
 * - SEO optimization
 * - Inventory organization settings
 * 
 * Sixth step in the 7-step product creation wizard
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { 
  FolderTree, 
  Tag, 
  Search, 
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  MapPin
} from 'lucide-react';
import TenantCategorySelector from '@/components/items/TenantCategorySelector';
import { useCategorySingleton } from '@/providers/data/CategorySingleton';

import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/shadcn-select';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Separator } from '@/components/ui/Separator';
import { Checkbox } from '@/components/ui/Checkbox';

// Helper component to display category name by ID using CategorySingleton for caching
function CategoryNameDisplay({ categoryId, tenantId }: { categoryId: string; tenantId?: string }) {
  const [categoryName, setCategoryName] = useState<string>('Loading...');
  const [fullCategoryPath, setFullCategoryPath] = useState<string>('');
  const { state, actions } = useCategorySingleton();

  useEffect(() => {
    async function loadCategoryName() {
      if (!categoryId) {
        setCategoryName('No category');
        return;
      }

      console.log('[OrganizationStep CategoryNameDisplay] Looking for category:', categoryId);

      // First try to find in tenant categories (using CategorySingleton)
      if (state.categories.length > 0) {
        const category = actions.getCategoryById(categoryId);
        if (category) {
          console.log('[OrganizationStep CategoryNameDisplay] Found in tenant categories:', category.name);
          setCategoryName(category.name);
          return;
        }
      } else {
        // Load tenant categories if not already loaded
        try {
          await actions.fetchCategories({
            includeChildren: true,
            includeProductCount: false
          });
          
          const category = actions.getCategoryById(categoryId);
          if (category) {
            console.log('[OrganizationStep CategoryNameDisplay] Found in tenant categories after load:', category.name);
            setCategoryName(category.name);
            return;
          }
        } catch (error) {
          console.error('[OrganizationStep CategoryNameDisplay] Error loading tenant categories:', error);
        }
      }

      // If not found in tenant categories, try Google taxonomy
      console.log('[OrganizationStep CategoryNameDisplay] Not found in tenant categories, trying Google taxonomy...');
      try {
        const { googleTaxonomyPublicService } = await import('@/services/GoogleTaxonomyPublicService');
        const data = await googleTaxonomyPublicService.getGoogleTaxonomyPath(categoryId);
        
        if (data && data.path && Array.isArray(data.path)) {
          const pathString = data.path.join(' > ');
          const finalCategoryName = data.path[data.path.length - 1]; // Get last element
          console.log('[OrganizationStep CategoryNameDisplay] Found in Google taxonomy:', pathString);
          setCategoryName(finalCategoryName);
          setFullCategoryPath(pathString); // Store full path separately
          return;
        }
      } catch (error) {
        console.error('[OrganizationStep CategoryNameDisplay] Error fetching Google taxonomy:', error);
      }

      // If still not found, show unknown category
      console.log('[OrganizationStep CategoryNameDisplay] Category not found anywhere:', categoryId);
      setCategoryName('Unknown category');
    }

    loadCategoryName();
  }, [categoryId, state.categories.length]);

  return (
    <div className="space-y-1">
      <div className="font-medium">{categoryName}</div>
      <div className="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block">ID: {categoryId}</div>
      {fullCategoryPath && categoryName !== 'Unknown category' && categoryName !== 'Loading...' && (
        <div className="text-xs text-gray-500 dark:text-gray-400 italic">
          Path: {fullCategoryPath}
        </div>
      )}
    </div>
  );
}

interface OrganizationStepProps {
  data: {
    categoryId: string;
    googleCategoryId?: string;
    shopCategoryId?: string;
    tags: string[];
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string[];
    inventorySettings: {
      trackInventory: boolean;
      allowBackorder: boolean;
      lowStockThreshold: number;
      reorderPoint: number;
      maxStockLevel: number;
    };
    organizationSettings: {
      featured: boolean;
      priority: number;
      visibility: 'public' | 'private' | 'draft';
      searchable: boolean;
    };
  };
  errors: Record<string, string>;
  onChange: (data: any) => void;
  tenantId?: string;
}

// Removed mock CATEGORIES, GOOGLE_CATEGORIES, and SHOP_CATEGORIES
// TenantCategorySelector handles all category needs and aligns with platform standard (directory_category_id + category_path)

const SUGGESTED_TAGS = [
  'popular', 'new', 'sale', 'premium', 'eco-friendly', 'handmade', 'limited-edition',
  'best-seller', 'trending', 'exclusive', 'vintage', 'modern', 'classic', 'custom',
  'organic', 'sustainable', 'local', 'imported', 'gift-ready', 'bundle'
];

export default function OrganizationStep({ data, errors, onChange, tenantId }: OrganizationStepProps) {
  const [newTag, setNewTag] = useState('');
  const [newSeoKeyword, setNewSeoKeyword] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  // Debug: Log when categoryId changes
  useEffect(() => {
    console.log('[OrganizationStep] Data changed:', {
      categoryId: data.categoryId,
      googleCategoryId: data.googleCategoryId,
      hasCategoryId: !!data.categoryId
    });
  }, [data.categoryId, data.googleCategoryId]);

  const handleCategoryChange = (categoryId: string, googleCategoryPath?: string, googleTaxonomyId?: string) => {
    console.log('[OrganizationStep] Category change received:', {
      categoryId,
      googleCategoryPath,
      googleTaxonomyId,
      currentData: {
        categoryId: data.categoryId,
        googleCategoryId: data.googleCategoryId,
        shopCategoryId: data.shopCategoryId
      }
    });

    const newData = {
      ...data,
      categoryId
    };

    // Also update Google category info if provided
    if (googleTaxonomyId) {
      newData.googleCategoryId = googleTaxonomyId;
      console.log('[OrganizationStep] Updating Google category ID:', googleTaxonomyId);
    }

    console.log('[OrganizationStep] Calling onChange with new data:', newData);
    onChange(newData);
    setShowCategorySelector(false);
  };

  // Removed handleGoogleCategoryChange and handleShopCategoryChange
  // TenantCategorySelector handles all category selection

  const handleAddTag = () => {
    if (newTag.trim() && !data.tags.includes(newTag.trim())) {
      onChange({
        ...data,
        tags: [...data.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (index: number) => {
    onChange({
      ...data,
      tags: data.tags.filter((_, i) => i !== index)
    });
  };

  const handleAddSuggestedTag = (tag: string) => {
    if (!data.tags.includes(tag)) {
      onChange({
        ...data,
        tags: [...data.tags, tag]
      });
    }
  };

  const handleAddSeoKeyword = () => {
    if (newSeoKeyword.trim() && !data.seoKeywords?.includes(newSeoKeyword.trim())) {
      onChange({
        ...data,
        seoKeywords: [...(data.seoKeywords || []), newSeoKeyword.trim()]
      });
      setNewSeoKeyword('');
    }
  };

  const handleRemoveSeoKeyword = (index: number) => {
    onChange({
      ...data,
      seoKeywords: data.seoKeywords?.filter((_, i) => i !== index) || []
    });
  };

  const handleInventorySettingsChange = (field: string, value: any) => {
    onChange({
      ...data,
      inventorySettings: {
        ...data.inventorySettings,
        [field]: value
      }
    });
  };

  const handleOrganizationSettingsChange = (field: string, value: any) => {
    onChange({
      ...data,
      organizationSettings: {
        ...data.organizationSettings,
        [field]: value
      }
    });
  };

  const getOrganizationQuality = () => {
    let score = 0;
    if (data.categoryId) score += 20;
    if (data.googleCategoryId) score += 15;
    if (data.shopCategoryId) score += 10;
    if (data.tags.length >= 3) score += 15;
    if (data.seoTitle && data.seoTitle.length >= 10) score += 10;
    if (data.seoDescription && data.seoDescription.length >= 50) score += 10;
    if (data.seoKeywords && data.seoKeywords.length >= 3) score += 10;
    if (data.inventorySettings.trackInventory) score += 5;
    if (data.organizationSettings.searchable) score += 5;
    return Math.min(score, 100);
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-gray-400';
  };

  const getQualityBadge = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  const isFormValid = () => {
    return data.categoryId && data.categoryId.trim().length > 0;
  };

  const organizationQuality = getOrganizationQuality();

  return (
    <div className="space-y-6">
      {/* Help Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <FolderTree className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Organization & Categories</h4>
              <p className="text-sm text-blue-700 mt-1">
                Organize your product with categories, tags, and SEO optimization. Set inventory tracking
                and visibility settings to ensure proper management and discoverability.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Quality Indicator */}
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <FolderTree className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="font-medium">Organization Quality</div>
                <div className="text-sm text-gray-600">
                  {organizationQuality}% Complete
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge className={getQualityColor(organizationQuality)}>
                {getQualityBadge(organizationQuality)}
              </Badge>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${organizationQuality}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <FolderTree className="h-5 w-5" />
            <span>Product Category</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCategorySelector(!showCategorySelector)}
              className="w-full"
            >
              <FolderTree className="h-4 w-4 mr-2" />
              {showCategorySelector ? 'Hide Category Selection' : data.categoryId ? 'Change Category' : 'Select Category'}
            </Button>

            {showCategorySelector && (
              <div className="mt-3 p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                <TenantCategorySelector
                  selectedCategoryId={data.categoryId}
                  onSelect={handleCategoryChange}
                  onCancel={() => setShowCategorySelector(false)}
                />
              </div>
            )}
          </div>

          {data.categoryId && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium text-green-800">
                      Selected Category
                    </div>
                    <div className="text-sm text-green-700">
                      <div className="border border-green-300 dark:border-green-700 rounded-lg p-3 bg-green-50 dark:bg-green-900/20">
                        {(() => {
                          console.log('[OrganizationStep] About to render CategoryNameDisplay:', {
                            categoryId: data.categoryId,
                            googleCategoryId: data.googleCategoryId,
                            hasCategoryId: !!data.categoryId
                          });
                          return <CategoryNameDisplay categoryId={data.categoryId} tenantId={tenantId} />;
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <p className="text-xs text-neutral-500">
            Assign a category to organize your products. Categories with Google IDs will sync to Google Shopping.
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* Tags */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Product Tags</Label>
          <Badge variant="default">{data.tags.length} tags</Badge>
        </div>

        {/* Suggested Tags */}
        {tagSuggestions.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Suggested Tags</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {tagSuggestions.map((tag) => (
                <Button
                  key={tag}
                  variant="default"
                  size="sm"
                  onClick={() => handleAddSuggestedTag(tag)}
                  disabled={data.tags.includes(tag)}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Current Tags */}
        <div className="flex flex-wrap gap-2">
          {data.tags.map((tag, index) => (
            <Badge key={index} variant="info" className="flex items-center space-x-1">
              <Tag className="h-3 w-3" />
              <span>{tag}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveTag(index)}
                className="p-0 h-3 w-3"
              >
                <X className="h-2 w-2" />
              </Button>
            </Badge>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <Input
            placeholder="Add a tag..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            className="flex-1"
          />
          <Button onClick={handleAddTag} disabled={!newTag.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* SEO Optimization */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-green-600" />
          <Label className="text-base font-medium">SEO Optimization</Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">SEO Title</Label>
            <Input
              placeholder="SEO title (60 chars max)"
              value={data.seoTitle || ''}
              onChange={(e) => onChange({ ...data, seoTitle: e.target.value })}
              maxLength={60}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">SEO Keywords</Label>
            <div className="flex flex-wrap gap-1 mt-2">
              {data.seoKeywords?.map((keyword, index) => (
                <Badge key={index} variant="info" className="text-xs">
                  {keyword}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSeoKeyword(index)}
                    className="p-0 h-3 w-3 ml-1"
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <Input
                placeholder="Add SEO keyword..."
                value={newSeoKeyword}
                onChange={(e) => setNewSeoKeyword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddSeoKeyword()}
                className="flex-1 text-sm"
              />
              <Button size="sm" onClick={handleAddSeoKeyword} disabled={!newSeoKeyword.trim()}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium">SEO Description</Label>
          <Input
            placeholder="SEO description (160 chars max)"
            value={data.seoDescription || ''}
            onChange={(e) => onChange({ ...data, seoDescription: e.target.value })}
            maxLength={160}
          />
        </div>
      </div>

      <Separator />

      {/* Inventory Settings */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <TrendingUp className="h-4 w-4 text-orange-600" />
          <Label className="text-base font-medium">Inventory Settings</Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Track Inventory</Label>
              <Switch
                checked={data.inventorySettings.trackInventory}
                onCheckedChange={(checked) => handleInventorySettingsChange('trackInventory', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Allow Backorder</Label>
              <Switch
                checked={data.inventorySettings.allowBackorder}
                onCheckedChange={(checked) => handleInventorySettingsChange('allowBackorder', checked)}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Low Stock Threshold</Label>
              <Input
                type="number"
                value={data.inventorySettings.lowStockThreshold}
                onChange={(e) => handleInventorySettingsChange('lowStockThreshold', parseInt(e.target.value))}
                placeholder="10"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Reorder Point</Label>
              <Input
                type="number"
                value={data.inventorySettings.reorderPoint}
                onChange={(e) => handleInventorySettingsChange('reorderPoint', parseInt(e.target.value))}
                placeholder="5"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Organization Settings */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          <Label className="text-base font-medium">Organization Settings</Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            {/* Featured settings moved to Review step for better UX */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Featured Product</Label>
              <div className="text-xs text-neutral-500">
                Configure in Review step
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Searchable</Label>
              <Switch
                checked={data.organizationSettings.searchable}
                onCheckedChange={(checked) => handleOrganizationSettingsChange('searchable', checked)}
              />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Visibility</Label>
              <Select
                value={data.organizationSettings.visibility}
                onValueChange={(value) => handleOrganizationSettingsChange('visibility', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Priority</Label>
              <Input
                type="number"
                value={data.organizationSettings.priority}
                onChange={(e) => handleOrganizationSettingsChange('priority', parseInt(e.target.value))}
                placeholder="0-100"
                min={0}
                max={100}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Validation Summary */}
      <Card className={isFormValid() ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            {isFormValid() ? (
              <FolderTree className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            <div>
              <h4 className="font-medium">
                {isFormValid() ? 'Organization configured' : 'Organization needs attention'}
              </h4>
              <p className="text-sm text-gray-600">
                {isFormValid() 
                  ? 'Product organization is properly configured with categories and settings.'
                  : 'Please select a product category before continuing.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
