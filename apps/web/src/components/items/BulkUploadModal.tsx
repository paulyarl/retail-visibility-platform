'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { downloadCSVTemplate, parseCSV, validateCSVItems, autoGenerateSKUs, type CSVItem } from '@/lib/csv-utils';
import CreationCapacityWarning from '@/components/capacity/CreationCapacityWarning';

interface BulkUploadModalProps {
  tenantId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkUploadModal({ tenantId, onClose, onSuccess }: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<CSVItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setErrors(['Please select a CSV file']);
      return;
    }

    setFile(selectedFile);
    setErrors([]);
    setItems([]);

    // Parse CSV
    try {
      const text = await selectedFile.text();
      const parsedItems = parseCSV(text);
      
      // Auto-generate SKUs for items that don't have them
      const itemsWithSKUs = autoGenerateSKUs(parsedItems, tenantId);
      
      // Validate
      const validation = validateCSVItems(itemsWithSKUs);
      if (!validation.valid) {
        setErrors(validation.errors);
        return;
      }

      setItems(itemsWithSKUs);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to parse CSV']);
    }
  };

  const handleUpload = async () => {
    if (items.length === 0) return;

    setUploading(true);
    setProgress(0);
    const uploadErrors: string[] = [];

    try {
      // Upload items in batches of 10
      const batchSize = 10;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        // Upload batch
        const promises = batch.map(async (item) => {
          try {
            const res = await fetch(`/api/items?tenantId=${tenantId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item)
            });

            if (!res.ok) {
              const error = await res.json();
              throw new Error(error.message || 'Upload failed');
            }
          } catch (error) {
            uploadErrors.push(`${item.sku}: ${error instanceof Error ? error.message : 'Failed'}`);
          }
        });

        await Promise.all(promises);
        setProgress(Math.round(((i + batch.length) / items.length) * 100));
      }

      if (uploadErrors.length > 0) {
        setErrors(uploadErrors);
      } else {
        onSuccess();
        onClose();
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Upload failed']);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Bulk Upload Inventory</CardTitle>
            <button
              onClick={onClose}
              className="text-neutral-500 hover:text-neutral-700"
              disabled={uploading}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Capacity Warning */}
            <CreationCapacityWarning 
              type="sku" 
              tenantId={tenantId}
            />
            
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">How to use bulk upload:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Download the CSV template below</li>
                <li>Fill in your product information</li>
                <li>Save the file and upload it here</li>
                <li>Review the preview and click Upload</li>
              </ol>
            </div>

            {/* Download Template */}
            <div>
              <Button
                variant="secondary"
                onClick={downloadCSVTemplate}
                className="w-full"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download CSV Template
              </Button>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Upload CSV File
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                disabled={uploading}
                className="block w-full text-sm text-neutral-900
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary-50 file:text-primary-700
                  hover:file:bg-primary-100
                  cursor-pointer"
              />
            </div>

            {/* Errors */}
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-900 mb-2">Errors Found:</h4>
                <ul className="text-sm text-red-800 space-y-1 max-h-40 overflow-y-auto">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview */}
            {items.length > 0 && errors.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">
                  ✓ Ready to Upload: {items.length} items
                </h4>
                <div className="text-sm text-green-800 space-y-1 max-h-40 overflow-y-auto">
                  {items.slice(0, 5).map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span>{item.name}</span>
                      <span className="text-xs bg-green-100 px-2 py-1 rounded">{item.sku}</span>
                    </div>
                  ))}
                  {items.length > 5 && (
                    <p className="text-xs text-green-700 italic">
                      ...and {items.length - 5} more items
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Progress */}
            {uploading && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-neutral-900">Uploading...</span>
                  <span className="text-sm text-neutral-600">{progress}%</span>
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={uploading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpload}
                disabled={items.length === 0 || errors.length > 0 || uploading}
                className="flex-1"
              >
                {uploading ? 'Uploading...' : `Upload ${items.length} Items`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
