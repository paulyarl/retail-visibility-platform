"use client";

import { useState, useEffect } from "react";
import { Button, Input } from "@/components/ui";
import { itemsService } from "@/services/ItemsSingletonService";
import { uploadImage, ImageUploadPresets } from "@/lib/image-upload";
import PhotoSingleton from "@/lib/singletons/PhotoSingleton";
import { useVariantsSingleton } from "@/lib/singletons/VariantsSingleton";
import { clientLogger } from '@/lib/client-logger';

type Photo = {
  id: string;
  url: string;
  position: number;
  alt?: string | null;
  caption?: string | null;
  variant_id?: string | null;
};

type Item = {
  id: string;
  sku: string;
  name: string;
  imageUrl?: string;
  has_variants?: boolean;
};

type ProductVariant = {
  id: string;
  variant_name: string;
  sku: string;
  is_active: boolean;
};

interface ItemPhotoGalleryProps {
  item: Item;
  tenantId: string;
  onUpdate?: () => void;
}



export default function ItemPhotoGallery({ item, tenantId, onUpdate }: ItemPhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [variantsLoading, setVariantsLoading] = useState(false);

  // Initialize VariantsSingleton
  const { actions: variantsActions } = useVariantsSingleton(tenantId);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      // Use PhotoSingleton for cached photo fetching
      const photoSingleton = PhotoSingleton.getInstance(tenantId);
      const photoAssets = await photoSingleton.fetchItemPhotos(item.id);
      
      // If no photos in photo_assets but item has imageUrl, show it as a legacy photo
      if (photoAssets.length === 0 && item.imageUrl) {
        setPhotos([{
          id: 'legacy-image',
          url: item.imageUrl,
          position: 0,
          alt: null,
          caption: 'Legacy image (stored on item, not in photo gallery)',
        }]);
      } else {
        setPhotos(photoAssets);
      }
    } catch (e) {
      clientLogger.error("Failed to load photos:", { detail: e });
    } finally {
      setLoading(false);
    }
  };

  // Load variants if item has them
  useEffect(() => {
    if (!item.has_variants) return;

    const loadVariants = async () => {
      try {
        setVariantsLoading(true);
        const result = await variantsActions.fetchItemVariants(item.id);
        if (result.success && result.variants) {
          setVariants(result.variants);
        }
      } catch (e) {
        clientLogger.error("Failed to load variants:", { detail: e });
      } finally {
        setVariantsLoading(false);
      }
    };

    loadVariants();
  }, [item.id, item.has_variants, variantsActions]);

  useEffect(() => {
    loadPhotos();
  }, [item.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photos.length >= 11) {
      setError("Maximum 11 photos per item");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Use middleware with HIGH compression for product images (many images)
      const result = await uploadImage(file, ImageUploadPresets.product);
      const dataUrl = result.dataUrl;

      const res = await itemsService.uploadPhoto(item.id, {
        tenantId,
        dataUrl,
        contentType: "image/jpeg",
        variant_id: selectedVariantId, // Include variant_id if variant is selected
      });

      if (!res) {
        throw new Error("Upload failed");
      }

      // Instant update: Add the new photo to the gallery immediately
      const newPhoto: Photo = {
        id: res.id,
        url: res.url,
        position: res.position,
        alt: res.alt,
        caption: res.caption,
        variant_id: res.variant_id,
      };
      
      setPhotos(prevPhotos => [...prevPhotos, newPhoto]);
      onUpdate?.();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    try {
      const res = await itemsService.setPrimaryPhoto(item.id, photoId);

      if (!res) throw new Error("Failed to set primary");

      await loadPhotos();
      onUpdate?.();
    } catch (err) {
      clientLogger.error("Failed to set primary:", { detail: err });
      setError("Failed to set primary photo");
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm("Delete this photo?")) return;

    try {
      const res = await itemsService.deletePhoto(item.id, photoId);
      if (!res) throw new Error("Failed to delete");

      await loadPhotos();
      onUpdate?.();
    } catch (err) {
      clientLogger.error("Failed to delete:", { detail: err });
      setError("Failed to delete photo");
    }
  };

  const handleMigrateLegacy = async () => {
    try {
      setUploading(true);
      setError(null);
      const res = await itemsService.migrateLegacyPhotos(item.id);
      if (!res) {
        throw new Error("Migration failed");
      }
      await loadPhotos();
      onUpdate?.();
    } catch (err: any) {
      clientLogger.error("Failed to migrate legacy image:", { detail: err });
      setError(err.message || "Failed to migrate legacy image");
    } finally {
      setUploading(false);
    }
  };

  const handleEditStart = (photo: Photo) => {
    setEditingId(photo.id);
    setEditAlt(photo.alt || "");
    setEditCaption(photo.caption || "");
  };

  const handleEditSave = async (photoId: string) => {
    try {
      const res = await itemsService.updatePhoto(item.id, photoId, {
        alt: editAlt || null,
        caption: editCaption || null,
      });

      if (!res) throw new Error("Failed to update");

      await loadPhotos();
      setEditingId(null);
    } catch (err) {
      clientLogger.error("Failed to update:", { detail: err });
      setError("Failed to update photo");
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditAlt("");
    setEditCaption("");
  };

  if (loading && photos.length === 0) {
    return <div className="text-sm text-neutral-500">Loading photos...</div>;
  }

  // Filter photos by selected variant
  const filteredPhotos = selectedVariantId
    ? photos.filter(p => p.variant_id === selectedVariantId)
    : photos.filter(p => !p.variant_id); // Show parent photos by default

  const displayPhotos = filteredPhotos;

  return (
    <div className="space-y-4">
      {/* Variant Selector */}
      {item.has_variants && variants.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assign photos to:
          </label>
          <select
            value={selectedVariantId || ""}
            onChange={(e) => setSelectedVariantId(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            disabled={variantsLoading}
          >
            <option value="">Parent Product (Default)</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.variant_name} - {variant.sku}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-gray-600">
            {selectedVariantId
              ? `Photos uploaded will be assigned to this variant. Showing ${displayPhotos.length} photo(s) for this variant.`
              : `Photos uploaded will be assigned to the parent product. Showing ${displayPhotos.length} parent photo(s).`}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-neutral-700">
          Photos ({displayPhotos.length}/11)
        </div>
        <label
          className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            displayPhotos.length >= 11 || uploading
              ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
              : "bg-primary-600 text-white hover:bg-primary-700"
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          {uploading ? "Uploading..." : "Add Photo"}
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={displayPhotos.length >= 11 || uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Gallery Grid */}
      {displayPhotos.length === 0 ? (
        <div className="text-center py-8 text-sm text-neutral-500">
          {selectedVariantId 
            ? "No photos for this variant yet. Upload photos above to assign them to this variant."
            : "No photos yet. Add your first photo above."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {displayPhotos.map((photo) => (
            <div
              key={photo.id}
              className="relative group border border-neutral-200 rounded-lg overflow-hidden bg-white"
            >
              {/* Image */}
              <div className="aspect-square bg-neutral-100 flex items-center justify-center">
                <img
                  src={photo.url}
                  alt={photo.alt || item.name}
                  className="object-cover w-full h-full"
                />
              </div>

              {/* Primary Badge */}
              {photo.position === 0 && (
                <div className="absolute top-2 left-2 bg-primary-600 text-white text-xs px-2 py-1 rounded">
                  Primary
                </div>
              )}

              {/* Actions Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                {photo.id === 'legacy-image' ? (
                  <div className="bg-white text-neutral-700 px-3 py-2 rounded text-xs font-medium text-center max-w-[90%]">
                    <p className="font-semibold">Legacy Image</p>
                    <p className="mt-1 text-neutral-500 mb-2">This image is stored on the item, not in the gallery</p>
                    <button
                      onClick={handleMigrateLegacy}
                      disabled={uploading}
                      className="bg-primary-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
                    >
                      {uploading ? "Migrating..." : "Migrate to Gallery"}
                    </button>
                  </div>
                ) : (
                  <>
                    {photo.position !== 0 && (
                      <button
                        onClick={() => handleSetPrimary(photo.id)}
                        className="bg-white text-neutral-900 px-2 py-1 rounded text-xs font-medium hover:bg-neutral-100"
                        title="Set as primary"
                      >
                        Set Primary
                      </button>
                    )}
                    <button
                      onClick={() => handleEditStart(photo)}
                      className="bg-white text-neutral-900 px-2 py-1 rounded text-xs font-medium hover:bg-neutral-100"
                      title="Edit alt/caption"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(photo.id)}
                      className="bg-red-600 text-white px-2 py-1 rounded text-xs font-medium hover:bg-red-700"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>

              {/* Edit Modal (inline) */}
              {editingId === photo.id && (
                <div className="absolute inset-0 bg-white p-3 flex flex-col gap-2 z-10">
                  <Input
                    value={editAlt}
                    onChange={(e) => setEditAlt(e.target.value)}
                    placeholder="Alt text"
                    label="Alt"
                  />
                  <Input
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Caption"
                    label="Caption"
                  />
                  <div className="flex gap-2 mt-auto">
                    <Button size="sm" onClick={() => handleEditSave(photo.id)}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleEditCancel}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
