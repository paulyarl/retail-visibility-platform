/**
 * Variant Photo Upload Modal
 * 
 * Modal for uploading and managing photos for a specific variant during item creation.
 * Similar to ItemPhotoGallery but designed for wizard flow.
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Trash2, Image as ImageIcon, X, Loader2 } from 'lucide-react';
import { Button } from '@mantine/core';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';

interface VariantPhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  variant: {
    id: string;
    name: string;
    sku?: string;
  };
  photos: Array<{
    id: string;
    url: string;
    name?: string;
  }>;
  onPhotosChange: (variantId: string, photos: any[]) => void;
}

export default function VariantPhotoUploadModal({
  isOpen,
  onClose,
  variant,
  photos,
  onPhotosChange
}: VariantPhotoUploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const newPhotos = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Simulate upload progress
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
        
        // Create object URL for preview
        const url = URL.createObjectURL(file);
        
        newPhotos.push({
          id: `temp-${Date.now()}-${i}`,
          url,
          name: file.name,
          file, // Store file for later actual upload
          isTemp: true
        });
      }

      // Add new photos to existing ones
      const updatedPhotos = [...photos, ...newPhotos];
      onPhotosChange(variant.id, updatedPhotos);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload photos');
      console.error('[VariantPhotoUploadModal] Upload error:', err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    const updatedPhotos = photos.filter(p => p.id !== photoId);
    onPhotosChange(variant.id, updatedPhotos);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const event = {
        target: { files }
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(event);
    }
  }, []);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="lg"
      title="Manage Variant Photos"
      description={`${variant.name}${variant.sku ? ` (SKU: ${variant.sku})` : ''}`}
    >
      <div className="space-y-4">
        {/* Photo Count Badge */}
        <div className="flex items-center justify-between -mt-2 mb-4">
          <Badge variant="default">{photos.length} photo{photos.length !== 1 ? 's' : ''}</Badge>
        </div>

        {error && (
          <Alert variant="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

          {/* Upload Area */}
          <div
            className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors cursor-pointer"
            onClick={handleUploadClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {uploading ? (
              <div className="space-y-3">
                <Loader2 className="h-12 w-12 text-primary-600 mx-auto animate-spin" />
                <p className="text-sm text-neutral-600">Uploading... {uploadProgress}%</p>
                <div className="w-full bg-neutral-200 rounded-full h-2 max-w-xs mx-auto">
                  <div 
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <Upload className="h-12 w-12 text-neutral-400 mx-auto mb-3" />
                <p className="text-neutral-700 font-medium mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-sm text-neutral-500">
                  PNG, JPG, WEBP up to 10MB each
                </p>
              </>
            )}
          </div>

          {/* Photo Grid */}
          {photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {photos.map((photo, index) => (
                <div key={photo.id} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200">
                    <img
                      src={photo.url}
                      alt={photo.name || `Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Overlay with actions */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="bg-white text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>

                  {/* Photo number badge */}
                  <div className="absolute top-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                    #{index + 1}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-500">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 text-neutral-400" />
              <p className="text-sm">No photos yet for this variant</p>
              <p className="text-xs mt-1">Upload photos above to get started</p>
            </div>
          )}

        {/* Helper Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> Upload multiple photos to showcase this variant from different angles. 
            The first photo will be used as the primary image.
          </p>
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-200">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onClose} disabled={uploading}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
