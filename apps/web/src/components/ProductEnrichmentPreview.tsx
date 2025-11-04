'use client';

/**
 * Product Enrichment Preview Component
 * 
 * Shows a preview of how scanned data will enrich an existing product
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Image as ImageIcon,
  FileText,
  Tag,
  DollarSign,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface ProductMatch {
  existingProduct: {
    id: string;
    name: string;
    description?: string;
    brand?: string;
    price: string;
    images?: any[];
    source: string;
    enrichmentStatus: string;
  };
  scannedData: {
    barcode: string;
    name: string;
    description?: string;
    brand?: string;
    price?: number;
    images?: string[];
    specifications?: Record<string, any>;
  };
  matchScore: number;
  matchReasons: string[];
  confidence: 'high' | 'medium' | 'low';
  enrichmentValue: {
    score: number;
    improvements: string[];
  };
  enrichableFields: {
    useName?: boolean;
    useDescription?: boolean;
    useImages?: boolean;
    useBrand?: boolean;
    useSpecs?: boolean;
    usePrice?: boolean;
  };
}

interface ProductEnrichmentPreviewProps {
  match: ProductMatch;
  onEnrich: (productId: string, options: any) => void;
  onCreateNew: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ProductEnrichmentPreview({
  match,
  onEnrich,
  onCreateNew,
  onCancel,
  isLoading = false
}: ProductEnrichmentPreviewProps) {
  const [enrichmentOptions, setEnrichmentOptions] = useState({
    useName: match.enrichableFields.useName || false,
    useDescription: match.enrichableFields.useDescription || false,
    useImages: match.enrichableFields.useImages || false,
    useBrand: match.enrichableFields.useBrand || false,
    useSpecs: match.enrichableFields.useSpecs || false,
    usePrice: false // Default to keeping user's price
  });

  const { existingProduct, scannedData, matchScore, matchReasons, confidence, enrichmentValue } = match;

  const getConfidenceBadge = () => {
    const colors = {
      high: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-orange-100 text-orange-800 border-orange-200'
    };

    const icons = {
      high: CheckCircle2,
      medium: AlertCircle,
      low: AlertCircle
    };

    const Icon = icons[confidence];

    return (
      <Badge className={`${colors[confidence]} border`}>
        <Icon className="w-3 h-3 mr-1" />
        {confidence.toUpperCase()} CONFIDENCE ({matchScore}%)
      </Badge>
    );
  };

  const handleEnrich = () => {
    onEnrich(existingProduct.id, {
      scannedData,
      enrichmentOptions
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">
                <Sparkles className="inline w-6 h-6 mr-2 text-primary-600" />
                Enrich Existing Product?
              </CardTitle>
              <CardDescription>
                We found a matching product that can be enriched with scanned data
              </CardDescription>
            </div>
            {getConfidenceBadge()}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Match Information */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Why this matches:</h3>
            <ul className="space-y-1">
              {matchReasons.map((reason, index) => (
                <li key={index} className="text-sm text-blue-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          {/* Enrichment Value */}
          {enrichmentValue.improvements.length > 0 && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">
                Enrichment Value: {enrichmentValue.score}%
              </h3>
              <ul className="space-y-1">
                {enrichmentValue.improvements.map((improvement, index) => (
                  <li key={index} className="text-sm text-green-800 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {improvement}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Product */}
            <div className="border-2 border-neutral-200 rounded-lg p-4">
              <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Current Product
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-neutral-500">Name</label>
                  <p className="font-medium">{existingProduct.name}</p>
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Brand</label>
                  <p className="font-medium">{existingProduct.brand || <span className="text-neutral-400">Not set</span>}</p>
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Description</label>
                  <p className="text-sm text-neutral-600">
                    {existingProduct.description || <span className="text-neutral-400">No description</span>}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Images</label>
                  <p className="font-medium">
                    {existingProduct.images?.length || 0} image(s)
                  </p>
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Price</label>
                  <p className="font-medium">${existingProduct.price}</p>
                </div>
                <div>
                  <label className="text-xs text-neutral-500">Source</label>
                  <Badge variant="outline">{existingProduct.source.replace(/_/g, ' ')}</Badge>
                </div>
              </div>
            </div>

            {/* Scanned Data */}
            <div className="border-2 border-primary-200 rounded-lg p-4 bg-primary-50">
              <h3 className="font-semibold text-primary-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                From Scan
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-primary-600">Name</label>
                  <p className="font-medium text-primary-900">{scannedData.name}</p>
                  {enrichmentOptions.useName && (
                    <Badge className="mt-1 bg-green-100 text-green-800">Will use</Badge>
                  )}
                </div>
                <div>
                  <label className="text-xs text-primary-600">Brand</label>
                  <p className="font-medium text-primary-900">{scannedData.brand || <span className="text-neutral-400">Not available</span>}</p>
                  {enrichmentOptions.useBrand && scannedData.brand && (
                    <Badge className="mt-1 bg-green-100 text-green-800">Will use</Badge>
                  )}
                </div>
                <div>
                  <label className="text-xs text-primary-600">Description</label>
                  <p className="text-sm text-primary-800">
                    {scannedData.description || <span className="text-neutral-400">Not available</span>}
                  </p>
                  {enrichmentOptions.useDescription && scannedData.description && (
                    <Badge className="mt-1 bg-green-100 text-green-800">Will use</Badge>
                  )}
                </div>
                <div>
                  <label className="text-xs text-primary-600">Images</label>
                  <p className="font-medium text-primary-900">
                    {scannedData.images?.length || 0} image(s)
                  </p>
                  {enrichmentOptions.useImages && scannedData.images && scannedData.images.length > 0 && (
                    <Badge className="mt-1 bg-green-100 text-green-800">Will add</Badge>
                  )}
                </div>
                <div>
                  <label className="text-xs text-primary-600">Price (MSRP)</label>
                  <p className="font-medium text-primary-900">
                    {scannedData.price ? `$${scannedData.price}` : <span className="text-neutral-400">Not available</span>}
                  </p>
                  {enrichmentOptions.usePrice && scannedData.price && (
                    <Badge className="mt-1 bg-green-100 text-green-800">Will use</Badge>
                  )}
                </div>
                <div>
                  <label className="text-xs text-primary-600">Barcode</label>
                  <p className="font-mono text-sm text-primary-900">{scannedData.barcode}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Enrichment Options */}
          <div className="border-2 border-neutral-200 rounded-lg p-4">
            <h3 className="font-semibold text-neutral-900 mb-4">Select fields to enrich:</h3>
            <div className="space-y-3">
              {match.enrichableFields.useName && (
                <label className="flex items-center gap-3 cursor-pointer hover:bg-neutral-50 p-2 rounded">
                  <Checkbox
                    checked={enrichmentOptions.useName}
                    onCheckedChange={(checked) => 
                      setEnrichmentOptions({ ...enrichmentOptions, useName: checked as boolean })
                    }
                  />
                  <div className="flex-1">
                    <p className="font-medium">Use scanned product name</p>
                    <p className="text-sm text-neutral-600">More detailed name from barcode database</p>
                  </div>
                </label>
              )}

              {match.enrichableFields.useDescription && scannedData.description && (
                <label className="flex items-center gap-3 cursor-pointer hover:bg-neutral-50 p-2 rounded">
                  <Checkbox
                    checked={enrichmentOptions.useDescription}
                    onCheckedChange={(checked) => 
                      setEnrichmentOptions({ ...enrichmentOptions, useDescription: checked as boolean })
                    }
                  />
                  <div className="flex-1">
                    <p className="font-medium">Add product description</p>
                    <p className="text-sm text-neutral-600">Detailed description from barcode database</p>
                  </div>
                </label>
              )}

              {match.enrichableFields.useImages && scannedData.images && scannedData.images.length > 0 && (
                <label className="flex items-center gap-3 cursor-pointer hover:bg-neutral-50 p-2 rounded">
                  <Checkbox
                    checked={enrichmentOptions.useImages}
                    onCheckedChange={(checked) => 
                      setEnrichmentOptions({ ...enrichmentOptions, useImages: checked as boolean })
                    }
                  />
                  <div className="flex-1">
                    <p className="font-medium">Add product images ({scannedData.images.length})</p>
                    <p className="text-sm text-neutral-600">High-quality images from barcode database</p>
                  </div>
                </label>
              )}

              {match.enrichableFields.useBrand && scannedData.brand && (
                <label className="flex items-center gap-3 cursor-pointer hover:bg-neutral-50 p-2 rounded">
                  <Checkbox
                    checked={enrichmentOptions.useBrand}
                    onCheckedChange={(checked) => 
                      setEnrichmentOptions({ ...enrichmentOptions, useBrand: checked as boolean })
                    }
                  />
                  <div className="flex-1">
                    <p className="font-medium">Add brand information</p>
                    <p className="text-sm text-neutral-600">Brand: {scannedData.brand}</p>
                  </div>
                </label>
              )}

              {match.enrichableFields.useSpecs && scannedData.specifications && (
                <label className="flex items-center gap-3 cursor-pointer hover:bg-neutral-50 p-2 rounded">
                  <Checkbox
                    checked={enrichmentOptions.useSpecs}
                    onCheckedChange={(checked) => 
                      setEnrichmentOptions({ ...enrichmentOptions, useSpecs: checked as boolean })
                    }
                  />
                  <div className="flex-1">
                    <p className="font-medium">Add product specifications</p>
                    <p className="text-sm text-neutral-600">
                      {Object.keys(scannedData.specifications).length} specification(s)
                    </p>
                  </div>
                </label>
              )}

              {match.enrichableFields.usePrice && scannedData.price && (
                <label className="flex items-center gap-3 cursor-pointer hover:bg-neutral-50 p-2 rounded">
                  <Checkbox
                    checked={enrichmentOptions.usePrice}
                    onCheckedChange={(checked) => 
                      setEnrichmentOptions({ ...enrichmentOptions, usePrice: checked as boolean })
                    }
                  />
                  <div className="flex-1">
                    <p className="font-medium">Update price to ${scannedData.price}</p>
                    <p className="text-sm text-neutral-600">
                      Current: ${existingProduct.price} → New: ${scannedData.price}
                    </p>
                  </div>
                </label>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleEnrich}
              disabled={isLoading}
              className="flex-1"
              size="lg"
            >
              {isLoading ? (
                'Enriching...'
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Enrich Product
                </>
              )}
            </Button>
            <Button
              onClick={onCreateNew}
              variant="secondary"
              disabled={isLoading}
              className="flex-1"
              size="lg"
            >
              <ArrowRight className="w-5 h-5 mr-2" />
              Create New Product
            </Button>
            <Button
              onClick={onCancel}
              variant="ghost"
              disabled={isLoading}
              size="lg"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
