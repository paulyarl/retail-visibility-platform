'use client';

import { useState, useEffect } from 'react';
import { Modal, Button, Alert } from '@/components/ui';
import { Search, Image as ImageIcon, Download, ExternalLink, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface ImageResult {
  id: string;
  url: string;
  thumbnail: string;
  description: string;
  photographer: string;
  photographerUrl: string;
  source: 'unsplash' | 'pexels';
  downloadUrl: string;
}

interface ImageFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName: string;
  productId: string;
  tenantId: string;
  onImageAttached: () => void;
}

export default function ImageFinderModal({
  isOpen,
  onClose,
  productName,
  productId,
  tenantId,
  onImageAttached,
}: ImageFinderModalProps) {
  const [searchQuery, setSearchQuery] = useState(productName);
  const [images, setImages] = useState<ImageResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-search when modal opens
  useEffect(() => {
    if (isOpen && productName) {
      handleSearch();
    }
  }, [isOpen]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setError(null);
    setImages([]);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}/api/v1/images/search?query=${encodeURIComponent(searchQuery)}`,
        { headers, credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to search for images');
      }

      const data = await response.json();
      setImages(data.images || []);

      if (data.images.length === 0) {
        setError('No images found. Try a different search term.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to search for images');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAttachImage = async () => {
    if (!selectedImage) return;

    setIsAttaching(true);
    setError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'}/api/v1/tenants/${tenantId}/items/${productId}/attach-image`,
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            imageUrl: selectedImage.downloadUrl,
            source: selectedImage.source,
            photographer: selectedImage.photographer,
            photographerUrl: selectedImage.photographerUrl,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to attach image');
      }

      onImageAttached();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to attach image');
    } finally {
      setIsAttaching(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Find Product Image"
      description={`Search for images for "${productName}"`}
      size="xl"
    >
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for images..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Search
              </>
            )}
          </Button>
        </div>

        {/* Info Banner */}
        <Alert variant="info">
          <p className="text-sm">
            <strong>Free stock photos</strong> from Unsplash and Pexels. Click an image to select it, then click "Attach Image" to add it to your product.
          </p>
        </Alert>

        {/* Error */}
        {error && (
          <Alert variant="error">
            {error}
          </Alert>
        )}

        {/* Image Grid */}
        {isSearching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {images.map((image) => (
              <div
                key={image.id}
                onClick={() => setSelectedImage(image)}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  selectedImage?.id === image.id
                    ? 'border-blue-600 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="aspect-square relative">
                  <Image
                    src={image.thumbnail}
                    alt={image.description}
                    fill
                    className="object-cover"
                  />
                  {selectedImage?.id === image.id && (
                    <div className="absolute inset-0 bg-blue-600 bg-opacity-20 flex items-center justify-center">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-2 bg-white">
                  <p className="text-xs text-gray-600 truncate">
                    Photo by{' '}
                    <a
                      href={image.photographerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {image.photographer}
                    </a>
                  </p>
                  <p className="text-xs text-gray-400 capitalize">{image.source}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            {selectedImage && (
              <span>
                Selected: Photo by <strong>{selectedImage.photographer}</strong> on{' '}
                <strong className="capitalize">{selectedImage.source}</strong>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleAttachImage}
              disabled={!selectedImage || isAttaching}
            >
              {isAttaching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Attaching...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Attach Image
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
