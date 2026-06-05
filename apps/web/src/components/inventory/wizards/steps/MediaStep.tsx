/**
 * Media & Visuals Step (Step 5)
 * 
 * Media management with:
 * - Primary image upload
 * - Gallery images management
 * - Variant media cloning strategies
 * - Video URL and thumbnail
 * - Image preview and management
 * - Drag-and-drop functionality
 * 
 * Fifth step in the 7-step product creation wizard
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useProductOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { 
  Image, 
  Camera, 
  Upload, 
  Video, 
  Copy, 
  Trash2, 
  Plus,
  Eye,
  AlertTriangle,
  CheckCircle,
  X,
  ImagePlus,
  Loader2
} from 'lucide-react';
import PhotoSingleton from '@/lib/singletons/PhotoSingleton';
import VariantPhotoUploadModal from '../VariantPhotoUploadModal';
import { uploadImage, ImageUploadPresets } from '@/lib/image-upload';
import { itemsService } from '@/services/ItemsSingletonService';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Separator } from '@/components/ui/Separator';
import { Progress } from '@/components/ui/Progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/Dialog';

interface MediaStepProps {
  data: {
    primaryImage: any;
    galleryImages: any[];
    variantMedia: {
      cloningStrategy: 'clone_all' | 'clone_some' | 'upload_all' | 'mixed';
      parentImagesToClone: string[];
      variantSpecificImages: Record<string, any>;
    };
    videoUrl?: string;
    videoThumbnail?: string;
  };
  errors: Record<string, string>;
  productType: {
    hasVariants: boolean;
    variants: any[];
  };
  variants: any[];
  onChange: (data: any) => void;
}

interface UploadedImage {
  id: string;
  url: string; // Supabase URL (permanent)
  path: string; // Storage path for later linking
  name: string;
  size: number;
  type: string;
  uploadedAt: Date;
}

const CLONING_STRATEGIES = [
  {
    id: 'clone_all',
    title: 'Clone All Images',
    description: 'All parent images are cloned to every variant',
    recommended: true
  },
  {
    id: 'clone_some',
    title: 'Clone Selected Images',
    description: 'Choose which parent images to clone to variants'
  },
  {
    id: 'upload_all',
    title: 'Upload All Images',
    description: 'Upload unique images for each variant'
  },
  {
    id: 'mixed',
    title: 'Mixed Strategy',
    description: 'Combine cloning and unique uploads per variant'
  }
];

// Helper function to convert video URLs to embeddable formats
function getVideoEmbedUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    const urlObj = new URL(url);
    
    // YouTube URLs
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      let videoId: string | undefined;
      
      if (urlObj.hostname.includes('youtu.be')) {
        // youtu.be/VIDEO_ID
        videoId = urlObj.pathname.slice(1);
      } else {
        // youtube.com/watch?v=VIDEO_ID or youtube.com/embed/VIDEO_ID
        videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
      }
      
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    
    // Vimeo URLs
    if (urlObj.hostname.includes('vimeo.com')) {
      const vimeoId = urlObj.pathname.split('/').pop();
      if (vimeoId) {
        return `https://player.vimeo.com/video/${vimeoId}`;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

export default function MediaStep({ data, errors, productType, variants, onChange }: MediaStepProps) {
  const params = useParams();
  const tenantId = params.tenantId as string;

  // Product options capability gating for gallery and video
  const productOptionsCap = useProductOptionsCapability(tenantId || null, { forTenant: true });
  const showsGallery = productOptionsCap.data?.showsGallery ?? true;
  const showsVideo = productOptionsCap.data?.showsVideo ?? true;

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [showVariantPhotoModal, setShowVariantPhotoModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    imageId: string;
    isPrimary: boolean;
    imageName: string;
    isVideo: boolean;
  }>({ isOpen: false, imageId: '', isPrimary: false, imageName: '', isVideo: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Note: Photos are uploaded to Supabase immediately during wizard
  // This avoids localStorage quota issues with base64 data
  // After item creation, photos are linked to the item via the backend API

  // Handle file upload with immediate Supabase upload
  const handleFileUpload = useCallback(async (files: FileList, isPrimary: boolean = false) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const totalFiles = files.length;
      
      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const progress = ((i + 1) / totalFiles) * 100;
        setUploadProgress(progress);

        // Compress image first
        const result = await uploadImage(file, ImageUploadPresets.product);
        
        if (result.error) {
          console.error('[MediaStep] Image compression error:', result.error);
          continue;
        }

        // Upload to Supabase immediately via service
        let uploadResult;
        try {
          uploadResult = await itemsService.uploadTempPhoto({
            tenantId,
            dataUrl: result.dataUrl,
          });
          console.log('[MediaStep] Photo uploaded to Supabase:', uploadResult.url);
        } catch (uploadError) {
          console.error('[MediaStep] Supabase upload failed:', uploadError);
          continue; // Skip this image if upload fails
        }

        const uploadedImage: UploadedImage = {
          id: uploadResult.id,
          url: uploadResult.url, // Permanent Supabase URL
          path: uploadResult.path, // Storage path for later linking
          name: file.name,
          size: uploadResult.bytes || result.compressedSize,
          type: uploadResult.contentType || result.contentType,
          uploadedAt: new Date()
        };

        if (isPrimary && i === 0) {
          onChange({
            ...data,
            primaryImage: uploadedImage
          });
        } else {
          onChange({
            ...data,
            galleryImages: [...data.galleryImages, uploadedImage]
          });
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [data, onChange, tenantId]);

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  }, [handleFileUpload]);

  const handlePrimaryImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleGalleryUpload = () => {
    galleryInputRef.current?.click();
  };

  const handleRemoveImage = (imageId: string, isPrimary: boolean = false) => {
    // Find the image to get its name for the confirmation dialog
    const imageToRemove = isPrimary 
      ? data.primaryImage 
      : data.galleryImages.find(img => img.id === imageId);
    
    if (!imageToRemove) return;
    
    // Show confirmation dialog
    setDeleteConfirmation({
      isOpen: true,
      imageId,
      isPrimary,
      imageName: isPrimary ? 'Primary Image' : imageToRemove.name || 'Gallery Image',
      isVideo: false
    });
  };

  const handleRemoveVideo = () => {
    // Show confirmation dialog for video
    setDeleteConfirmation({
      isOpen: true,
      imageId: '',
      isPrimary: false,
      imageName: 'Product Video',
      isVideo: true
    });
  };

  const confirmDelete = async () => {
    const { imageId, isPrimary, isVideo } = deleteConfirmation;
    
    if (isVideo) {
      // Handle video deletion
      onChange({
        ...data,
        videoUrl: ''
      });
    } else {
      // Handle image deletion
      const imageToRemove = isPrimary 
        ? data.primaryImage 
        : data.galleryImages.find(img => img.id === imageId);
      
      // Delete from Supabase using the exact path returned from upload
      if (imageToRemove?.path) {
        try {
          await itemsService.deleteTempPhoto(imageToRemove.path);
          console.log('[MediaStep] Deleted temp photo from Supabase:', imageToRemove.path);
        } catch (error) {
          console.error('[MediaStep] Failed to delete temp photo:', error);
          // Continue with local removal even if delete fails
        }
      }
      
      // Remove from local state
      if (isPrimary) {
        onChange({
          ...data,
          primaryImage: null
        });
      } else {
        onChange({
          ...data,
          galleryImages: data.galleryImages.filter(img => img.id !== imageId)
        });
      }
    }
    
    // Close confirmation dialog
    setDeleteConfirmation({ isOpen: false, imageId: '', isPrimary: false, imageName: '', isVideo: false });
  };

  const cancelDelete = () => {
    setDeleteConfirmation({ isOpen: false, imageId: '', isPrimary: false, imageName: '', isVideo: false });
  };

  const handleVideoUrlChange = (url: string) => {
    onChange({
      ...data,
      videoUrl: url
    });
  };

  const handleCloningStrategyChange = (strategy: string) => {
    onChange({
      ...data,
      variantMedia: {
        ...data.variantMedia,
        cloningStrategy: strategy
      }
    });
  };

  const handleParentImageToggle = (imageId: string) => {
    const currentImages = data.variantMedia.parentImagesToClone;
    const newImages = currentImages.includes(imageId)
      ? currentImages.filter(id => id !== imageId)
      : [...currentImages, imageId];
    
    onChange({
      ...data,
      variantMedia: {
        ...data.variantMedia,
        parentImagesToClone: newImages
      }
    });
  };

  const handleManageVariantPhotos = (variant: any) => {
    setSelectedVariant(variant);
    setShowVariantPhotoModal(true);
  };

  const handleVariantPhotosChange = (variantId: string, photos: any[]) => {
    onChange({
      ...data,
      variantMedia: {
        ...data.variantMedia,
        variantSpecificImages: {
          ...data.variantMedia.variantSpecificImages,
          [variantId]: photos
        }
      }
    });
  };

  const getVariantPhotoCount = (variantId: string) => {
    return data.variantMedia.variantSpecificImages?.[variantId]?.length || 0;
  };

  const getMediaQuality = () => {
    let score = 0;
    if (data.primaryImage) score += 40;
    if (data.galleryImages.length > 0) score += 30;
    if (data.galleryImages.length >= 3) score += 10;
    if (data.videoUrl) score += 10;
    if (productType.hasVariants && data.variantMedia.cloningStrategy !== 'clone_all') score += 10;
    return Math.min(score, 100);
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-gray-400';
  };

  const getQualityBadge = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Work';
  };

  const isFormValid = () => {
    // For products without variants, primary image is required
    if (!productType.hasVariants && !data.primaryImage) {
      return false;
    }
    return true;
  };

  const mediaQuality = getMediaQuality();

  return (
    <div className="space-y-6">
      {/* Help Section */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <Camera className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">Media & Visuals</h4>
              <p className="text-sm text-blue-700 mt-1">
                Upload product images and manage media. For products with variants, configure cloning strategies
                to efficiently manage multiple images. High-quality visuals significantly improve conversion rates.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Media Quality Indicator */}
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Image className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="font-medium">Media Quality</div>
                <div className="text-sm text-gray-600">
                  {mediaQuality}% Complete
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge className={getQualityColor(mediaQuality)}>
                {getQualityBadge(mediaQuality)}
              </Badge>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${mediaQuality}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Primary Image */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">
            Primary Image {!productType.hasVariants && <span className="text-red-500">*</span>}
          </Label>
          <Button onClick={handlePrimaryImageUpload} disabled={isUploading}
          variant='gradient' style={{ color: 'white' }}>
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files && handleFileUpload(e.target.files, true)}
          className="hidden"
        />

        {data.primaryImage ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img
                    src={data.primaryImage.url}
                    alt={data.primaryImage.name}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full p-1">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-medium">{data.primaryImage.name}</div>
                  <div className="text-sm text-gray-600">
                    {(data.primaryImage.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                  <div className="text-xs text-gray-500">
                    Uploaded {new Date(data.primaryImage.uploadedAt).toLocaleTimeString()}
                  </div>
                </div>
                <Button 
                  variant='gradient' style={{ color: 'white' }}
                  size="sm"
                  onClick={() => handleRemoveImage(data.primaryImage.id, true)}
                  className="p-2"
                >
                  <Trash2 className="h-4 w-4" style={{ color: 'white' }} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              Drag and drop your primary image here, or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Recommended: Square image, at least 1000x1000px
            </p>
          </div>
        )}

        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}
      </div>

      {/* Gallery Images - Gated by showsGallery capability */}
      {showsGallery && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Gallery Images</Label>
          <div className="flex items-center space-x-2">
            <Badge variant="default">{data.galleryImages.length} images</Badge>
            <Button onClick={handleGalleryUpload} disabled={isUploading}
            variant='gradient' style={{ color: 'white' }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Images
            </Button>
          </div>
        </div>

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => e.target.files && handleFileUpload(e.target.files, false)}
          className="hidden"
        />

        {data.galleryImages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.galleryImages.map((image, index) => (
              <Card key={image.id} className="overflow-hidden">
                <CardContent className="p-2">
                  <div className="relative group">
                    <img
                      src={image.url}
                      alt={image.name}
                      className="w-full h-32 object-cover rounded"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewImage(image.url)}
                          className="p-1 bg-white rounded"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveImage(image.id)}
                          className="p-1 bg-white rounded"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-medium truncate">{image.name}</div>
                    <div className="text-xs text-gray-500">
                      {(image.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <Image className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">
              No gallery images yet
            </p>
            <p className="text-sm text-gray-500">
              Add multiple images to showcase your product from different angles
            </p>
          </div>
        )}
      </div>
      )}

      {!showsGallery && (
        <Card className="opacity-50 border-gray-200 bg-gray-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Image className="h-5 w-5 text-gray-400" />
              <div>
                <h4 className="font-medium text-gray-500">Image Gallery</h4>
                <p className="text-sm text-gray-400">
                  Gallery images are not available on your current plan. Upgrade to enable multiple product images.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video URL - Gated by showsVideo capability */}
      {showsVideo && (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Video className="h-4 w-4 text-blue-600" />
          <Label className="text-base font-medium">Product Video (Optional)</Label>
        </div>
        <Input
          placeholder="Enter YouTube or Vimeo video URL..."
          value={data.videoUrl || ''}
          onChange={(e) => handleVideoUrlChange(e.target.value)}
        />
        {data.videoUrl && (
          <>
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Video className="h-5 w-5 text-blue-600" />
                  <div className="flex-1">
                    <div className="font-medium">Video Added</div>
                    <div className="text-sm text-gray-600 truncate">{data.videoUrl}</div>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">
                    Ready
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Video Preview */}
            <Card className="border-gray-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Eye className="h-4 w-4" />
                    <span>Video Preview</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveVideo()}
                    className="p-1 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  {getVideoEmbedUrl(data.videoUrl) ? (
                    <iframe
                      src={getVideoEmbedUrl(data.videoUrl)!}
                      className="w-full h-full"
                      allowFullScreen
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      title="Product Video Preview"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center text-white">
                        <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm opacity-75">Video preview not available</p>
                        <p className="text-xs opacity-50 mt-1">Please enter a valid YouTube or Vimeo URL</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  💡 Supported: YouTube, Vimeo videos
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      )}

      {!showsVideo && (
        <Card className="opacity-50 border-gray-200 bg-gray-50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Video className="h-5 w-5 text-gray-400" />
              <div>
                <h4 className="font-medium text-gray-500">Product Video</h4>
                <p className="text-sm text-gray-400">
                  Video attachments are not available on your current plan. Upgrade to enable product videos.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Variant Media Configuration */}
      {productType.hasVariants && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Copy className="h-4 w-4 text-purple-600" />
              <Label className="text-base font-medium">Variant Media Configuration</Label>
            </div>

            <div>
              <Label className="text-sm font-medium">Cloning Strategy</Label>
              <p className="text-xs text-gray-600 mb-3">
                Choose how to manage images across {variants.length} variants
              </p>
              <RadioGroup
                value={data.variantMedia.cloningStrategy}
                onValueChange={handleCloningStrategyChange}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {CLONING_STRATEGIES.map((strategy) => (
                  <div key={strategy.id} className="flex items-start space-x-3">
                    <RadioGroupItem value={strategy.id} id={strategy.id} />
                    <Label htmlFor={strategy.id} className="cursor-pointer">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium">{strategy.title}</span>
                        {strategy.recommended && (
                          <Badge variant="info" className="text-xs">Recommended</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{strategy.description}</p>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Parent Image Selection */}
            {data.variantMedia.cloningStrategy === 'clone_some' && data.primaryImage && (
              <div>
                <Label className="text-sm font-medium">Select Images to Clone</Label>
                <p className="text-xs text-gray-500 mb-3">
                  Choose which parent images will be cloned to variants
                </p>
                <div className="space-y-2">
                  <div className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      id="primary-clone"
                      checked={data.variantMedia.parentImagesToClone.includes(data.primaryImage.id)}
                      onChange={() => handleParentImageToggle(data.primaryImage.id)}
                      className="rounded"
                    />
                    <Label htmlFor="primary-clone" className="cursor-pointer flex-1">
                      <div className="flex items-center space-x-2">
                        <img
                          src={data.primaryImage.url}
                          alt={data.primaryImage.name}
                          className="w-8 h-8 object-cover rounded"
                        />
                        <div>
                          <div className="text-sm font-medium">Primary Image</div>
                          <div className="text-xs text-gray-500">{data.primaryImage.name}</div>
                        </div>
                      </div>
                    </Label>
                  </div>
                  {data.galleryImages.map((image) => (
                    <div key={image.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded-lg">
                      <input
                        type="checkbox"
                        id={`gallery-clone-${image.id}`}
                        checked={data.variantMedia.parentImagesToClone.includes(image.id)}
                        onChange={() => handleParentImageToggle(image.id)}
                        className="rounded"
                      />
                      <Label htmlFor={`gallery-clone-${image.id}`} className="cursor-pointer flex-1">
                        <div className="flex items-center space-x-2">
                          <img
                            src={image.url}
                            alt={image.name}
                            className="w-8 h-8 object-cover rounded"
                          />
                          <div>
                            <div className="text-sm font-medium truncate">{image.name}</div>
                            <div className="text-xs text-gray-500">Gallery Image</div>
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Variant Summary */}
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <Copy className="h-5 w-5 text-purple-600" />
                  <div>
                    <div className="font-medium">Variant Media Summary</div>
                    <div className="text-sm text-gray-600">
                      {variants.length} variants • {data.variantMedia.cloningStrategy} strategy
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Variant-Specific Photo Management */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Variant Photos</Label>
                  <p className="text-xs text-gray-500 mt-1">
                    Upload unique photos for each variant (optional)
                  </p>
                </div>
                <Badge variant="default">
                  {Object.keys(data.variantMedia.variantSpecificImages || {}).length} variants with photos
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {variants.map((variant: any) => {
                  const photoCount = getVariantPhotoCount(variant.id);
                  const variantPhotos = data.variantMedia.variantSpecificImages?.[variant.id] || [];
                  return (
                    <Card key={variant.id} className="border-neutral-200 hover:border-primary-300 transition-colors">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Variant Info & Button */}
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{variant.name}</div>
                              {variant.sku && (
                                <div className="text-xs text-gray-500">SKU: {variant.sku}</div>
                              )}
                              <div className="flex items-center space-x-2 mt-2">
                                <ImagePlus className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-600">
                                  {photoCount} photo{photoCount !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleManageVariantPhotos(variant)}
                              className="ml-3"
                            >
                              <Upload className="h-3 w-3 mr-1" />
                              Manage
                            </Button>
                          </div>

                          {/* Photo Thumbnails */}
                          {variantPhotos.length > 0 && (
                            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                              {variantPhotos.slice(0, 4).map((photo: any, idx: number) => (
                                <div
                                  key={photo.id}
                                  className="relative flex-shrink-0 group"
                                >
                                  <img
                                    src={photo.url}
                                    alt={photo.name || `Photo ${idx + 1}`}
                                    className="w-12 h-12 object-cover rounded border border-neutral-200"
                                  />
                                  {idx === 0 && (
                                    <div className="absolute -top-1 -right-1 bg-primary-500 text-white text-[10px] px-1 rounded-full">
                                      1st
                                    </div>
                                  )}
                                </div>
                              ))}
                              {variantPhotos.length > 4 && (
                                <div className="flex-shrink-0 w-12 h-12 bg-neutral-100 rounded border border-neutral-200 flex items-center justify-center">
                                  <span className="text-xs text-neutral-600 font-medium">
                                    +{variantPhotos.length - 4}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Alert>
                <AlertDescription className="text-sm">
                  💡 <strong>Tip:</strong> Variant photos override parent photos. If you don't upload variant-specific photos, 
                  the cloning strategy above will determine which parent photos are used.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </>
      )}

      {/* Variant Photo Upload Modal */}
      {selectedVariant && (
        <VariantPhotoUploadModal
          isOpen={showVariantPhotoModal}
          onClose={() => {
            setShowVariantPhotoModal(false);
            setSelectedVariant(null);
          }}
          variant={selectedVariant}
          photos={data.variantMedia.variantSpecificImages?.[selectedVariant.id] || []}
          onPhotosChange={handleVariantPhotosChange}
        />
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 max-w-4xl max-h-screen overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Image Preview</h3>
              <Button variant="ghost" onClick={() => setPreviewImage(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <img
              src={previewImage}
              alt="Preview"
              className="w-full h-auto rounded"
            />
          </div>
        </div>
      )}

      {/* Validation Summary */}
      <Card className={isFormValid() ? 'border-green-200 bg-green-50' : 'border-gray-200'}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            {isFormValid() ? (
              <Camera className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            )}
            <div>
              <h4 className="font-medium">
                {isFormValid() ? 'Media configured' : 'Media needs attention'}
              </h4>
              <p className="text-sm text-gray-600">
                {isFormValid() 
                  ? 'Product media is properly configured with images and settings.'
                  : !productType.hasVariants 
                  ? 'Primary image is required for products without variants.'
                  : 'Media configuration is ready for variants.'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmation.isOpen} onOpenChange={(open) => !open && cancelDelete()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmation.imageName}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {deleteConfirmation.isVideo ? 'Delete Video' : 'Delete Image'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
