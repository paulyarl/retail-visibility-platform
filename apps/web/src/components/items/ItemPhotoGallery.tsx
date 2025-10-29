"use client";

import { useState, useEffect } from "react";
import { Button, Input } from "@/components/ui";
import { api } from "@/lib/api";

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

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/items/${item.id}/photos`);
      const data = await res.json();
      setPhotos(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load photos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
  }, [item.id]);

  const compressImage = async (file: File, maxWidth = 1024, quality = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas_failed"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error("image_load_failed"));
      reader.onerror = () => reject(new Error("read_failed"));
      reader.readAsDataURL(file);
    });
  };

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

      const dataUrl = await compressImage(file);

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
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
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
