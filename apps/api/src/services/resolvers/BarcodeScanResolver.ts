/**
 * Barcode Scan Resolver
 *
 * Resolves effective barcode scan state from tier features + merchant preferences.
 */

import type {
  EffectiveBarcodeScan,
  BarcodeScanMerchantSettings,
} from './types';

export type BarcodeScanMode = 'scan' | 'manual' | 'usb' | 'camera' | 'none';

export function resolveBarcodeScan(
  features: Record<string, boolean>,
  merchantPrefs: BarcodeScanMerchantSettings | null
): EffectiveBarcodeScan {
  const disabled = !!features.barcode_disabled;
  const flexible = !!features.barcode_flexible;

  // R17: disabled > enabled > flexible > individual features
  const hasAnyBarcodeFeature = !!features.barcode_scan || !!features.barcode_manual || !!features.barcode_usb || !!features.barcode_camera;
  const enabled = !disabled && (!!features.barcode_enabled || flexible || hasAnyBarcodeFeature);

  const allowedModes: BarcodeScanMode[] = [];
  if (flexible || features.barcode_scan) allowedModes.push('scan');
  if (flexible || features.barcode_manual) allowedModes.push('manual');
  if (flexible || features.barcode_usb) allowedModes.push('usb');
  if (flexible || features.barcode_camera) allowedModes.push('camera');

  const uniqueModes = [...new Set(allowedModes)];

  const prefs = {
    barcode_scan_enabled: merchantPrefs?.barcode_scan_enabled !== false,
    barcode_manual_enabled: merchantPrefs?.barcode_manual_enabled !== false,
    barcode_usb_enabled: merchantPrefs?.barcode_usb_enabled !== false,
    barcode_camera_enabled: merchantPrefs?.barcode_camera_enabled !== false,
  };

  const effectiveModes = uniqueModes.filter((m) => {
    switch (m) {
      case 'scan': return prefs.barcode_scan_enabled;
      case 'manual': return prefs.barcode_manual_enabled;
      case 'usb': return prefs.barcode_usb_enabled;
      case 'camera': return prefs.barcode_camera_enabled;
      default: return true;
    }
  });

  return {
    enabled,
    allowed_modes: uniqueModes,
    effective_modes: effectiveModes,
    is_flexible: flexible,
    scan_available: enabled && uniqueModes.length > 0,
    effective_scan_available: enabled && effectiveModes.length > 0,
    merchant_preferences: prefs,
  };
}
