'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, Trash2, Upload } from 'lucide-react';

import directoryPresenceAdminService, {
  type DirectoryListingPhoto,
} from '@/services/DirectoryPresenceAdminService';
import { uploadImage, ImageUploadPresets } from '@/lib/image-upload';
import { clientLogger } from '@/lib/client-logger';

/** directory_photos caps at 10 per listing — enforced server-side too. */
export const MAX_SEED_PHOTOS = 10;

export interface PendingSeedPhoto {
  id: string;
  fileName: string;
  dataUrl: string;
  contentType: string;
  width: number;
  height: number;
  caption: string;
  alt: string;
  /** The owner approved THIS shot for the public listing. Required to publish. */
  approved: boolean;
}

/**
 * Why an upload cannot proceed, or null when it can.
 *
 * Pure so the rules are unit-testable without a DOM. Two of them are the
 * non-negotiables from the capture workflow: nothing is published that the
 * owner has not seen and approved, and the listing is capped at
 * MAX_SEED_PHOTOS rows in total (uploading does not replace — deleting is the
 * only way to make room).
 */
export function seedPhotoUploadBlocker(
  pending: PendingSeedPhoto[],
  existingCount: number,
  max: number = MAX_SEED_PHOTOS
): string | null {
  if (pending.length === 0) return 'Add at least one photo.';

  if (existingCount + pending.length > max) {
    return `This listing already has ${existingCount} of ${max} photos. Delete some first, or add fewer.`;
  }

  const unapproved = pending.filter((p) => !p.approved).length;
  if (unapproved > 0) {
    return unapproved === 1
      ? 'One photo still needs the owner\u2019s approval.'
      : `${unapproved} photos still need the owner\u2019s approval.`;
  }

  return null;
}

interface SeedPhotoCapturePanelProps {
  seedId: string;
  /** The seed's directory listing row. id or slug both resolve the photos API. */
  listing: { id?: string | null; slug?: string | null; business_name?: string | null } | null;
  canEdit?: boolean;
}

/**
 * SeedPhotoCapturePanel — walk-in photo capture for an unclaimed seed.
 *
 * Operator-authored content, not a tenant entitlement, so it is exempt from the
 * tier gate that would otherwise hide the gallery (see
 * apps/web/src/lib/place-photo-gallery.ts).
 *
 * Captured shots are published in the order they are uploaded: position 0 is
 * the one the public gallery badges "Primary Photo" and shows first, so the
 * hero shot goes first. Captions render under the carousel image; alt is the
 * only text that reaches non-JS consumers, so both are worth filling.
 *
 * Image processing goes through the shared lib/image-upload pipeline with
 * ImageUploadPresets.directory — the same path the tenant directory gallery
 * uses — so seed photos land on the established storage profile (medium:
 * maxWidth 1200, quality 0.85) rather than a bespoke encoder.
 */
export default function SeedPhotoCapturePanel({
  seedId,
  listing,
  canEdit = true,
}: SeedPhotoCapturePanelProps) {
  const listingId = listing?.id || listing?.slug || null;

  const [photos, setPhotos] = useState<DirectoryListingPhoto[]>([]);
  const [pending, setPending] = useState<PendingSeedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!listingId) return;
    try {
      setPhotos(await directoryPresenceAdminService.listSeedListingPhotos(listingId));
    } catch (e) {
      clientLogger.error('[SeedPhotoCapture] load failed', { detail: e });
    }
  }, [listingId]);

  useEffect(() => {
    load();
  }, [load]);

  const blocker = seedPhotoUploadBlocker(pending, photos.length);

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setNotice(null);

    const next: PendingSeedPhoto[] = [];
    for (const file of Array.from(files)) {
      // Shared pipeline — the same one the tenant directory gallery uses.
      // ImageUploadPresets.directory encodes to dimensions to control storage
      // (medium: maxWidth 1200, quality 0.85, 8 MB input cap), and re-encoding
      // through a canvas is what drops EXIF, so the stored exif_removed flag
      // stays true.
      const result = await uploadImage(file, ImageUploadPresets.directory);

      if (result.error) {
        setError(result.error.message);
        continue;
      }

      next.push({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        dataUrl: result.dataUrl,
        contentType: result.contentType,
        width: result.width,
        height: result.height,
        caption: '',
        alt: '',
        approved: false,
      });
    }

    if (next.length > 0) setPending((prev) => [...prev, ...next]);
    if (fileInput.current) fileInput.current.value = '';
  }

  function patchPending(id: string, patch: Partial<PendingSeedPhoto>) {
    setPending((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  async function upload() {
    if (!listingId || blocker) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    const uploaded: string[] = [];
    try {
      // Sequential, in list order — the server assigns position by arrival, and
      // the first row becomes the gallery's Primary Photo.
      for (const p of pending) {
        await directoryPresenceAdminService.uploadSeedListingPhoto(listingId, {
          dataUrl: p.dataUrl,
          contentType: p.contentType,
          caption: p.caption.trim() || null,
          alt: p.alt.trim() || null,
          width: p.width,
          height: p.height,
        });
        uploaded.push(p.id);
      }
      setPending((prev) => prev.filter((p) => !uploaded.includes(p.id)));
      setNotice(`${uploaded.length} photo${uploaded.length === 1 ? '' : 's'} published to the seed.`);
      await load();
    } catch (e) {
      // Drop only what actually landed, so a mid-run failure does not make the
      // operator re-approve shots that are already public.
      setPending((prev) => prev.filter((p) => !uploaded.includes(p.id)));
      setError(e instanceof Error ? e.message : 'Upload failed.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(photoId: string) {
    if (!listingId) return;
    setBusy(true);
    setError(null);
    try {
      await directoryPresenceAdminService.deleteSeedListingPhoto(listingId, photoId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  const remaining = Math.max(0, MAX_SEED_PHOTOS - photos.length - pending.length);

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Camera className="w-5 h-5" /> Store photos
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Shot on the walk-in. Nothing is published until the owner has seen it and approved it.
          </p>
        </div>
        <span className="text-sm text-gray-500 whitespace-nowrap">
          {photos.length} of {MAX_SEED_PHOTOS}
        </span>
      </div>

      {!listingId && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          This seed has no directory listing row yet, so photos cannot be attached. Publish the seed first.
        </p>
      )}

      {!canEdit && (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
          Platform administrator access is required to change seed photos.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
      )}
      {notice && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notice}
        </p>
      )}

      {/* Already published */}
      {photos.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">On the seed now</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...photos]
              .sort((a, b) => a.position - b.position)
              .map((photo) => (
                <div key={photo.id} className="relative rounded-lg overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.alt || ''} className="w-full aspect-square object-cover" />
                  {photo.position === 0 && (
                    <span className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                      Primary
                    </span>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => remove(photo.id)}
                      disabled={busy}
                      aria-label="Delete photo"
                      className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-full p-1.5 shadow disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  )}
                  {photo.caption && (
                    <p className="text-xs text-gray-600 px-2 py-1 truncate">{photo.caption}</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Capture */}
      {canEdit && (
        <div className="space-y-4">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy || !listingId || remaining === 0}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Camera className="w-4 h-4" /> Take or choose photos
          </button>
          <span className="text-sm text-gray-500 ml-3">{remaining} slot{remaining === 1 ? '' : 's'} left</span>

          {pending.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700">Ready to publish</h3>
              {pending.map((p) => (
                <div key={p.id} className="flex gap-3 border border-gray-200 rounded-lg p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.dataUrl}
                    alt=""
                    className="w-24 h-24 object-cover rounded-md border border-gray-200 flex-shrink-0"
                  />
                  <div className="flex-1 space-y-2">
                    <p className="text-xs text-gray-400 truncate">{p.fileName}</p>
                    <input
                      value={p.caption}
                      onChange={(e) => patchPending(p.id, { caption: e.target.value })}
                      placeholder="Caption shown under the photo (e.g. Storefront on W Washington St)"
                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                    />
                    <input
                      value={p.alt}
                      onChange={(e) => patchPending(p.id, { alt: e.target.value })}
                      placeholder="Alt text (e.g. Shelves of teff flour and berbere)"
                      className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5"
                    />
                    <label className="flex items-start gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={p.approved}
                        onChange={(e) => patchPending(p.id, { approved: e.target.checked })}
                        className="mt-0.5"
                      />
                      <span>The owner approved this photo for the public listing.</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPending((prev) => prev.filter((x) => x.id !== p.id))}
                    className="self-start text-sm text-gray-500 hover:text-gray-700"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={upload}
                  disabled={busy || !!blocker || !listingId}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Publish {pending.length} photo{pending.length === 1 ? '' : 's'}
                </button>
                {blocker && <span className="text-sm text-gray-500">{blocker}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Seed {seedId} · photos render in upload order; the first is badged Primary.
      </p>
    </section>
  );
}
