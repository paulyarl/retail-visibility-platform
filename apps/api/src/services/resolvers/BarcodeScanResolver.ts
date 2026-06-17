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
  const enabled = !!features.barcode_enabled;
  const flexible = !!features.barcode_flexible;
  const disabled = !!features.barcode_disabled;

  const allowedModes: BarcodeScanMode[] = [];
  if (features.barcode_scan) allowedModes.push('scan');
  if (features.barcode_manual) allowedModes.push('manual');
  if (features.barcode_usb) allowedModes.push('usb');
  if (features.barcode_camera) allowedModes.push('camera');

  if (flexible) {
    allowedModes.push('scan', 'manual', 'usb', 'camera');
  }

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
    enabled: enabled && !disabled,
    allowed_modes: disabled ? [] : uniqueModes,
    effective_modes: disabled ? [] : effectiveModes,
    is_flexible: flexible,
    scan_available: enabled && !disabled && uniqueModes.length > 0,
    effective_scan_available: enabled && !disabled && effectiveModes.length > 0,
    merchant_preferences: prefs,
  };
}
