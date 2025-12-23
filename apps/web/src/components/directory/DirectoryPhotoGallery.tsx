"use client";

import { useState, useEffect } from "react";
import { Button, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { uploadImage, ImageUploadPresets } from "@/lib/image-upload";
import { DirectoryListing } from "@/hooks/directory/useDirectoryListing";

type DirectoryPhoto = {
  id: string;
  url: string;
  position: number;
  alt?: string | null;
  caption?: string | null;
};

interface DirectoryPhotoGalleryProps {
  listing: DirectoryListing;
  tenantId: string;
  onUpdate?: () => void;
}

export default function DirectoryPhotoGallery({ listing, tenantId, onUpdate }: DirectoryPhotoGalleryProps) {
  const [photos, setPhotos] = useState<DirectoryPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [pastedUrl, setPastedUrl] = useState("");

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/directory/${listing.id}/photos`);
      const data = await res.json();
      const photoAssets = Array.isArray(data) ? data : [];

      setPhotos(photoAssets);
    } catch (e) {
      console.error("Failed to load directory photos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [listing.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photos.length >= 10) {
      setError("Maximum 10 photos per directory listing");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Use MEDIUM compression for directory photos (fewer images, better quality)
      const result = await uploadImage(file, ImageUploadPresets.directory);
      const dataUrl = result.dataUrl;

      const res = await api.post(`/api/directory/${listing.id}/photos`, {
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

  const handleUploadFromUrl = async () => {
    if (!pastedUrl) return;

    if (photos.length >= 10) {
      setError("Maximum 10 photos per directory listing");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Fetch the image from the URL
      const response = await fetch(pastedUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch image from URL');
      }

      const blob = await response.blob();
      
      // Convert blob to File
      const file = new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' });

      // Use MEDIUM compression for directory photos (fewer images, better quality)
      const result = await uploadImage(file, ImageUploadPresets.directory);

      const res = await api.post(`/api/directory/${listing.id}/photos`, {
        tenantId,
        dataUrl: result.dataUrl,
        contentType: result.contentType,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      await loadPhotos();
      onUpdate?.();
      setPastedUrl(""); // Clear the input after successful upload
    } catch (err: any) {
      setError(err.message || 'Failed to fetch and upload image from URL');
    } finally {
      setUploading(false);
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    try {
      const res = await api.put(`/api/directory/${listing.id}/photos/${photoId}`, {
        position: 0,
      });

      if (!res.ok) throw new Error("Failed to set primary");

      await loadPhotos();
      onUpdate?.();
    } catch (err) {
      console.error("Failed to set primary directory photo:", err);
      setError("Failed to set primary photo");
    }
  };

  const handleDelete = async (photoId: string) => {
    if (!confirm("Delete this photo?")) return;

    try {
      const res = await api.delete(`/api/directory/${listing.id}/photos/${photoId}`);
      if (!res.ok) throw new Error("Failed to delete");

      await loadPhotos();
      onUpdate?.();
    } catch (err) {
      console.error("Failed to delete directory photo:", err);
      setError("Failed to delete photo");
    }
  };

  const handleEditStart = (photo: DirectoryPhoto) => {
    setEditingId(photo.id);
    setEditAlt(photo.alt || "");
    setEditCaption(photo.caption || "");
  };

  const handleEditSave = async (photoId: string) => {
    try {
      const res = await api.put(`/api/directory/${listing.id}/photos/${photoId}`, {
        alt: editAlt || null,
        caption: editCaption || null,
      });

      if (!res.ok) throw new Error("Failed to update");

      await loadPhotos();
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update directory photo:", err);
      setError("Failed to update photo");
    }
  };

  const handleMoveUp = async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo || photo.position === 0) return;

    try {
      const res = await api.put(`/api/directory/${listing.id}/photos/${photoId}`, {
        position: photo.position - 1,
      });

      if (!res.ok) throw new Error("Failed to move photo");

      await loadPhotos();
      onUpdate?.();
    } catch (err) {
      console.error("Failed to move photo up:", err);
      setError("Failed to reorder photo");
    }
  };

  const handleMoveDown = async (photoId: string) => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo || photo.position === photos.length - 1) return;

    try {
      const res = await api.put(`/api/directory/${listing.id}/photos/${photoId}`, {
        position: photo.position + 1,
      });

      if (!res.ok) throw new Error("Failed to move photo");

      await loadPhotos();
      onUpdate?.();
    } catch (err) {
      console.error("Failed to move photo down:", err);
      setError("Failed to reorder photo");
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
          Photos ({photos.length}/10)
        </div>
        <label
          className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            photos.length >= 10 || uploading
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
            disabled={photos.length >= 10 || uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* URL Paste Input */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="url"
            placeholder="Or paste image URL: https://example.com/photo.jpg"
            value={pastedUrl}
            onChange={(e) => setPastedUrl(e.target.value)}
            disabled={photos.length >= 10 || uploading}
            className="w-full"
          />
        </div>
        <Button
          onClick={handleUploadFromUrl}
          disabled={!pastedUrl || photos.length >= 10 || uploading}
          variant="secondary"
          className="whitespace-nowrap"
        >
          {uploading ? "Uploading..." : "Upload from URL"}
        </Button>
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
                  alt={photo.alt || listing.businessProfile?.businessName || "Business photo"}
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
                {/* Position Controls */}
                <div className="flex gap-1">
                  <button
                    onClick={() => handleMoveUp(photo.id)}
                    disabled={photo.position === 0}
                    className="bg-white text-neutral-900 p-1 rounded text-xs hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveDown(photo.id)}
                    disabled={photo.position === photos.length - 1}
                    className="bg-white text-neutral-900 p-1 rounded text-xs hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

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
