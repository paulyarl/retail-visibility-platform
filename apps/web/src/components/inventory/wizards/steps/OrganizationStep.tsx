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
import CategoryAssignmentModal from '@/components/items/CategoryAssignmentModal';
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

// Helper component to display category name by ID
function CategoryNameDisplay({ categoryId, tenantId, categoryPath }: { categoryId: string; tenantId?: string; categoryPath?: string }) {
  const [categoryName, setCategoryName] = useState<string>('Loading...');
  const [fullCategoryPath, setFullCategoryPath] = useState<string>('');

  useEffect(() => {
    async function loadCategoryName() {
      if (!categoryId) {
        setCategoryName('No category');
        return;
      }

      // For tenant categories (scid- or itemcat- prefix), fetch from tenant service
      if (categoryId.startsWith('scid-') || categoryId.startsWith('itemcat-')) {
        try {
          const { tenantCategoriesService } = await import('@/services/TenantCategoriesService');
          const categories = await tenantCategoriesService.getTenantCategories(tenantId || '');
          const category = categories.find(cat => cat.id === categoryId);

          if (category) {
            setCategoryName(category.name);
            // If category has googleCategoryId, fetch the full taxonomy path
            if (category.googleCategoryId) {
              try {
                const { googleTaxonomyPublicService } = await import('@/services/GoogleTaxonomyPublicService');
                const data = await googleTaxonomyPublicService.getGoogleTaxonomyPath(category.googleCategoryId);
                if (data && data.path && Array.isArray(data.path)) {
                  setFullCategoryPath(data.path.join(' > '));
                }
              } catch {
                // Ignore taxonomy fetch errors for tenant categories
              }
            }
            return;
          }
        } catch (error) {
          console.error('[OrganizationStep CategoryNameDisplay] Error loading tenant category:', error);
        }
      } else {
        // For Google categories (numeric IDs), fetch from Google taxonomy
        try {
          const { googleTaxonomyPublicService } = await import('@/services/GoogleTaxonomyPublicService');
          const data = await googleTaxonomyPublicService.getGoogleTaxonomyPath(categoryId);

          if (data && data.path && Array.isArray(data.path)) {
            const pathString = data.path.join(' > ');
            const finalCategoryName = data.path[data.path.length - 1];
            setCategoryName(finalCategoryName);
            setFullCategoryPath(pathString);
            return;
          }
        } catch (error) {
          console.error('[OrganizationStep CategoryNameDisplay] Error fetching Google taxonomy:', error);
        }
      }

      // If not found anywhere
      setCategoryName('Unknown category');
    }

    loadCategoryName();
  }, [categoryId, tenantId]);

  return (
    <div className="space-y-1">
      <div className="font-medium">{categoryName}</div>
      <div className="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded inline-block">ID: {categoryId}</div>
      {categoryPath && (
        <div className="text-xs text-green-600 dark:text-green-400 italic">
          Category Path: {categoryPath}
        </div>
      )}
      {fullCategoryPath && categoryName !== 'Unknown category' && categoryName !== 'Loading...' && (
        <div className="text-xs text-gray-500 dark:text-gray-400 italic">
          Taxonomy Path: {fullCategoryPath}
        </div>
      )}
    </div>
  );
}

interface OrganizationStepProps {
  data: {
    categoryId: string;
    categoryPath?: string;
    googleCategoryId?: string;
    shopCategoryId?: string;
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
  productType?: 'physical' | 'digital' | 'hybrid' | 'service';
}

// Removed mock CATEGORIES, GOOGLE_CATEGORIES, and SHOP_CATEGORIES
// TenantCategorySelector handles all category needs and aligns with platform standard (directory_category_id + category_path)

export default function OrganizationStep({ data, errors, onChange, tenantId, productType }: OrganizationStepProps) {
  const isService = productType === 'service';
  const [newSeoKeyword, setNewSeoKeyword] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  // Debug: Log when categoryId changes
  useEffect(() => {
    console.log('[OrganizationStep] Data changed:', {
      categoryId: data.categoryId,
      googleCategoryId: data.googleCategoryId,
      categoryPath: data.categoryPath,
      hasCategoryId: !!data.categoryId
    });
  }, [data.categoryId, data.googleCategoryId, data.categoryPath]);

  const handleCategoryAssign = async (itemId: string, categoryId: string) => {
    console.log('[OrganizationStep] Category assigned:', { itemId, categoryId });
    onChange({
      ...data,
      categoryId
    });
    setShowCategoryModal(false);
  };

  // Removed handleGoogleCategoryChange and handleShopCategoryChange
  // TenantCategorySelector handles all category selection

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
    if (data.seoTitle && data.seoTitle.length >= 10) score += 15;
    if (data.seoDescription && data.seoDescription.length >= 50) score += 15;
    if (data.seoKeywords && data.seoKeywords.length >= 3) score += 15;
    if (data.inventorySettings.trackInventory) score += 10;
    if (data.organizationSettings.searchable) score += 10;
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
              onClick={() => setShowCategoryModal(true)}
              className="w-full"
            >
              <FolderTree className="h-4 w-4 mr-2" />
              {data.categoryId ? 'Change Category' : 'Select Category'}
            </Button>
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
                        <CategoryNameDisplay categoryId={data.categoryId} tenantId={tenantId} categoryPath={data.categoryPath} />
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
            <p className="text-xs text-gray-500 mt-1">
              Auto-populated from product name. You can customize if needed.
            </p>
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
            <p className="text-xs text-gray-500 mt-1">
              Auto-populated from product tags. You can add more keywords as needed.
            </p>
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
          <p className="text-xs text-gray-500 mt-1">
            Auto-populated from product description. You can customize if needed.
          </p>
        </div>
      </div>

      <Separator />

      {/* Inventory Settings - Hidden for services (no stock tracking needed) */}
      {!isService && (
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
      )}

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

      {/* Category Assignment Modal */}
      {showCategoryModal && (
        <CategoryAssignmentModal
          item={{
            id: 'wizard-item',
            name: 'New Product',
            sku: '',
            tenantId: tenantId || '',
            tenantCategoryId: data.categoryId || ''
          } as any}
          onSave={handleCategoryAssign}
          onClose={() => setShowCategoryModal(false)}
          tenantId={tenantId}
        />
      )}
    </div>
  );
}
