"use client";

import { useState, useEffect } from "react";
import { Button, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { uploadImage, ImageUploadPresets } from "@/lib/image-upload";

type Photo = {
  id: string;
  url: string;
  position: number;
  alt?: string | null;
  caption?: string | null;
};

type Item = {
  id: string;
  sku: string;
  name: string;
  imageUrl?: string;
};

interface ItemPhotoGalleryProps {
  item: Item;
  tenantId: string;
  onUpdate?: () => void;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function ItemPhotoGallery({ item, tenantId, onUpdate }: ItemPhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editCaption, setEditCaption] = useState("");

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/items/${item.id}/photos`);
      const data = await res.json();
      const photoAssets = Array.isArray(data) ? data : [];
      
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
      console.error("Failed to load photos:", e);
    } finally {
      setLoading(false);
    }
  };

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

      const res = await api.post(`/api/items/${item.id}/photos`, {
        tenantId,
        dataUrl,
        contentType: "image/jpeg",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      await loadPhotos();
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
      const res = await api.put(`/api/items/${item.id}/photos/${photoId}`, {
        position: 0,
      }, {
        // Disable client-side retries since we handle retries in the API route
        headers: { 'x-no-retry': 'true' }
      });

      if (!res.ok) throw new Error("Failed to set primary");

      await loadPhotos();
      onUpdate?.();
    } catch (err) {
      console.error("Failed to set primary:", err);
      setError("Failed to set primary photo");
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm("Delete this photo?")) return;

    try {
      const res = await api.delete(`/api/items/${item.id}/photos/${photoId}`);
      if (!res.ok) throw new Error("Failed to delete");

      await loadPhotos();
      onUpdate?.();
    } catch (err) {
      console.error("Failed to delete:", err);
      setError("Failed to delete photo");
    }
  };

  const handleMigrateLegacy = async () => {
    try {
      setUploading(true);
      setError(null);
      const res = await api.post(`/api/items/${item.id}/photos/migrate-legacy`, {});
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Migration failed");
      }
      await loadPhotos();
      onUpdate?.();
    } catch (err: any) {
      console.error("Failed to migrate legacy image:", err);
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
      const res = await api.put(`/api/items/${item.id}/photos/${photoId}`, {
        alt: editAlt || null,
        caption: editCaption || null,
      });

      if (!res.ok) throw new Error("Failed to update");

      await loadPhotos();
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update:", err);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-neutral-700">
          Photos ({photos.length}/11)
        </div>
        <label
          className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            photos.length >= 11 || uploading
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
            disabled={photos.length >= 11 || uploading}
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
      {photos.length === 0 ? (
        <div className="text-center py-8 text-sm text-neutral-500">
          No photos yet. Add your first photo above.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photo) => (
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
