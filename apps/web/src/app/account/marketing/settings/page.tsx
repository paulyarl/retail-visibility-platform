'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Save, Check } from 'lucide-react';
import marketingCustomerService, { CustomerBranding } from '@/services/MarketingCustomerService';

export default function BrandingSettingsPage() {
  const [branding, setBranding] = useState<CustomerBranding>({
    logoUrl: null,
    assetUrl: null,
    brandColor: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Form state
  const [logoUrl, setLogoUrl] = useState('');
  const [assetUrl, setAssetUrl] = useState('');
  const [brandColor, setBrandColor] = useState('#2563eb');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await marketingCustomerService.getBranding();
        setBranding(data);
        setLogoUrl(data.logoUrl || '');
        setAssetUrl(data.assetUrl || '');
        setBrandColor(data.brandColor || '#2563eb');
      } catch (err: any) {
        setError(err.message || 'Failed to load branding');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await marketingCustomerService.updateBranding({
        logoUrl: logoUrl || null,
        assetUrl: assetUrl || null,
        brandColor: brandColor || null,
      });
      setBranding(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/account/marketing" className="text-gray-400 hover:text-gray-600 flex items-center gap-2">
        <ArrowLeft className="w-5 h-5" /> Back to My Services
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Branding & QR Settings</h1>
        <p className="text-gray-500 mt-1">Customize how your receipts and QR codes look</p>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        {/* Logo URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://example.com/logo.png"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Appears centered on your receipt QR codes. PNG/JPG/SVG, max 2MB.</p>
          {logoUrl && (
            <div className="mt-2 flex items-center gap-2">
              <img src={logoUrl} alt="Logo preview" className="w-12 h-12 rounded border border-gray-200 object-contain" />
              <span className="text-xs text-gray-500">Preview</span>
            </div>
          )}
        </div>

        {/* Asset URL (QR destination) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">QR Destination URL</label>
          <input
            type="url"
            value={assetUrl}
            onChange={(e) => setAssetUrl(e.target.value)}
            placeholder="https://yourbusiness.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Where your receipt QR code scans to. Falls back to your campaign's website URL if not set.
            Must be http(s).
          </p>
        </div>

        {/* Brand color */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              placeholder="#2563eb"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Applied to QR code dots and corners. Must have sufficient contrast for scannability.</p>
        </div>

        {/* QR Preview */}
        {(assetUrl || logoUrl) && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">QR Preview</h3>
            <div className="inline-block p-4 bg-white border border-gray-200 rounded-lg">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=${(brandColor || '#2563eb').replace('#', '')}&data=${encodeURIComponent(assetUrl || 'https://example.com')}`}
                alt="QR preview"
                className="w-36 h-36"
              />
            </div>
            {logoUrl && (
              <div className="mt-2 flex items-center gap-2">
                <img src={logoUrl} alt="Logo overlay" className="w-8 h-8 rounded object-contain" />
                <span className="text-xs text-gray-500">Logo will be composited centered on the QR</span>
              </div>
            )}
          </div>
        )}

        {/* Error / success */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
        )}
        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> Branding saved successfully
          </div>
        )}

        {/* Save button */}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? (
            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</>
          ) : (
            <><Save className="w-4 h-4" /> Save Branding</>
          )}
        </button>
      </form>
    </div>
  );
}
