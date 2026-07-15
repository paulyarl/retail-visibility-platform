/**
 * PrivateFeatureGrantDialog
 *
 * Admin dialog for creating grant token QR codes for private BSaaS features.
 * Admin selects a feature (filtered to catalog entries), optional tenant,
 * duration, max claims, and QR expiry. On generate, creates a signed grant
 * token and displays a styled QR code using the "private-grant" theme.
 *
 * Phase 4: QR Codes for Private Grants
 */

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { adminFeaturePurchasesService, type GrantTokenData } from '@/services/AdminFeaturePurchasesService';
import { adminBsaasCatalogService, type BsaasCatalogEntry } from '@/services/AdminBsaasCatalogService';
import { type BsaasBundleEntry } from '@/services/AdminBsaasBundleService';
import { adminOperationsService } from '@/services/AdminOperationsService';
import {
  QR_THEMES,
  QR_THEME_LIST,
  buildQROptions,
  type QRThemeName,
} from '@/lib/qr-style-config';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Input } from '@/components/ui/Input';
import { X, Download, Copy, Check, QrCode, Loader2, AlertCircle } from 'lucide-react';

interface PrivateFeatureGrantDialogProps {
  open: boolean;
  onClose: () => void;
  entries?: BsaasCatalogEntry[];
  bundles?: BsaasBundleEntry[];
}

export default function PrivateFeatureGrantDialog({ open, onClose, entries, bundles }: PrivateFeatureGrantDialogProps) {
  const [catalog, setCatalog] = useState<BsaasCatalogEntry[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [featureKey, setFeatureKey] = useState('');
  const [bundleKey, setBundleKey] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [maxClaims, setMaxClaims] = useState('1');
  const [qrExpiryHours, setQrExpiryHours] = useState('168');

  const [grantData, setGrantData] = useState<GrantTokenData | null>(null);
  const [bundleGrantData, setBundleGrantData] = useState<GrantTokenData[]>([]);
  const [selectedResultIdx, setSelectedResultIdx] = useState(0);
  const [selectedTheme, setSelectedTheme] = useState<QRThemeName>('private-grant');
  const [copied, setCopied] = useState<'url' | 'token' | null>(null);
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const qrInstanceRef = useRef<QRCodeStyling | null>(null);

  useEffect(() => {
    if (open) {
      if (!entries && !bundles) {
        adminBsaasCatalogService.list().then(setCatalog).catch(() => {});
      }
      adminOperationsService.getTenants(1, 500).then((result) => {
        setTenants(result.tenants.map((t) => ({ id: t.id, name: t.name })));
      }).catch(() => {});
    }
  }, [open]);

  const tenantOptions = useMemo(() =>
    tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.id})` })),
    [tenants],
  );

  const featureOptions = useMemo(() =>
    (entries ?? catalog).map((entry) => ({
      value: entry.feature_key,
      label: `${entry.marketing_name || entry.feature_key} (${entry.feature_key})`,
    })),
    [catalog, entries],
  );

  const bundleOptions = useMemo(() =>
    bundles?.map((bundle) => ({
      value: bundle.bundle_key,
      label: `${bundle.marketing_name} (${bundle.bsaas_bundle_items.length} components)`,
    })) ?? [],
    [bundles],
  );

  const resetForm = () => {
    setFeatureKey('');
    setBundleKey('');
    setTenantId('');
    setDurationDays('');
    setMaxClaims('1');
    setQrExpiryHours('168');
    setError(null);
    setGrantData(null);
    setBundleGrantData([]);
    setSelectedResultIdx(0);
  };

  const handleGenerate = async () => {
    if (bundles) {
      if (!bundleKey) {
        setError('Bundle is required');
        return;
      }
    } else {
      if (!featureKey) {
        setError('Feature is required');
        return;
      }
    }
    try {
      setLoading(true);
      setError(null);

      if (bundles && bundleKey) {
        const selectedBundle = bundles.find((b) => b.bundle_key === bundleKey);
        if (!selectedBundle) {
          setError('Selected bundle not found');
          return;
        }
        const results: GrantTokenData[] = [];
        for (const item of selectedBundle.bsaas_bundle_items) {
          const data = await adminFeaturePurchasesService.createGrantToken({
            feature_key: item.feature_key,
            tenant_id: tenantId || undefined,
            duration_days: durationDays ? parseInt(durationDays) : undefined,
            max_claims: parseInt(maxClaims) || 1,
            qr_expiry_hours: parseInt(qrExpiryHours) || 168,
          });
          results.push(data);
        }
        setBundleGrantData(results);
        setSelectedResultIdx(0);
      } else {
        const data = await adminFeaturePurchasesService.createGrantToken({
          feature_key: featureKey,
          tenant_id: tenantId || undefined,
          duration_days: durationDays ? parseInt(durationDays) : undefined,
          max_claims: parseInt(maxClaims) || 1,
          qr_expiry_hours: parseInt(qrExpiryHours) || 168,
        });
        setGrantData(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create grant token');
    } finally {
      setLoading(false);
    }
  };

  const activeGrantData = bundleGrantData.length > 0 ? bundleGrantData[selectedResultIdx] : grantData;

  useEffect(() => {
    if (!activeGrantData || !qrContainerRef.current) return;

    const theme = QR_THEMES[selectedTheme];
    const options = buildQROptions(
      activeGrantData.qr_url,
      activeGrantData.target_icon?.icon_name ? undefined : '/icons/visibleshelf-logo.svg',
      theme,
    );

    const qr = new QRCodeStyling(options);
    qrInstanceRef.current = qr;

    qrContainerRef.current.innerHTML = '';
    qr.append(qrContainerRef.current);

    return () => {
      if (qrContainerRef.current) {
        qrContainerRef.current.innerHTML = '';
      }
    };
  }, [activeGrantData, selectedTheme]);

  const handleDownload = (format: 'png' | 'svg') => {
    if (!qrInstanceRef.current || !activeGrantData) return;
    qrInstanceRef.current.download({ name: `grant-${activeGrantData.feature_key}`, extension: format });
  };

  const handleCopy = (text: string, type: 'url' | 'token') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-semibold">Create Grant QR Code</h3>
          </div>
          <button onClick={() => { resetForm(); onClose(); }} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {!activeGrantData && (
            <>
              <div>
                <label className="text-sm font-medium mb-1 block">{bundles ? 'Bundle *' : 'Feature *'}</label>
                {bundles ? (
                  <SearchableSelect
                    options={bundleOptions}
                    value={bundleKey}
                    onChange={setBundleKey}
                    placeholder="Select a bundle..."
                  />
                ) : (
                  <SearchableSelect
                    options={featureOptions}
                    value={featureKey}
                    onChange={setFeatureKey}
                    placeholder="Select a feature..."
                  />
                )}
                <p className="text-xs text-neutral-400 mt-1">
                  {bundles ? 'Grant QR will be created for each component feature in the bundle' : 'Feature must be in the BSaaS catalog'}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Tenant (optional)</label>
                <SearchableSelect
                  options={tenantOptions}
                  value={tenantId}
                  onChange={setTenantId}
                  placeholder="Any tenant (leave blank)"
                />
                <p className="text-xs text-neutral-400 mt-1">Leave blank to allow any tenant to redeem</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Duration (days)</label>
                  <Input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    placeholder="Permanent"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Max Claims</label>
                  <Input
                    type="number"
                    value={maxClaims}
                    onChange={(e) => setMaxClaims(e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">QR Expiry (hours)</label>
                <Input
                  type="number"
                  value={qrExpiryHours}
                  onChange={(e) => setQrExpiryHours(e.target.value)}
                  placeholder="168 (7 days)"
                />
                <p className="text-xs text-neutral-400 mt-1">How long the QR code remains valid</p>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || (bundles ? !bundleKey : !featureKey)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" />
                    Generate QR Code
                  </>
                )}
              </button>
            </>
          )}

          {activeGrantData && (
            <>
              {bundleGrantData.length > 1 && (
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1 block">Component ({selectedResultIdx + 1} of {bundleGrantData.length})</label>
                  <select
                    value={selectedResultIdx}
                    onChange={(e) => setSelectedResultIdx(parseInt(e.target.value))}
                    className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm"
                  >
                    {bundleGrantData.map((g, i) => (
                      <option key={i} value={i}>
                        {g.feature_name} ({g.feature_key})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-center">
                <div ref={qrContainerRef} className="rounded-lg overflow-hidden" />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">QR Theme</label>
                <div className="grid grid-cols-2 gap-2">
                  {QR_THEME_LIST.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTheme(t.name)}
                      className={`px-3 py-2 text-xs rounded-md border text-left ${
                        selectedTheme === t.name
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-medium">{t.label}</div>
                      <div className="text-neutral-400">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Feature</label>
                <code className="block px-3 py-2 text-sm font-mono bg-gray-50 rounded-md border border-gray-200">
                  {activeGrantData.feature_name} ({activeGrantData.feature_key})
                </code>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Grant URL</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 text-xs font-mono bg-gray-50 rounded-md border border-gray-200 truncate">
                    {activeGrantData.qr_url}
                  </code>
                  <button
                    onClick={() => handleCopy(activeGrantData.qr_url, 'url')}
                    className="p-2 rounded-md border border-gray-200 hover:bg-gray-50"
                    title="Copy URL"
                  >
                    {copied === 'url' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1 block">Grant Token</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 text-xs font-mono bg-gray-50 rounded-md border border-gray-200 truncate">
                    {activeGrantData.grant_token.substring(0, 40)}...
                  </code>
                  <button
                    onClick={() => handleCopy(activeGrantData.grant_token, 'token')}
                    className="p-2 rounded-md border border-gray-200 hover:bg-gray-50"
                    title="Copy token"
                  >
                    {copied === 'token' ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-md bg-purple-50 border border-purple-100 text-sm">
                <span className="text-xs font-medium text-neutral-600">Expires: </span>
                <span className="font-medium text-purple-700">
                  {new Date(activeGrantData.expires_at).toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>

        {activeGrantData && (
          <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end">
            <button
              onClick={() => handleDownload('png')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md bg-purple-600 text-white hover:bg-purple-700"
            >
              <Download className="w-4 h-4" />
              PNG
            </button>
            <button
              onClick={() => handleDownload('svg')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              SVG
            </button>
            <button
              onClick={() => { resetForm(); onClose(); }}
              className="px-3 py-2 text-sm rounded-md border border-gray-200 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
