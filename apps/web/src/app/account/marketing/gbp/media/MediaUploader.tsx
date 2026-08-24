'use client';

import { useState, useRef } from 'react';
import { X, Upload, Link as LinkIcon, AlertCircle, FileImage } from 'lucide-react';
import marketingCustomerService from '@/services/MarketingCustomerService';

interface MediaUploaderProps {
  onClose: () => void;
  onUploaded: () => void;
}

const categories = [
  { value: 'COVER', label: 'Cover Photo' },
  { value: 'PROFILE', label: 'Profile Photo' },
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

export function MediaUploader({ onClose, onUploaded }: MediaUploaderProps) {
  const [mode, setMode] = useState<'file' | 'url'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [category, setCategory] = useState('ADDITIONAL');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB');
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    try {
      setLoading(true);
      setError(null);

      if (mode === 'file' && !file) {
        setError('Please select a file to upload');
        return;
      }
      if (mode === 'url' && !sourceUrl) {
        setError('Please enter a photo URL');
        return;
      }

      await marketingCustomerService.uploadMedia({
        ...(mode === 'file' ? { file: file! } : { sourceUrl }),
        category,
        description: description || undefined,
      });

      onUploaded();
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Upload Photo</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('file')}
              className={`text-sm px-3 py-2 rounded-md border transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'file'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload File
            </button>
            <button
              onClick={() => setMode('url')}
              className={`text-sm px-3 py-2 rounded-md border transition-colors flex items-center justify-center gap-1.5 ${
                mode === 'url'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              Enter URL
            </button>
          </div>

          {/* File upload */}
          {mode === 'file' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }`}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <FileImage className="w-5 h-5 text-blue-600" />
                  {file.name} ({(file.size / 1024).toFixed(0)} KB)
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Drag and drop a photo here, or click to select</p>
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG, GIF up to 10MB</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
              />
            </div>
          )}

          {/* URL input */}
          {mode === 'url' && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Photo URL</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="https://example.com/photo.jpg"
              />
              <p className="text-xs text-gray-400 mt-1">The photo must be publicly accessible at this URL.</p>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Photo description"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={loading || (mode === 'file' ? !file : !sourceUrl)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
          >
            <Upload className="w-4 h-4" />
            {loading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
