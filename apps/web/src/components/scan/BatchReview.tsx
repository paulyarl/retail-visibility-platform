'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';

interface ScanResult {
  id: string;
  barcode: string;
  sku?: string;
  status: string;
  enrichment?: {
    name?: string;
    description?: string;
    categoryPath?: string[];
    metadata?: Record<string, any>;
  };
  duplicateOf?: string;
  createdAt: string;
}

interface BatchReviewProps {
  results: ScanResult[];
  onRemove: (resultId: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  isCommitting?: boolean;
  disabled?: boolean;
}

export default function BatchReview({
  results,
  onRemove,
  onCommit,
  onCancel,
  isCommitting = false,
  disabled = false,
}: BatchReviewProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  const filteredResults = showDuplicatesOnly
    ? results.filter(r => r.status === 'duplicate')
    : results;

  const duplicateCount = results.filter(r => r.status === 'duplicate').length;
  const validCount = results.length - duplicateCount;

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredResults.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredResults.map(r => r.id)));
    }
  };

  const removeSelected = () => {
    if (confirm(`Remove ${selectedIds.size} selected items?`)) {
      selectedIds.forEach(id => onRemove(id));
      setSelectedIds(new Set());
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="success" className="text-xs">New</Badge>;
      case 'duplicate':
        return <Badge variant="warning" className="text-xs">Duplicate</Badge>;
      case 'error':
        return <Badge variant="error" className="text-xs">Error</Badge>;
      default:
        return <Badge variant="default" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Scanned Items</CardTitle>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
              {validCount} valid items, {duplicateCount} duplicates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={showDuplicatesOnly}
                onChange={(e) => setShowDuplicatesOnly(e.target.checked)}
                className="rounded border-neutral-300 dark:border-neutral-600"
              />
              Show duplicates only
            </label>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {results.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-neutral-400 dark:text-neutral-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-neutral-600 dark:text-neutral-400">No items scanned yet</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-1">
              Start scanning barcodes to add items to this batch
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Bulk Actions */}
            {selectedIds.size > 0 && (
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-primary-900 dark:text-primary-300">
                  {selectedIds.size} items selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={removeSelected}
                    disabled={disabled}
                    className="px-3 py-1 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                  >
                    Remove Selected
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-1 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            {/* Items List */}
            <div className="space-y-2">
              {/* Select All Header */}
              <div className="flex items-center gap-3 px-4 py-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredResults.length && filteredResults.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-neutral-300 dark:border-neutral-600"
                />
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Select All ({filteredResults.length})
                </span>
              </div>

              {/* Items */}
              {filteredResults.map((result) => (
                <div
                  key={result.id}
                  className={`flex items-start gap-3 p-4 border rounded-lg transition-colors ${
                    selectedIds.has(result.id)
                      ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                  }`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.has(result.id)}
                    onChange={() => toggleSelect(result.id)}
                    className="mt-1 rounded border-neutral-300 dark:border-neutral-600"
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-mono text-sm font-medium text-neutral-900 dark:text-white">
                            {result.barcode}
                          </p>
                          {getStatusBadge(result.status)}
                        </div>
                        
                        {result.enrichment?.name && (
                          <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-1">
                            {result.enrichment.name}
                          </p>
                        )}
                        
                        {result.enrichment?.description && (
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                            {result.enrichment.description}
                          </p>
                        )}

                        {result.enrichment?.categoryPath && result.enrichment.categoryPath.length > 0 && (
                          <div className="flex items-center gap-1 mt-2">
                            <svg className="w-3 h-3 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <span className="text-xs text-neutral-600 dark:text-neutral-400">
                              {result.enrichment.categoryPath.join(' > ')}
                            </span>
                          </div>
                        )}

                        {result.status === 'duplicate' && (
                          <div className="mt-2 text-xs text-yellow-700 dark:text-yellow-400">
                            ⚠️ This item already exists in inventory
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <button
                        onClick={() => onRemove(result.id)}
                        disabled={disabled}
                        className="p-1 text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Remove item"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-700">
              <button
                onClick={onCancel}
                disabled={disabled || isCommitting}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                Cancel Session
              </button>

              <div className="flex items-center gap-3">
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  {validCount} items ready to commit
                </div>
                <Button
                  onClick={onCommit}
                  disabled={disabled || isCommitting || validCount === 0}
                  loading={isCommitting}
                  className="px-6"
                >
                  {isCommitting ? 'Committing...' : `Commit ${validCount} Items`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
