/**
 * Catalog Search Step (Step 0)
 *
 * Optional pre-step in ItemCreationWizard.
 * Search supplier catalogs by barcode/GTIN or text, select a match to auto-populate wizard.
 * Only visible when FF_SUPPLIER_CATALOG_IMPORT is enabled for the tenant.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Barcode, Package, ChevronRight, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import SupplierImportService, { type TenantCatalogItem, type TenantSupplier, type BarcodeEnrichment } from '@/services/SupplierImportService';

interface CatalogSearchStepProps {
  tenantId: string;
  onUseProduct: (item: TenantCatalogItem) => void;
  onUseEnrichment: (enrichment: BarcodeEnrichment, barcode: string) => void;
  onSkip: () => void;
}

export default function CatalogSearchStep({ tenantId, onUseProduct, onUseEnrichment, onSkip }: CatalogSearchStepProps) {
  const [suppliers, setSuppliers] = useState<TenantSupplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [gtinQuery, setGtinQuery] = useState('');
  const [results, setResults] = useState<TenantCatalogItem[]>([]);
  const [enrichmentResult, setEnrichmentResult] = useState<BarcodeEnrichment | null>(null);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TenantCatalogItem | null>(null);
  const [selectedEnrichment, setSelectedEnrichment] = useState<BarcodeEnrichment | null>(null);

  useEffect(() => {
    SupplierImportService.listSuppliers(tenantId).then(setSuppliers).catch(() => {});
  }, [tenantId]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery && !gtinQuery) return;
    try {
      setLoading(true);
      setSearched(true);
      setEnrichmentResult(null);
      setSelectedEnrichment(null);
      if (gtinQuery) {
        const items = await SupplierImportService.lookupByBarcode(tenantId, gtinQuery, selectedSupplier || undefined);
        setResults(items);
        // If no supplier catalog matches, try barcode enrichment as fallback
        if (items.length === 0) {
          setEnrichmentLoading(true);
          try {
            const enrichment = await SupplierImportService.enrichBarcode(tenantId, gtinQuery);
            setEnrichmentResult(enrichment);
          } catch (enrichErr) {
            console.error('[CatalogSearchStep] Enrichment error:', enrichErr);
          } finally {
            setEnrichmentLoading(false);
          }
        }
      } else {
        const result = await SupplierImportService.searchCatalog(tenantId, {
          supplierId: selectedSupplier || undefined,
          query: searchQuery,
          limit: 24,
        });
        setResults(result.items);
      }
    } catch (err) {
      console.error('[CatalogSearchStep] Search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, searchQuery, gtinQuery, selectedSupplier]);

  const handleGtinSearch = () => {
    if (gtinQuery) {
      setSearchQuery('');
      handleSearch();
    }
  };

  const formatPrice = (cents: number | null) => {
    if (cents === null) return '—';
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Help Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Package className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Search Supplier Catalog</h4>
              <p className="text-sm text-blue-700 mt-1">
                Search supplier catalogs to find a matching product. If found, the wizard will auto-populate
                with supplier data. You can skip this step to enter product details manually.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Filter */}
      {suppliers.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Supplier</label>
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* GTIN / Barcode Lookup */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Barcode / GTIN Lookup</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={gtinQuery}
              onChange={(e) => setGtinQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGtinSearch()}
              placeholder="Scan or enter barcode..."
              className="pl-9"
            />
          </div>
          <Button onClick={handleGtinSearch} variant="outline" className="gap-2">
            <Search className="h-4 w-4" />
            Lookup
          </Button>
        </div>
      </div>

      {/* Text Search */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Text Search</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by name, brand, or SKU..."
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} className="gap-2">
            <Search className="h-4 w-4" />
            Search
          </Button>
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      )}

      {enrichmentLoading && (
        <div className="flex items-center justify-center py-4 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-600" />
          Looking up barcode in external databases...
        </div>
      )}

      {!loading && !enrichmentLoading && searched && results.length === 0 && !enrichmentResult && (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
          No catalog items found. Try a different search or skip to enter manually.
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <div className="text-sm text-gray-500">{results.length} item(s) found</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {results.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
                  selectedItem?.id === item.id
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="aspect-square bg-gray-100 relative">
                  {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-gray-400 text-xs">
                      No image
                    </div>
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <div className="font-medium text-sm text-gray-900 truncate" title={item.name}>
                    {item.name}
                  </div>
                  {item.brand && <div className="text-xs text-gray-500">{item.brand}</div>}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">SKU: {item.supplier_sku}</span>
                    <span className="font-medium text-gray-700">{formatPrice(item.msrp_cents)}</span>
                  </div>
                  {item.gtin && <div className="text-xs text-gray-400">GTIN: {item.gtin}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Enrichment Result (fallback when no supplier catalog matches) */}
      {!loading && !enrichmentLoading && enrichmentResult && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Sparkles className="h-4 w-4" />
            <span>Barcode enrichment found — auto-populate from external database</span>
          </div>
          <div
            onClick={() => setSelectedEnrichment(selectedEnrichment === enrichmentResult ? null : enrichmentResult)}
            className={`rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
              selectedEnrichment === enrichmentResult
                ? 'border-blue-500 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex">
              <div className="w-24 h-24 bg-gray-100 flex-shrink-0 relative">
                {enrichmentResult.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={enrichmentResult.imageUrl}
                    alt={enrichmentResult.name || 'Product'}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full text-gray-400 text-xs">No image</div>
                )}
              </div>
              <div className="p-3 space-y-1 flex-1">
                <div className="font-medium text-sm text-gray-900">{enrichmentResult.name || 'Unknown Product'}</div>
                {enrichmentResult.brand && <div className="text-xs text-gray-500">{enrichmentResult.brand}</div>}
                {enrichmentResult.description && (
                  <div className="text-xs text-gray-500 line-clamp-2">{enrichmentResult.description}</div>
                )}
                <div className="flex items-center gap-2 text-xs">
                  {enrichmentResult.priceCents && (
                    <span className="font-medium text-gray-700">${(enrichmentResult.priceCents / 100).toFixed(2)}</span>
                  )}
                  {enrichmentResult.categoryPath && enrichmentResult.categoryPath.length > 0 && (
                    <span className="text-gray-400">{enrichmentResult.categoryPath.join(' › ')}</span>
                  )}
                  <Badge variant="secondary" className="text-xs">{enrichmentResult.source}</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onSkip}>
          Skip & Enter Manually
        </Button>
        {selectedItem ? (
          <Button onClick={() => onUseProduct(selectedItem)} className="gap-2">
            Use This Product
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : selectedEnrichment ? (
          <Button onClick={() => onUseEnrichment(selectedEnrichment, gtinQuery)} className="gap-2">
            Use Enrichment Data
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
