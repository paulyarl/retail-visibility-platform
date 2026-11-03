'use client';

import { useEffect, useState } from 'react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';

/**
 * Inventory CSV import card — the merchant SOP surface (spec §5/§6).
 * End-of-day ritual: export the POS pricebook → upload here → the platform
 * upserts catalog + stock. Google-side propagation happens through the
 * normal feed paths; per-product SWIS selection stays on the Products tab.
 */
export default function InventoryImportCard({ tenantId }: { tenantId: string }) {
  const [format, setFormat] = useState<'generic' | 'nrs_pricebook'>('generic');
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<{ at: string } | null>(null);

  async function refreshLastImport() {
    try {
      const res = await platformHomeService.getLastInventoryImport(tenantId);
      setLastImport(res?.data || res);
    } catch { /* freshness label is best-effort */ }
  }

  useEffect(() => { refreshLastImport(); }, [tenantId]);

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const csv = await file.text();
      const res = await platformHomeService.importInventoryCsv(tenantId, format, csv);
      setResult(res?.data || res);
      refreshLastImport();
    } catch (err: any) {
      clientLogger.error('Inventory import failed:', { detail: err });
      setError(err?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow border border-neutral-200 dark:border-neutral-700 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Upload className="w-4 h-4 text-neutral-500" />
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
          Import products &amp; stock
        </h3>
      </div>
      <p className="text-xs text-neutral-500">
        End of day: export your POS pricebook and upload it here — catalog and stock stay in sync.
        No POS? Build the sheet yourself: name, price and stock are enough.
        Your Google stock reflects your latest upload.
        {lastImport?.at && (
          <span className="block mt-1 font-medium">
            Last import: {new Date(lastImport.at).toLocaleString()}
          </span>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as any)}
          className="text-xs px-2 py-1.5 border border-neutral-300 dark:border-neutral-600 rounded bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
        >
          <option value="generic">Generic CSV</option>
          <option value="nrs_pricebook">NRS Pricebook</option>
        </select>
        <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-neutral-300 dark:border-neutral-600 rounded cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
          <FileText className="w-3.5 h-3.5" />
          {file ? file.name : 'Choose CSV file'}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        <button
          onClick={handleImport}
          disabled={!file || importing}
          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-medium"
        >
          {importing ? 'Importing…' : 'Import'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-200">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-800 dark:text-green-200 space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-medium">Import complete</span>
          </div>
          <p>
            Created: {result.created} · Updated: {result.updated} · Unchanged: {result.unchanged} · Skipped: {result.skipped}
          </p>
          {result.absentItemIds?.length > 0 && (
            <p>{result.absentItemIds.length} items in your catalog were missing from this upload — review them (nothing was deleted).</p>
          )}
          {result.errors?.length > 0 && (
            <ul className="text-red-700 dark:text-red-300">
              {result.errors.slice(0, 3).map((e: string, i: number) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
