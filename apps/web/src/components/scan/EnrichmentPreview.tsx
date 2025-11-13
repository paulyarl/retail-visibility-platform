'use client';

import { Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { useState } from 'react';
import CategorySelector from '@/components/items/CategorySelector';

interface EnrichmentData {
  name?: string;
  description?: string;
  brand?: string;
  categoryPath?: string[];
  priceCents?: number;
  metadata?: Record<string, any>;
  source?: string;
}

interface ValidationWarning {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

interface EnrichmentPreviewProps {
  barcode: string;
  sku?: string;
  enrichment?: EnrichmentData;
  validation?: ValidationWarning[];
  isLoading?: boolean;
  onEdit?: (field: string, value: any) => void;
  editable?: boolean;
}

export default function EnrichmentPreview({
  barcode,
  sku,
  enrichment,
  validation = [],
  isLoading = false,
  onEdit,
  editable = false,
}: EnrichmentPreviewProps) {
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'info':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      default:
        return 'text-neutral-600 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/20 border-neutral-200 dark:border-neutral-800';
    }
  };

  const handleCategorySelect = (categoryPath: string[]) => {
    if (onEdit) {
      onEdit('categoryPath', categoryPath);
    }
    setShowCategorySelector(false);
  };

  const handleCategoryCancel = () => {
    setShowCategorySelector(false);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Product Details</CardTitle>
          {enrichment?.source && (
            <Badge variant="info" className="text-xs">
              Source: {enrichment.source}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-3 text-neutral-600 dark:text-neutral-400">
                Enriching product data...
              </span>
            </div>
          )}

          {/* Validation Messages */}
          {!isLoading && validation.length > 0 && (
            <div className="space-y-2">
              {validation.map((warning, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 border rounded-lg ${getSeverityColor(warning.severity)}`}
                >
                  {getSeverityIcon(warning.severity)}
                  <div className="flex-1">
                    <p className="text-sm font-medium capitalize">{warning.field}</p>
                    <p className="text-sm mt-1">{warning.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Product Data */}
          {!isLoading && (
            <div className="space-y-4">
              {/* Barcode & SKU */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Barcode
                  </label>
                  <p className="font-mono text-sm text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded">
                    {barcode}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    SKU
                  </label>
                  <p className="font-mono text-sm text-neutral-900 dark:text-white bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded">
                    {sku || barcode}
                  </p>
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Product Name {!enrichment?.name && <span className="text-red-500">*</span>}
                </label>
                {editable && onEdit ? (
                  <input
                    type="text"
                    value={enrichment?.name || ''}
                    onChange={(e) => onEdit('name', e.target.value)}
                    placeholder="Enter product name..."
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-neutral-800 dark:text-white"
                  />
                ) : (
                  <p className="text-sm text-neutral-900 dark:text-white">
                    {enrichment?.name || (
                      <span className="text-neutral-500 italic">Not available</span>
                    )}
                  </p>
                )}
              </div>

              {/* Brand */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Brand
                </label>
                {editable && onEdit ? (
                  <input
                    type="text"
                    value={enrichment?.brand || ''}
                    onChange={(e) => onEdit('brand', e.target.value)}
                    placeholder="Enter brand..."
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-neutral-800 dark:text-white"
                  />
                ) : (
                  <p className="text-sm text-neutral-900 dark:text-white">
                    {enrichment?.brand || (
                      <span className="text-neutral-500 italic">Unknown</span>
                    )}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Description
                </label>
                {editable && onEdit ? (
                  <textarea
                    value={enrichment?.description || ''}
                    onChange={(e) => onEdit('description', e.target.value)}
                    placeholder="Enter description..."
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-neutral-800 dark:text-white"
                  />
                ) : (
                  <p className="text-sm text-neutral-700 dark:text-neutral-300">
                    {enrichment?.description || (
                      <span className="text-neutral-500 italic">No description available</span>
                    )}
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Category {!enrichment?.categoryPath?.length && <span className="text-red-500">*</span>}
                </label>
                {editable && onEdit ? (
                  <div className="space-y-2">
                    {enrichment?.categoryPath && enrichment.categoryPath.length > 0 ? (
                      <div className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                          <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          <span>{enrichment.categoryPath.join(' > ')}</span>
                          <Badge variant="success" className="text-xs">Assigned</Badge>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCategorySelector(true)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowCategorySelector(true)}
                        className="w-full p-3 text-left border-2 border-dashed border-yellow-300 dark:border-yellow-600 rounded-lg hover:border-yellow-400 dark:hover:border-yellow-500 transition-colors bg-yellow-50 dark:bg-yellow-900/20"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Assign Category</p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300">Required before committing this item</p>
                          </div>
                          <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                      </button>
                    )}
                  </div>
                ) : (
                  enrichment?.categoryPath && enrichment.categoryPath.length > 0 ? (
                    <div className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                      <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>{enrichment.categoryPath.join(' > ')}</span>
                      <Badge variant="success" className="text-xs">Suggested</Badge>
                    </div>
                  ) : (
                    <div className="text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                      <p className="font-medium">Category Required</p>
                      <p className="text-xs mt-1">Please assign a category before committing this item.</p>
                    </div>
                  )
                )}
              </div>

              {/* Price */}
              {enrichment?.priceCents !== undefined && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Price
                  </label>
                  <p className="text-sm text-neutral-900 dark:text-white">
                    ${(enrichment.priceCents / 100).toFixed(2)}
                  </p>
                </div>
              )}

              {/* Additional Metadata */}
              {enrichment?.metadata && Object.keys(enrichment.metadata).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Additional Information
                  </label>
                  <div className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 space-y-1">
                    {Object.entries(enrichment.metadata).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-neutral-600 dark:text-neutral-400 capitalize">
                          {key.replace(/_/g, ' ')}:
                        </span>
                        <span className="text-neutral-900 dark:text-white font-medium">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Summary */}
              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Validation Status
                  </span>
                  {hasErrors ? (
                    <Badge variant="error" className="text-xs">
                      {validation.filter(v => v.severity === 'error').length} Errors
                    </Badge>
                  ) : hasWarnings ? (
                    <Badge variant="warning" className="text-xs">
                      {validation.filter(v => v.severity === 'warning').length} Warnings
                    </Badge>
                  ) : (
                    <Badge variant="success" className="text-xs">
                      Ready to Commit
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Category Selector Modal */}
      {showCategorySelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                Select Category
              </h3>
              <button
                onClick={handleCategoryCancel}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <CategorySelector
                currentCategory={enrichment?.categoryPath || []}
                onCategorySelect={handleCategorySelect}
                onCancel={handleCategoryCancel}
              />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
