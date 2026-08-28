'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import directoryPresenceAdminService, {
  CreateSeedRequest,
} from '@/services/DirectoryPresenceAdminService';
import { clientLogger } from '@/lib/client-logger';

interface PresenceSeedsBulkUploadModalProps {
  onClose: () => void;
  onSuccess: (createdCount: number) => void;
}

interface CsvSeedRow {
  business_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  website: string;
  primary_category: string;
  secondary_categories: string;
  seed_batch: string;
  identity_confidence: string;
  category_fit: string;
  latitude: string;
  longitude: string;
  notes: string;
}

const SEED_CSV_HEADERS = [
  'business_name',
  'address',
  'city',
  'state',
  'zip_code',
  'phone',
  'website',
  'primary_category',
  'secondary_categories',
  'seed_batch',
  'identity_confidence',
  'category_fit',
  'latitude',
  'longitude',
  'notes',
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const VALID_CONFIDENCE = ['high', 'medium'];
const VALID_FIT = ['verified', 'probable'];

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseSeedCSV(csvText: string): CsvSeedRow[] {
  const lines = csvText.split('\n').filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV file is empty or invalid');
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const rows: CsvSeedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (rawLine.startsWith('#') || !rawLine) continue;

    const values = parseCSVLine(rawLine);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    rows.push({
      business_name: row.business_name || '',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      zip_code: row.zip_code || '',
      phone: row.phone || '',
      website: row.website || '',
      primary_category: row.primary_category || '',
      secondary_categories: row.secondary_categories || '',
      seed_batch: row.seed_batch || '',
      identity_confidence: (row.identity_confidence || 'high').toLowerCase(),
      category_fit: (row.category_fit || 'verified').toLowerCase(),
      latitude: row.latitude || '',
      longitude: row.longitude || '',
      notes: row.notes || '',
    });
  }

  return rows;
}

function validateSeedRows(rows: CsvSeedRow[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (rows.length === 0) {
    errors.push('No seed rows found in CSV');
    return { valid: false, errors };
  }

  if (rows.length > 200) {
    errors.push('Maximum 200 seeds per upload');
    return { valid: false, errors };
  }

  rows.forEach((row, index) => {
    const rowNum = index + 2;

    if (!row.business_name.trim()) errors.push(`Row ${rowNum}: business_name is required`);
    if (!row.address.trim()) errors.push(`Row ${rowNum}: address is required`);
    if (!row.city.trim()) errors.push(`Row ${rowNum}: city is required`);
    if (!row.state.trim()) errors.push(`Row ${rowNum}: state is required`);
    if (row.state.trim() && !US_STATES.includes(row.state.trim())) {
      errors.push(`Row ${rowNum}: state must be a valid 2-letter US state code`);
    }
    if (!row.primary_category.trim()) errors.push(`Row ${rowNum}: primary_category is required`);
    if (!row.seed_batch.trim()) errors.push(`Row ${rowNum}: seed_batch is required`);

    if (!VALID_CONFIDENCE.includes(row.identity_confidence)) {
      errors.push(`Row ${rowNum}: identity_confidence must be high or medium`);
    }
    if (!VALID_FIT.includes(row.category_fit)) {
      errors.push(`Row ${rowNum}: category_fit must be verified or probable`);
    }

    if (row.website.trim()) {
      const website = row.website.trim();
      if (!/^https?:\/\/.+\..+/.test(website)) {
        errors.push(`Row ${rowNum}: website must be a valid URL (http:// or https://)`);
      }
    }

    if (row.latitude.trim() && Number.isNaN(Number(row.latitude))) {
      errors.push(`Row ${rowNum}: latitude must be a number`);
    }
    if (row.longitude.trim() && Number.isNaN(Number(row.longitude))) {
      errors.push(`Row ${rowNum}: longitude must be a number`);
    }
  });

  return { valid: errors.length === 0, errors };
}

function generateSeedTemplate(): string {
  const comments = [
    '# Directory Presence Seed Bulk Import Template',
    '# Required fields: business_name, address, city, state, primary_category, seed_batch',
    '# Optional fields: zip_code, phone, website, secondary_categories, latitude, longitude, notes',
    '# identity_confidence: high or medium (default: high)',
    '# category_fit: verified or probable (default: verified)',
    '# secondary_categories: comma-separated, e.g. "Halal, International"',
    '#',
    '',
  ].join('\n');

  const headers = SEED_CSV_HEADERS.join(',');
  const example1 = [
    'Sankalp African Grocery',
    '2415 W 86th St',
    'Indianapolis',
    'IN',
    '46268',
    '+13175701234',
    '',
    'African Grocery',
    'Halal, International',
    'indianapolis-african-grocery-2026',
    'high',
    'verified',
    '',
    '',
    'Initial seed from public directory',
  ].map((value) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }).join(',');

  const example2 = [
    'Kokomo International Market',
    '1234 E Markland Ave',
    'Kokomo',
    'IN',
    '46902',
    '',
    'https://example.com/store',
    'International Grocery',
    'African, Asian',
    'indianapolis-african-grocery-2026',
    'medium',
    'probable',
    '',
    '',
    '',
  ].map((value) => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }).join(',');

  return `${comments}${headers}\n${example1}\n${example2}`;
}

function downloadSeedTemplate() {
  const csv = generateSeedTemplate();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', 'presence-seeds-template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function rowToPayload(row: CsvSeedRow): CreateSeedRequest {
  const latitude = row.latitude.trim() ? Number(row.latitude) : undefined;
  const longitude = row.longitude.trim() ? Number(row.longitude) : undefined;
  const secondaryCategories = row.secondary_categories
    ? row.secondary_categories
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  return {
    businessName: row.business_name.trim(),
    address: row.address.trim(),
    city: row.city.trim(),
    state: row.state.trim(),
    zipCode: row.zip_code.trim() || undefined,
    phone: row.phone.trim() || undefined,
    website: row.website.trim() || undefined,
    primaryCategory: row.primary_category.trim(),
    secondaryCategories,
    seedBatch: row.seed_batch.trim(),
    identityConfidence: (row.identity_confidence as 'high' | 'medium') || 'high',
    categoryFit: (row.category_fit as 'verified' | 'probable') || 'verified',
    notes: row.notes.trim() || undefined,
    latitude: Number.isNaN(latitude) ? undefined : latitude,
    longitude: Number.isNaN(longitude) ? undefined : longitude,
  };
}

export default function PresenceSeedsBulkUploadModal({
  onClose,
  onSuccess,
}: PresenceSeedsBulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<CsvSeedRow[]>([]);
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
    setRows([]);

    try {
      const text = await selectedFile.text();
      const parsedRows = parseSeedCSV(text);
      const validation = validateSeedRows(parsedRows);

      if (!validation.valid) {
        setErrors(validation.errors);
        return;
      }

      setRows(parsedRows);
    } catch (error) {
      clientLogger.error('[PresenceSeedsBulkUpload] Failed to parse CSV:', { detail: error });
      setErrors([error instanceof Error ? error.message : 'Failed to parse CSV']);
    }
  };

  const handleUpload = async () => {
    if (rows.length === 0) return;

    setUploading(true);
    setProgress(0);
    setErrors([]);

    const uploadErrors: string[] = [];
    const batchSize = 10;
    let createdCount = 0;

    try {
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);

        const promises = batch.map(async (row, batchIndex) => {
          const rowNum = i + batchIndex + 2;
          try {
            const payload = rowToPayload(row);
            const seed = await directoryPresenceAdminService.createSeed(payload);
            if (!seed || !seed.id) {
              throw new Error('No seed returned from server');
            }
            createdCount++;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed';
            uploadErrors.push(`Row ${rowNum}: ${message}`);
          }
        });

        await Promise.all(promises);
        setProgress(Math.round(((i + batch.length) / rows.length) * 100));
      }

      if (uploadErrors.length > 0) {
        setErrors(uploadErrors);
      } else {
        onSuccess(createdCount);
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
            <CardTitle>Bulk Upload Presence Seeds</CardTitle>
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">How to bulk upload seeds:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Download the CSV template below</li>
                <li>Fill in one row per business</li>
                <li>Save and upload the file</li>
                <li>Review the preview and click Upload</li>
              </ol>
            </div>

            <Button
              variant="secondary"
              onClick={downloadSeedTemplate}
              className="w-full"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download CSV Template
            </Button>

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

            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-900 mb-2">Errors Found:</h4>
                <ul className="text-sm text-red-800 space-y-1 max-h-40 overflow-y-auto">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {rows.length > 0 && errors.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">
                  Ready to Upload: {rows.length} seeds
                </h4>
                <div className="text-sm text-green-800 space-y-1 max-h-40 overflow-y-auto">
                  {rows.slice(0, 5).map((row, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span>{row.business_name}</span>
                      <span className="text-xs bg-green-100 px-2 py-1 rounded">{row.city}, {row.state}</span>
                    </div>
                  ))}
                  {rows.length > 5 && (
                    <p className="text-xs text-green-700 italic">
                      ...and {rows.length - 5} more seeds
                    </p>
                  )}
                </div>
              </div>
            )}

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
                disabled={rows.length === 0 || errors.length > 0 || uploading}
                className="flex-1"
              >
                {uploading ? 'Uploading...' : `Upload ${rows.length} Seeds`}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
