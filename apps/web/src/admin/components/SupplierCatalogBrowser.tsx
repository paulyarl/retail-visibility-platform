/**
 * Supplier Catalog Browser Admin Page
 *
 * Paginated catalog item grid with search/filter, image previews,
 * batch ingest, and quarantine management.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  SupplierService,
  type CatalogItem,
  type CatalogSearchResult,
  type QuarantinedItem,
  type BatchIngestResult,
} from '@/services/SupplierService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { AlertCircle, Search, ArrowLeft, ArrowRight, AlertTriangle, RefreshCw, Upload } from 'lucide-react';

const PAGE_SIZE = 24;

export default function SupplierCatalogBrowser() {
  const params = useParams();
  const supplierId = params.id as string;

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [gtinFilter, setGtinFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [quarantined, setQuarantined] = useState<QuarantinedItem[]>([]);
  const [showQuarantine, setShowQuarantine] = useState(false);
  const [ingestResult, setIngestResult] = useState<BatchIngestResult | null>(null);
  const [showIngestDialog, setShowIngestDialog] = useState(false);
  const [csvText, setCsvText] = useState('');

  const loadCatalog = useCallback(async () => {
    try {
      setLoading(true);
      const result: CatalogSearchResult = await SupplierService.searchCatalog(supplierId, {
        query: searchQuery || undefined,
        brand: brandFilter || undefined,
        gtin: gtinFilter || undefined,
        category: categoryFilter || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(result.items);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }, [supplierId, searchQuery, brandFilter, gtinFilter, categoryFilter, offset]);

  const loadQuarantine = useCallback(async () => {
    try {
      const data = await SupplierService.getQuarantinedItems(supplierId);
      setQuarantined(data);
    } catch {
      // silent fail
    }
  }, [supplierId]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    loadQuarantine();
  }, [loadQuarantine]);

  const handleSearch = () => {
    setOffset(0);
    loadCatalog();
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setBrandFilter('');
    setGtinFilter('');
    setCategoryFilter('');
    setOffset(0);
  };

  const handlePrev = () => {
    setOffset(Math.max(0, offset - PAGE_SIZE));
  };

  const handleNext = () => {
    if (offset + PAGE_SIZE < total) {
      setOffset(offset + PAGE_SIZE);
    }
  };

  const parseCsv = (csv: string): { supplier_sku: string; name: string; gtin?: string; brand?: string; category?: string; image_url?: string; description?: string }[] => {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const obj: any = {};
      headers.forEach((h, idx) => {
        if (h === 'sku' || h === 'supplier_sku') obj.supplier_sku = values[idx];
        else if (h === 'name') obj.name = values[idx];
        else if (h === 'gtin' || h === 'barcode') obj.gtin = values[idx];
        else if (h === 'brand') obj.brand = values[idx];
        else if (h === 'category') obj.category = values[idx];
        else if (h === 'image_url' || h === 'image') obj.image_url = values[idx];
        else if (h === 'description') obj.description = values[idx];
      });
      if (obj.supplier_sku && obj.name) rows.push(obj);
    }
    return rows;
  };

  const handleIngest = async () => {
    try {
      const rows = parseCsv(csvText);
      if (rows.length === 0) {
        setError('No valid rows found. Ensure CSV has sku and name columns.');
        return;
      }
      const result = await SupplierService.batchIngest(supplierId, rows);
      setIngestResult(result);
      setShowIngestDialog(false);
      setCsvText('');
      setSuccess(`Ingested ${result.inserted + result.updated} items (${result.inserted} new, ${result.updated} updated, ${result.quarantined} quarantined)`);
      await loadCatalog();
      await loadQuarantine();
    } catch (err: any) {
      setError(err.message || 'Failed to ingest catalog');
    }
  };

  const handleReplayQuarantine = async (qid: string) => {
    try {
      await SupplierService.replayQuarantine(supplierId, qid);
      setSuccess('Quarantined item replayed');
      await loadQuarantine();
      await loadCatalog();
    } catch (err: any) {
      setError(err.message || 'Failed to replay item');
    }
  };

  const formatPrice = (cents: number | null) => {
    if (cents === null) return '—';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const hasFilters = searchQuery || brandFilter || gtinFilter || categoryFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catalog Browser</h1>
          <p className="text-sm text-gray-500 mt-1">Browse and manage supplier catalog items</p>
        </div>
        <div className="flex gap-2">
          {quarantined.length > 0 && (
            <Button variant="outline" onClick={() => setShowQuarantine(true)} className="gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Quarantine ({quarantined.length})
            </Button>
          )}
          <Button onClick={() => setShowIngestDialog(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Batch Ingest
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500">&times;</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 p-3 text-sm text-green-700">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-green-500">&times;</button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-gray-500">Search</label>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Name, SKU, or GTIN..."
            className="mt-1"
          />
        </div>
        <div className="w-40">
          <label className="text-xs font-medium text-gray-500">Brand</label>
          <Input
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Brand..."
            className="mt-1"
          />
        </div>
        <div className="w-40">
          <label className="text-xs font-medium text-gray-500">GTIN</label>
          <Input
            value={gtinFilter}
            onChange={(e) => setGtinFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="GTIN..."
            className="mt-1"
          />
        </div>
        <div className="w-40">
          <label className="text-xs font-medium text-gray-500">Category</label>
          <Input
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Category..."
            className="mt-1"
          />
        </div>
        <Button onClick={handleSearch} className="gap-2">
          <Search className="h-4 w-4" />
          Search
        </Button>
        {hasFilters && (
          <Button variant="outline" onClick={handleClearFilters}>Clear</Button>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No catalog items found. Try adjusting your filters or use Batch Ingest to add items.
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-500">
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total} items
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
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
                  {item.availability !== 'in_stock' && (
                    <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                      {item.availability}
                    </Badge>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <div className="font-medium text-sm text-gray-900 truncate" title={item.name}>
                    {item.name}
                  </div>
                  {item.brand && (
                    <div className="text-xs text-gray-500">{item.brand}</div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">SKU: {item.supplier_sku}</span>
                    <span className="font-medium text-gray-700">{formatPrice(item.msrp_cents)}</span>
                  </div>
                  {item.gtin && (
                    <div className="text-xs text-gray-400">GTIN: {item.gtin}</div>
                  )}
                  {item.category && (
                    <Badge variant="outline" className="text-xs">{item.category}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={offset === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={handleNext}
              disabled={offset + PAGE_SIZE >= total}
              className="gap-2"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* Batch Ingest Dialog */}
      <Dialog open={showIngestDialog} onOpenChange={setShowIngestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Batch Ingest Catalog Items</DialogTitle>
            <DialogDescription>
              Paste CSV data with columns: sku, name, gtin, brand, category, image_url, description.
              Each row will be upserted by (supplier_id, supplier_sku).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="sku,name,gtin,brand,category,image_url,description&#10;SKU001,Product Name,012345678905,Brand,Category,https://...,Description"
              rows={10}
              className="w-full rounded-md border border-gray-300 p-3 font-mono text-sm"
            />
          </div>
          {ingestResult && (
            <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700 mb-4">
              <div className="font-medium">Last Ingest Result</div>
              <div>Inserted: {ingestResult.inserted} | Updated: {ingestResult.updated} | Quarantined: {ingestResult.quarantined}</div>
              {ingestResult.errors.length > 0 && (
                <div className="mt-1 text-red-600">
                  {ingestResult.errors.length} error(s): {ingestResult.errors.slice(0, 3).map((e) => `Row ${e.row}: ${e.error}`).join(', ')}
                  {ingestResult.errors.length > 3 && ` ...and ${ingestResult.errors.length - 3} more`}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIngestDialog(false)}>Cancel</Button>
            <Button onClick={handleIngest}>Ingest</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quarantine Dialog */}
      <Dialog open={showQuarantine} onOpenChange={setShowQuarantine}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quarantined Items ({quarantined.length})</DialogTitle>
            <DialogDescription>
              Items that failed ingestion. Review and replay or discard.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[400px] overflow-y-auto space-y-2">
            {quarantined.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No quarantined items.</div>
            ) : (
              quarantined.map((q) => (
                <div key={q.id} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">{q.error_code}</Badge>
                      <span className="text-sm text-gray-600">{q.error_message}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReplayQuarantine(q.id)}
                      className="gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Replay
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-gray-400 font-mono">
                    {JSON.stringify(q.raw_payload).slice(0, 200)}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuarantine(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
