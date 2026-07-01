/**
 * Standalone Bulk Import Wizard
 *
 * 6-step bulk import flow for supplier catalog items:
 * 1. Supplier picker
 * 2. Catalog search/filter
 * 3. Bulk select with image preview
 * 4. Inline edit (price, stock, optional name/image overrides)
 * 5. Import summary with conflict report
 * 6. Confirm import
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Package, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import SupplierImportService, {
  type TenantSupplier,
  type TenantCatalogItem,
  type ImportSelection,
  type ConflictReport,
  type ImportResult,
} from '@/services/SupplierImportService';

interface ImportWizardProps {
  tenantId: string;
}

interface EditableItem extends TenantCatalogItem {
  selected: boolean;
  overrideName?: string;
  overridePrice?: number;
  overrideStock?: number;
  overrideImage?: string;
}

const WIZARD_STEPS = [
  { title: 'Select Supplier', description: 'Choose a supplier to import from' },
  { title: 'Search Catalog', description: 'Find products to import' },
  { title: 'Select Items', description: 'Choose items to import' },
  { title: 'Edit Details', description: 'Adjust prices, stock, and overrides' },
  { title: 'Review Conflicts', description: 'Check for conflicts before importing' },
  { title: 'Confirm Import', description: 'Execute the import' },
];

export default function ImportWizard({ tenantId }: ImportWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [suppliers, setSuppliers] = useState<TenantSupplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<TenantCatalogItem[]>([]);
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [conflictReport, setConflictReport] = useState<ConflictReport | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    SupplierImportService.listSuppliers(tenantId)
      .then(setSuppliers)
      .catch(() => setError('Failed to load suppliers'));
  }, [tenantId]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() && !selectedSupplier) return;
    setLoading(true);
    setError(null);
    try {
      const res = await SupplierImportService.searchCatalog(tenantId, {
        query: searchQuery || undefined,
        supplierId: selectedSupplier || undefined,
        limit: 100,
      });
      setResults(res.items);
      setSearched(true);
    } catch {
      setError('Search failed');
    } finally {
      setLoading(false);
    }
  }, [tenantId, searchQuery, selectedSupplier]);

  const toggleSelect = (id: string) => {
    setEditableItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const selectedCount = editableItems.filter(i => i.selected).length;

  const handleCheckConflicts = async () => {
    const selections: ImportSelection[] = editableItems
      .filter(i => i.selected)
      .map(i => ({
        supplier_id: i.supplier_id,
        supplier_sku: i.supplier_sku,
        overrides: {
          ...(i.overrideName ? { name: i.overrideName } : {}),
          ...(i.overridePrice ? { price_cents: i.overridePrice } : {}),
          ...(i.overrideStock ? { stock: i.overrideStock } : {}),
          ...(i.overrideImage ? { image_url: i.overrideImage } : {}),
        },
      }));

    if (selections.length === 0) return;
    setLoading(true);
    try {
      const report = await SupplierImportService.checkConflicts(tenantId, selections);
      setConflictReport(report);
      setCurrentStep(4);
    } catch {
      setError('Conflict check failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    const selections: ImportSelection[] = editableItems
      .filter(i => i.selected)
      .map(i => ({
        supplier_id: i.supplier_id,
        supplier_sku: i.supplier_sku,
        overrides: {
          ...(i.overrideName ? { name: i.overrideName } : {}),
          ...(i.overridePrice ? { price_cents: i.overridePrice } : {}),
          ...(i.overrideStock ? { stock: i.overrideStock } : {}),
          ...(i.overrideImage ? { image_url: i.overrideImage } : {}),
        },
      }));

    if (selections.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const result = await SupplierImportService.executeImport(tenantId, selections);
      setImportResult(result);
      setCurrentStep(5);
    } catch {
      setError('Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      if (currentStep === 0 && !selectedSupplier) {
        setError('Please select a supplier');
        return;
      }
      setError(null);
      if (currentStep === 2) {
        const selected = results.map(r => ({ ...r, selected: false }));
        setEditableItems(selected);
      }
      if (currentStep === 3) {
        handleCheckConflicts();
        return;
      }
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setError(null);
      setCurrentStep(prev => prev - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return !!selectedSupplier;
      case 1: return results.length > 0;
      case 2: return selectedCount > 0;
      case 3: return selectedCount > 0;
      case 4: return true;
      default: return false;
    }
  };

  const formatPrice = (cents: number | null) => {
    if (!cents) return '—';
    return `$${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bulk Import Wizard</h1>
        <p className="text-gray-600">Import products from supplier catalogs in bulk</p>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto">
        {WIZARD_STEPS.map((step, idx) => (
          <div key={idx} className="flex items-center gap-2 flex-shrink-0">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                idx === currentStep
                  ? 'bg-blue-600 text-white'
                  : idx < currentStep
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {idx < currentStep ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <span className="h-5 w-5 rounded-full border flex items-center justify-center text-xs">
                  {idx + 1}
                </span>
              )}
              {step.title}
            </div>
            {idx < WIZARD_STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </div>
        ))}
      </div>

      {error && (
        <Alert className="mb-6" variant="error">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{WIZARD_STEPS[currentStep].title}</CardTitle>
          <p className="text-sm text-gray-500">{WIZARD_STEPS[currentStep].description}</p>
        </CardHeader>
        <CardContent>
          <div className="min-h-[300px]">
            {/* Step 1: Supplier Picker */}
            {currentStep === 0 && (
              <div className="space-y-4">
                {suppliers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No suppliers available for this tenant.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {suppliers.map(supplier => (
                      <div
                        key={supplier.id}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedSupplier === supplier.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                        onClick={() => setSelectedSupplier(supplier.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Package className="h-8 w-8 text-gray-400" />
                          <div>
                            <p className="font-medium">{supplier.name}</p>
                            <p className="text-xs text-gray-500">{supplier.connection_type}</p>
                            {supplier.is_builtin && (
                              <Badge variant="info" className="mt-1">Built-in</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Catalog Search */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search by name, brand, or GTIN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Search
                  </Button>
                </div>
                {searched && results.length === 0 && (
                  <p className="text-gray-500 text-center py-8">No results found. Try a different search.</p>
                )}
                {results.length > 0 && (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {results.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="h-12 w-12 object-cover rounded" />
                        ) : (
                          <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center">
                            <Package className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-sm text-gray-500">
                            {item.brand} {item.gtin && `• GTIN: ${item.gtin}`}
                          </p>
                        </div>
                        <span className="text-sm font-medium">{formatPrice(item.msrp_cents)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Bulk Select */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Select items to import. Selected: <strong>{selectedCount}</strong>
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditableItems(prev => prev.map(i => ({ ...i, selected: true })))}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEditableItems(prev => prev.map(i => ({ ...i, selected: false })))}>
                      Clear All
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {editableItems.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all ${
                        item.selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                      onClick={() => toggleSelect(item.id)}
                    >
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleSelect(item.id)}
                        className="h-4 w-4"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="h-12 w-12 object-cover rounded" />
                      ) : (
                        <div className="h-12 w-12 bg-gray-100 rounded flex items-center justify-center">
                          <Package className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {item.brand} {item.gtin && `• GTIN: ${item.gtin}`}
                        </p>
                      </div>
                      <span className="text-sm font-medium">{formatPrice(item.msrp_cents)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Inline Edit */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Adjust prices, stock levels, and optional overrides for the {selectedCount} selected items.
                </p>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {editableItems.filter(i => i.selected).map(item => (
                    <div key={item.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center gap-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="h-10 w-10 object-cover rounded" />
                        ) : (
                          <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center">
                            <Package className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.brand} • {item.supplier_sku}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600">Price (cents)</label>
                          <Input
                            type="number"
                            placeholder={String(item.msrp_cents || 0)}
                            value={item.overridePrice ?? ''}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : undefined;
                              setEditableItems(prev => prev.map(i =>
                                i.id === item.id ? { ...i, overridePrice: val } : i
                              ));
                            }}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Stock</label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={item.overrideStock ?? ''}
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : undefined;
                              setEditableItems(prev => prev.map(i =>
                                i.id === item.id ? { ...i, overrideStock: val } : i
                              ));
                            }}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Name Override</label>
                          <Input
                            placeholder={item.name}
                            value={item.overrideName ?? ''}
                            onChange={(e) => {
                              const val = e.target.value || undefined;
                              setEditableItems(prev => prev.map(i =>
                                i.id === item.id ? { ...i, overrideName: val } : i
                              ));
                            }}
                            className="text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600">Image URL Override</label>
                          <Input
                            placeholder={item.image_url || ''}
                            value={item.overrideImage ?? ''}
                            onChange={(e) => {
                              const val = e.target.value || undefined;
                              setEditableItems(prev => prev.map(i =>
                                i.id === item.id ? { ...i, overrideImage: val } : i
                              ));
                            }}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Conflict Report */}
            {currentStep === 4 && (
              <div className="space-y-4">
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Checking conflicts...</span>
                  </div>
                )}
                {conflictReport && !loading && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-700">{conflictReport.summary.can_import}</p>
                        <p className="text-xs text-green-600">Can Import</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-700">{conflictReport.summary.already_in_catalog}</p>
                        <p className="text-xs text-blue-600">Already in Catalog</p>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <p className="text-2xl font-bold text-orange-700">{conflictReport.summary.gtin_conflict}</p>
                        <p className="text-xs text-orange-600">GTIN Conflicts</p>
                      </div>
                      <div className="p-3 bg-red-50 rounded-lg">
                        <p className="text-2xl font-bold text-red-700">{conflictReport.summary.discontinued}</p>
                        <p className="text-xs text-red-600">Discontinued</p>
                      </div>
                    </div>
                    {conflictReport.conflicts.length > 0 && (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {conflictReport.conflicts.map((c, idx) => (
                          <div key={idx} className={`p-3 rounded-lg border ${
                            c.state === 'can_import' ? 'border-green-200 bg-green-50' :
                            c.state === 'already_in_catalog' ? 'border-blue-200 bg-blue-50' :
                            c.state === 'gtin_conflict' ? 'border-orange-200 bg-orange-50' :
                            'border-red-200 bg-red-50'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{c.supplier_sku}</p>
                                <p className="text-xs text-gray-600">{c.message}</p>
                              </div>
                              <Badge variant={
                                c.state === 'can_import' ? 'success' :
                                c.state === 'already_in_catalog' ? 'info' :
                                c.state === 'gtin_conflict' ? 'warning' : 'error'
                              }>
                                {c.state.replace(/_/g, ' ')}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step 6: Import Result */}
            {currentStep === 5 && (
              <div className="space-y-4">
                {importing && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <span className="ml-2 text-gray-600">Importing items...</span>
                  </div>
                )}
                {importResult && !importing && (
                  <>
                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-medium text-green-900">Import Complete</p>
                        <p className="text-sm text-green-700">
                          {importResult.imported} items imported, {importResult.skipped} skipped
                        </p>
                      </div>
                    </div>
                    {importResult.errors.length > 0 && (
                      <Alert variant="error">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <p className="font-medium mb-1">Errors ({importResult.errors.length}):</p>
                          <ul className="list-disc list-inside text-sm">
                            {importResult.errors.map((e, idx) => (
                              <li key={idx}>{e.supplier_sku}: {e.error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    {importResult.created_item_ids.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Created Item IDs:</p>
                        <div className="flex flex-wrap gap-2">
                          {importResult.created_item_ids.map(id => (
                            <Badge key={id} variant="info">{id}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          {currentStep < 5 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-gray-500">
                Step {currentStep + 1} of {WIZARD_STEPS.length}
              </span>
              <Button
                onClick={handleNext}
                disabled={!canProceed() || loading}
              >
                {currentStep === 4 ? 'Review & Import' : 'Next'}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
          {currentStep === 4 && conflictReport && conflictReport.summary.can_import > 0 && (
            <div className="flex justify-center mt-4">
              <Button onClick={handleExecuteImport} disabled={importing} size="lg">
                <Upload className="h-4 w-4" />
                Import {conflictReport.summary.can_import} Items
              </Button>
            </div>
          )}
          {currentStep === 5 && importResult && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" onClick={() => {
                setCurrentStep(0);
                setSelectedSupplier('');
                setSearchQuery('');
                setResults([]);
                setEditableItems([]);
                setConflictReport(null);
                setImportResult(null);
              }}>
                Start New Import
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
