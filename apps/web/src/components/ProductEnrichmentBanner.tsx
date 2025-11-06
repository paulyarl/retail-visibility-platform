'use client';

/**
 * Product Enrichment Banner
 * 
 * Shows a banner on the products dashboard for products that need enrichment
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  AlertCircle, 
  Sparkles, 
  ScanLine,
  FileEdit,
  Upload,
  ChevronRight,
  Image as ImageIcon,
  FileText,
  Tag
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProductNeedingEnrichment {
  id: string;
  name: string;
  source: string;
  enrichmentStatus: string;
  missing: {
    missingImages: boolean;
    missingDescription: boolean;
    missingSpecs: boolean;
    missingBrand: boolean;
  };
}

interface ProductEnrichmentBannerProps {
  tenantId?: string;
}

export default function ProductEnrichmentBanner({ tenantId }: ProductEnrichmentBannerProps = {}) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductNeedingEnrichment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchProductsNeedingEnrichment();
  }, []);

  const fetchProductsNeedingEnrichment = async () => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await fetch(`${API_BASE_URL}/api/products/needs-enrichment`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('[ProductEnrichmentBanner] Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (products.length === 0) {
    return null;
  }

  const getMissingFieldsText = (missing: ProductNeedingEnrichment['missing']): string[] => {
    const fields: string[] = [];
    if (missing.missingImages) fields.push('images');
    if (missing.missingDescription) fields.push('description');
    if (missing.missingSpecs) fields.push('specifications');
    if (missing.missingBrand) fields.push('brand');
    return fields;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      <Card className="border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-orange-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-yellow-600" />
              </div>
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-neutral-900 flex items-center gap-2 flex-wrap">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                    <span>{products.length} {products.length === 1 ? 'Product Needs' : 'Products Need'} Enrichment</span>
                  </h3>
                  <p className="text-sm sm:text-base text-neutral-600 mt-1">
                    These products were created by Quick Start Wizard and are missing important details.
                    Enrich them by scanning barcodes to add images, descriptions, and specifications.
                  </p>
                </div>
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 flex-shrink-0">
                  {products.length}
                </Badge>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-3 mt-4">
                <Button
                  onClick={() => router.push(tenantId ? `/t/${tenantId}/scan?mode=enrich` : '/scan?mode=enrich')}
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  <ScanLine className="w-4 h-4 mr-2" />
                  Scan Products to Enrich
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setExpanded(!expanded)}
                >
                  <FileEdit className="w-4 h-4 mr-2" />
                  {expanded ? 'Hide' : 'View'} Products
                  <ChevronRight className={`w-4 h-4 ml-1 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push('/products/import')}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import from Supplier
                </Button>
              </div>

              {/* Expanded Product List */}
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-4 space-y-2"
                >
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {products.slice(0, 20).map((product) => {
                      const missingFields = getMissingFieldsText(product.missing);
                      
                      return (
                        <div
                          key={product.id}
                          className="bg-white border border-neutral-200 rounded-lg p-3 hover:border-primary-300 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-neutral-900">{product.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className="text-xs">
                                  {product.source.replace(/_/g, ' ')}
                                </Badge>
                                <div className="flex items-center gap-1 text-xs text-neutral-500">
                                  {product.missing.missingImages && (
                                    <span className="flex items-center gap-1">
                                      <ImageIcon className="w-3 h-3" />
                                      No images
                                    </span>
                                  )}
                                  {product.missing.missingDescription && (
                                    <span className="flex items-center gap-1 ml-2">
                                      <FileText className="w-3 h-3" />
                                      No description
                                    </span>
                                  )}
                                  {product.missing.missingBrand && (
                                    <span className="flex items-center gap-1 ml-2">
                                      <Tag className="w-3 h-3" />
                                      No brand
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(tenantId ? `/t/${tenantId}/scan?mode=enrich&productId=${product.id}` : `/scan?mode=enrich&productId=${product.id}`)}
                            >
                              <ScanLine className="w-4 h-4 mr-1" />
                              Scan
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {products.length > 20 && (
                    <p className="text-sm text-neutral-500 text-center pt-2">
                      Showing 20 of {products.length} products
                    </p>
                  )}
                </motion.div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-yellow-200">
                <div className="text-center">
                  <p className="text-2xl font-bold text-neutral-900">
                    {products.filter(p => p.missing.missingImages).length}
                  </p>
                  <p className="text-xs text-neutral-600">Missing Images</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-neutral-900">
                    {products.filter(p => p.missing.missingDescription).length}
                  </p>
                  <p className="text-xs text-neutral-600">Missing Description</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-neutral-900">
                    {products.filter(p => p.missing.missingBrand).length}
                  </p>
                  <p className="text-xs text-neutral-600">Missing Brand</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-neutral-900">
                    {products.filter(p => p.missing.missingSpecs).length}
                  </p>
                  <p className="text-xs text-neutral-600">Missing Specs</p>
                </div>
              </div>

              {/* Time Savings Estimate */}
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900">
                  <strong>💡 Time Savings:</strong> Scanning these {products.length} products will save you approximately{' '}
                  <strong>{Math.round(products.length * 10 / 60)} hours</strong> compared to manual entry
                  (${Math.round(products.length * 10 / 60 * 25)} in labor costs at $25/hour)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
