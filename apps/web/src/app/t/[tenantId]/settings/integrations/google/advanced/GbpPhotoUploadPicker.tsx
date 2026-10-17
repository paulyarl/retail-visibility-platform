'use client';

import { useRef, useState } from 'react';
import { Upload, Link as LinkIcon, AlertCircle, CheckCircle, FileImage, Loader2 } from 'lucide-react';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';
import { clientLogger } from '@/lib/client-logger';

const CATEGORIES = [
  { value: 'COVER', label: 'Cover' },
  { value: 'PROFILE', label: 'Profile' },
  { value: 'LOGO', label: 'Logo' },
  { value: 'EXTERIOR', label: 'Exterior' },
  { value: 'INTERIOR', label: 'Interior' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'AT_WORK', label: 'At Work' },
  { value: 'FOOD_AND_DRINK', label: 'Food & Drink' },
  { value: 'MENU', label: 'Menu' },
  { value: 'COMMON_AREA', label: 'Common Area' },
  { value: 'ROOMS', label: 'Rooms' },
  { value: 'TEAMS', label: 'Team' },
  { value: 'ADDITIONAL', label: 'Additional' },
];

const MAX_BYTES = 10 * 1024 * 1024;

interface GbpPhotoUploadPickerProps {
  tenantId: string;
  /** Fired after a successful upload so the parent can refetch the media grid. */
  onUploaded: () => void;
  /** When false the picker renders a capability upsell instead of the form. */
  canUpload?: boolean;
}

/**
 * Photo upload picker for the Advanced GBP Features page.
 *
 * Two modes: a direct file upload (drag/drop or browse → multipart binary
 * upload to Google) and the URL entry for photos already hosted publicly.
 * Backed by POST /api/google/business/media (gated by gbp_media_upload).
 */
export function GbpPhotoUploadPicker({ tenantId, onUploaded, canUpload = true }: GbpPhotoUploadPickerProps) {
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [category, setCategory] = useState('ADDITIONAL');
  const [description, setDescription] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function selectFile(next: File | null) {
    if (!next) return;
    if (!next.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (next.size > MAX_BYTES) {
      setError('Image must be under 10MB.');
      return;
    }
    setError(null);
    setSuccess(false);
    setFile(next);
  }

  async function handleUpload() {
    setError(null);
    setSuccess(false);

    if (mode === 'file' && !file) {
      setError('Choose a photo to upload.');
      return;
    }
    if (mode === 'url' && !sourceUrl) {
      setError('Enter a public photo URL.');
      return;
    }

    try {
      setUploading(true);
      if (mode === 'file' && file) {
        await platformHomeService.uploadGoogleBusinessMediaFile(tenantId, file, category, description || undefined);
      } else {
        await platformHomeService.uploadGoogleBusinessMedia(tenantId, sourceUrl, category);
      }
      setFile(null);
      setSourceUrl('');
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSuccess(true);
      onUploaded();
    } catch (err) {
      clientLogger.error('Failed to upload GBP photo:', { detail: err });
      setError(err instanceof Error ? err.message : 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  }

  if (!canUpload) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">Upload Photo</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Photo upload is part of GBP Pro. Activate the{' '}
          <span className="font-medium text-neutral-800 dark:text-neutral-200">GBP Photo Upload</span> capability to add photos
          straight from your device.
        </p>
        <a
          href={`/t/${tenantId}/settings/feature-store?feature=gbp_media_upload`}
          className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
        >
          <Upload className="w-4 h-4" />
          Activate photo upload
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Upload Photo</h3>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMode('file')}
          className={`flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-md border transition-colors ${
            mode === 'file'
              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700'
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex items-center justify-center gap-1.5 text-sm px-3 py-2 rounded-md border transition-colors ${
            mode === 'url'
              ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          Use URL
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-700 dark:text-green-300">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          Photo uploaded to Google.
        </div>
      )}

      {mode === 'file' ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); selectFile(e.dataTransfer.files?.[0] || null); }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500'
          }`}
        >
          {file ? (
            <div className="flex items-center justify-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
              <FileImage className="w-5 h-5 text-blue-600" />
              {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">Drag and drop a photo here, or click to select</p>
              <p className="text-xs text-neutral-400 mt-1">JPG, PNG or GIF up to 10MB</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => selectFile(e.target.files?.[0] || null)}
          />
        </div>
      ) : (
        <div>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm"
          />
          <p className="text-xs text-neutral-400 mt-1">The photo must be publicly accessible at this URL.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          placeholder="Description (optional)"
          className="sm:col-span-2 px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm"
        />
      </div>

      <div className="flex justify-end mt-3">
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || (mode === 'file' ? !file : !sourceUrl)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Upload to Google'}
        </button>
      </div>
    </div>
  );
}

export default GbpPhotoUploadPicker;
