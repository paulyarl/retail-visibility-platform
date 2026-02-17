'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PageHeader, { Icons } from '@/components/PageHeader';
import BarcodeScanner from '@/components/scan/BarcodeScanner';
import BatchReview from '@/components/scan/BatchReview';
import EnrichmentPreview from '@/components/scan/EnrichmentPreview';
import { inventoryScanService, ScanSession, ScanResult as ServiceScanResult } from '@/services/InventoryScanService';

// Interface compatible with BatchReview component
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

export default function ActiveScanPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<ScanSession | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const [sessionData, resultsData] = await Promise.all([
        inventoryScanService.getScanSession(sessionId),
        inventoryScanService.getScanResults(sessionId)
      ]);
      
      if (sessionData) {
        setSession(sessionData);
        
        // Transform service results to BatchReview format
        const transformedResults = (resultsData || []).map((result: ServiceScanResult): ScanResult => ({
          id: result.id,
          barcode: result.productId, // Use productId as barcode
          sku: result.sku,
          status: result.status,
          enrichment: result.metadata ? {
            name: result.metadata.name,
            description: result.metadata.description,
            categoryPath: result.metadata.categoryPath,
            metadata: result.metadata
          } : undefined,
          createdAt: result.scannedAt, // Use scannedAt as createdAt
        }));
        
        setResults(transformedResults);
        
        // Auto-select first result for preview
        if (transformedResults.length > 0 && !selectedResult) {
          setSelectedResult(transformedResults[0]);
        }
      } else {
        alert('Failed to load session');
        router.push('/scan');
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      alert('Failed to load session');
      router.push('/scan');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (barcode: string) => {
    if (!session || session.status !== 'in_progress') {
      alert('Session is not active');
      return;
    }

    try {
      setScanning(true);
      
      const data = await inventoryScanService.lookupBarcode(sessionId, barcode);
      
      // Show duplicate warning
      if (data.duplicate) {
        alert(`⚠️ ${data.duplicate.warning}\n\nItem: ${data.duplicate.item.name || data.duplicate.item.sku}`);
      }
      
      // Reload session and results to get updated data
      await loadSession();
      
      // Select the newly added result
      if (data.result) {
        const transformedResult: ScanResult = {
          id: data.result.id,
          barcode: data.result.productId,
          sku: data.result.sku,
          status: data.result.status,
          enrichment: data.result.metadata ? {
            name: data.result.metadata.name,
            description: data.result.metadata.description,
            categoryPath: data.result.metadata.categoryPath,
            metadata: data.result.metadata
          } : undefined,
          createdAt: data.result.scannedAt,
        };
        setSelectedResult(transformedResult);
      }
    } catch (error) {
      console.error('Failed to scan barcode:', error);
      alert('Failed to scan barcode');
    } finally {
      setScanning(false);
    }
  };

  const handleRemove = async (resultId: string) => {
    if (!session || session.status !== 'in_progress') {
      alert('Session is not active');
      return;
    }

    try {
      await inventoryScanService.deleteScanResult(sessionId, resultId);

      // Clear selection if we're removing the selected item
      if (selectedResult?.id === resultId) {
        setSelectedResult(null);
      }
      
      // Reload session and results
      await loadSession();
    } catch (error) {
      console.error('Failed to remove item:', error);
      alert('Failed to remove item');
    }
  };

  const handleCommit = async () => {
    if (!session || session.status !== 'in_progress') {
      alert('Session is not active');
      return;
    }

    const validCount = results?.filter((r: ScanResult) => r.status !== 'error').length || 0;
    
    if (!confirm(`Commit ${validCount} items to inventory?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      setCommitting(true);
      
      await inventoryScanService.commitScanSession(sessionId);
      alert(`✅ Successfully committed ${validCount} items to inventory!`);
      router.push('/scan');
    } catch (error) {
      console.error('Failed to commit session:', error);
      alert('Failed to commit session');
    } finally {
      setCommitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this scanning session?\n\nAll scanned items will be discarded.')) {
      return;
    }

    try {
      await inventoryScanService.deleteScanSession(sessionId);
      router.push('/scan');
    } catch (error) {
      console.error('Failed to cancel session:', error);
      alert('Failed to cancel session');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600 dark:text-neutral-400">Session not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Active Scanning Session"
        description={`${session.scannedItems || 0} items scanned • ${results?.length || 0} total results`}
        icon={Icons.Inventory}
        backLink={{ href: '/scan', label: 'Back to Sessions' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Scanner & Preview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Barcode Scanner */}
            <BarcodeScanner
              onScan={handleScan}
              onError={(error) => alert(error)}
              mode="camera" // Fixed mode since deviceType is not in ScanSession interface
              disabled={session.status !== 'in_progress' || scanning}
            />

            {/* Enrichment Preview */}
            {selectedResult && (
              <EnrichmentPreview
                barcode={selectedResult.barcode}
                sku={selectedResult.sku}
                enrichment={selectedResult.enrichment}
                validation={[
                  ...(selectedResult.status === 'error' ? [{
                    field: 'error',
                    message: 'There was an error with this scan',
                    severity: 'warning' as const,
                  }] : []),
                  ...(!selectedResult.enrichment?.name ? [{
                    field: 'name',
                    message: 'Product name is required',
                    severity: 'error' as const,
                  }] : []),
                ]}
                isLoading={scanning}
              />
            )}
          </div>

          {/* Right Column - Batch Review */}
          <div className="lg:col-span-1">
            <BatchReview
              results={results || []}
              onRemove={handleRemove}
              onCommit={handleCommit}
              onCancel={handleCancel}
              isCommitting={committing}
              disabled={session.status !== 'in_progress'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
