'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, Image as ImageIcon, Loader2, Upload } from 'lucide-react';

import directoryPresenceAdminService from '@/services/DirectoryPresenceAdminService';
import { getAcceptString, ImageUploadPresets, uploadImage } from '@/lib/image-upload';

interface SeedLogoUploadPanelProps {
  seedId: string;
  listing: { logoUrl?: string | null; business_name?: string | null } | null;
  canEdit?: boolean;
}

/**
 * SeedLogoUploadPanel — take the owner's logo on the walk-in and publish it.
 *
 * `uploadSeedLogo` writes BOTH `tenant_business_profiles_list.logo_url` and
 * `directory_listings_list.logo_url`, so this is the prospect's official logo
 * for every surface — the listing hero, the QR banner, the social/OG image —
 * and it survives the claim. There is no separate "seed logo".
 *
 * Note the QR designer's REPORT mode is a different thing: it keeps its logo in
 * modal state and never persists it. Only the banner mode goes through this
 * same write.
 *
 * Processing goes through the shared pipeline with `ImageUploadPresets.logo` —
 * medium compression, 5 MB cap, png/jpeg/svg/ico, and a roughly-square aspect
 * check (1:2–2:1) that catches a wordmark pasted into a square slot. The QR
 * designer's own upload uses a bare FileReader, so this panel is the stricter
 * path.
 */
export default function SeedLogoUploadPanel({
  seedId,
  listing,
  canEdit = true,
}: SeedLogoUploadPanelProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(listing?.logoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (fileInput.current) fileInput.current.value = '';
    if (!file) return;

    setError(null);
    setNotice(null);
    setUploading(true);
    try {
      const result = await uploadImage(file, ImageUploadPresets.logo);
      if (result.error) {
        setError(result.error.message);
        return;
      }

      const uploadedUrl = await directoryPresenceAdminService.uploadSeedLogo(
        seedId,
        result.dataUrl,
        result.contentType,
      );
      if (!uploadedUrl) throw new Error('The logo upload did not return a URL.');

      setLogoUrl(uploadedUrl);
      setNotice('Logo published to the listing.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Logo upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <ImageIcon className="w-5 h-5" /> Store logo
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          The owner&apos;s logo, published to the listing hero, the QR banner and the social preview.
          It stays with the listing after the claim.
        </p>
      </div>

      {!canEdit && (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
          Platform administrator access is required to change the logo.
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

      <div className="flex items-center gap-5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={listing?.business_name ? `${listing.business_name} logo` : 'Store logo'}
            className="w-20 h-20 rounded-xl object-cover border border-gray-200 bg-gray-50"
          />
        ) : (
          <div className="w-20 h-20 rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400 text-center px-1">
            No logo yet
          </div>
        )}

        {canEdit && (
          <div>
            <input
              ref={fileInput}
              type="file"
              accept={getAcceptString([...ImageUploadPresets.logo.allowedTypes])}
              className="hidden"
              onChange={(e) => onFile(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {logoUrl ? 'Replace logo' : 'Upload logo'}
            </button>
            <p className="text-xs text-gray-400 mt-2">
              PNG, JPEG, SVG or ICO · up to 5 MB · roughly square works best
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">Seed {seedId}</p>
    </section>
  );
}
