import { z } from 'zod';

// E.164 phone number validation (international format)
const phoneRegex = /^\+[1-9]\d{1,14}$/;

// Email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Website URL validation (HTTPS required to match backend)
const websiteRegex = /^https:\/\/.+\..+/;

// Coordinates arrive as strings from the API (Postgres Decimal columns serialize
// to strings), so coerce numeric strings and treat blank values as absent.
const coordinateSchema = (min: number, max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? (v.trim() === '' ? undefined : Number(v)) : v),
    z.number().min(min).max(max).optional().nullable()
  );

export const businessProfileSchema = z.object({
  business_name: z.string()
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name must be less than 100 characters')
    .trim(),
  
  address_line1: z.string()
    .min(5, 'Address must be at least 5 characters')
    .max(200, 'Address must be less than 200 characters')
    .trim(),
  
  address_line2: z.string()
    .max(200, 'Address line 2 must be less than 200 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  
  city: z.string()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City must be less than 100 characters')
    .trim(),
  
  state: z.string()
    .max(100, 'State must be less than 100 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  
  postal_code: z.string()
    .min(3, 'Postal code must be at least 3 characters')
    .max(20, 'Postal code must be less than 20 characters')
    .trim(),
  
  country_code: z.string()
    .length(2, 'Country code must be 2 characters (ISO 3166)')
    .toUpperCase(),
  
  phone_number: z.string()
    .regex(phoneRegex, 'Phone must be in E.164 format (e.g., +1 234 567 8900)')
    .trim()
    .optional()
    .or(z.literal('')),
  
  email: z.string()
    .regex(emailRegex, 'Please enter a valid email address')
    .toLowerCase()
    .trim()
    .optional()
    .or(z.literal('')),
  
  website: z.string()
    .regex(websiteRegex, 'Website must use HTTPS (e.g., https://www.example.com)')
    .toLowerCase()
    .trim()
    .optional()
    .or(z.literal('')),
  
  contact_person: z.string()
    .min(2, 'Contact person name must be at least 2 characters')
    .max(100, 'Contact person name must be less than 100 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  
  admin_email: z.string()
    .regex(emailRegex, 'Please enter a valid admin email address')
    .toLowerCase()
    .trim()
    .optional()
    .or(z.literal('')),
  
  logo_url: z.string()
    .trim()
    .refine((val) => val === '' || val.startsWith('http'), 'Logo must be a valid URL')
    .optional()
    .or(z.null().transform(() => ''))
    .or(z.literal('')),
  
  business_description: z.string()
    .max(1000, 'Business description must be less than 1000 characters')
    .trim()
    .optional()
    .or(z.null().transform(() => ''))
    .or(z.literal('')),
  
  hours: z.record(z.string(), z.string()).optional().nullable(),
  social_links: z.record(z.string(), z.string()).optional().nullable(),
  seo_tags: z.array(z.string()).optional().nullable(),
  
  // Geocoding fields for map display
  latitude: coordinateSchema(-90, 90),
  longitude: coordinateSchema(-180, 180),
  
  // Slug field for URL customization
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug must be less than 100 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens only')
    .optional(),
});

export type BusinessProfile = {
  business_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country_code: string;
  phone_number?: string;
  email?: string;
  website?: string;
  contact_person?: string;
  admin_email?: string;
  logo_url?: string;
  banner_url?: string;
  business_description?: string;
  hours?: Record<string, string> | null;
  social_links?: Record<string, string> | null;
  seo_tags?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  slug?: string;
  tenant_id?: string;
  hasFeaturedProducts?: boolean;
  hasPublishedDirectory?: boolean;
};

// Onboarding schema - only validates fields shown on the StoreIdentityStep form
// This excludes optional fields like logo_url, business_description that may be null
export const onboardingProfileSchema = z.object({
  business_name: z.string()
    .min(2, 'Business name must be at least 2 characters')
    .max(100, 'Business name must be less than 100 characters')
    .trim(),
  
  address_line1: z.string({ message: 'Address is required' })
    .min(5, 'Address must be at least 5 characters')
    .max(200, 'Address must be less than 200 characters')
    .trim(),
  
  address_line2: z.string({ message: 'Address line 2 must be a string' })
    .max(200, 'Address line 2 must be less than 200 characters')
    .trim()
    .optional()
    .nullable()
    .transform(val => val ?? ''),
  
  city: z.string({ message: 'City is required' })
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City must be less than 100 characters')
    .trim(),
  
  state: z.string({ message: 'State must be a string' })
    .max(100, 'State must be less than 100 characters')
    .trim()
    .optional()
    .nullable()
    .transform(val => val ?? ''),
  
  postal_code: z.string({ message: 'Postal code is required' })
    .min(3, 'Postal code must be at least 3 characters')
    .max(20, 'Postal code must be less than 20 characters')
    .trim(),
  
  country_code: z.string({ message: 'Country is required' })
    .length(2, 'Country code must be 2 characters (ISO 3166)')
    .toUpperCase(),
  
  phone_number: z.string({ message: 'Phone number is required' })
    .min(1, 'Phone number is required')
    .trim(),
  
  email: z.string({ message: 'Email must be a string' })
    .refine((val) => !val || emailRegex.test(val), 'Please enter a valid email address')
    .toLowerCase()
    .trim()
    .optional()
    .nullable()
    .transform(val => val ?? ''),
  
  website: z.string({ message: 'Website must be a string' })
    .refine((val) => !val || websiteRegex.test(val), 'Website must use HTTPS (e.g., https://www.example.com)')
    .toLowerCase()
    .trim()
    .optional()
    .nullable()
    .transform(val => val ?? ''),
  
  contact_person: z.string({ message: 'Contact person must be a string' })
    .min(2, 'Contact person name must be at least 2 characters')
    .max(100, 'Contact person name must be less than 100 characters')
    .trim()
    .optional()
    .nullable()
    .transform(val => val ?? ''),
  
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug must be less than 100 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens only')
    .optional(),
  
  // Map coordinates - required for proper business location display
  latitude: z.number({ message: 'Latitude is required - click "Get Coordinates" to populate' }),
  
  longitude: z.number({ message: 'Longitude is required - click "Get Coordinates" to populate' }),
});

import { externalApiService } from '@/services/ExternalApiService';
import { clientLogger } from '@/lib/client-logger';

// Helper to geocode an address using Google Geocoding API
export async function geocodeAddress(address: {
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country_code: string;
}): Promise<{ latitude: number; longitude: number } | null> {
  try {
    return await externalApiService.geocodeAddress(address);
  } catch (error) {
    clientLogger.error('[BusinessProfile] Failed to geocode address:', { detail: error });
    return null;
  }
}

// Partial schema for updates (all fields optional)
export const businessProfileUpdateSchema = businessProfileSchema.partial();

// Profile readiness scoring (0-100).
//
// Three tiers, so a missing trust field (above all the logo) actually moves the
// number instead of hiding behind a flat field count:
//   required 60 — the NAP block every listing needs
//   trust    25 — the visual/brand proof a shopper judges (logo, website, copy, map pin)
//   enrich   15 — the nice-to-haves
// `isSEOReady` additionally gates on every required + trust field, so a profile
// can't read as "SEO Ready" while it has no logo.
const REQUIRED_PROFILE_FIELDS = [
  'business_name',
  'address_line1',
  'city',
  'postal_code',
  'country_code',
  'phone_number',
  'email',
] as const;

const TRUST_PROFILE_FIELDS = [
  'logo_url',
  'website',
  'business_description',
  'geocode',
] as const;

const ENRICHMENT_PROFILE_FIELDS = [
  'contact_person',
  'social_links',
  'hours',
  'seo_tags',
] as const;

const FIELD_LABELS: Record<string, string> = {
  business_name: 'Business name',
  address_line1: 'Address',
  city: 'City',
  postal_code: 'Postal code',
  country_code: 'Country',
  phone_number: 'Phone number',
  email: 'Email',
  logo_url: 'Logo',
  website: 'Website',
  business_description: 'Description',
  geocode: 'Map coordinates',
  contact_person: 'Contact person',
  social_links: 'Social links',
  hours: 'Business hours',
  seo_tags: 'SEO tags',
};

// Treats 0 as present (a longitude of 0 is valid) and objects/arrays as present
// only when they hold something.
function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}

function isFieldPresent(profile: Partial<BusinessProfile>, field: string): boolean {
  if (field === 'geocode') {
    const { latitude, longitude } = profile;
    return latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;
  }
  return hasValue(profile[field as keyof BusinessProfile]);
}

function tierScore(profile: Partial<BusinessProfile>, fields: readonly string[], weight: number): number {
  const completed = fields.filter((field) => isFieldPresent(profile, field)).length;
  return (completed / fields.length) * weight;
}

// Helper to calculate profile/SEO readiness score (0-100)
export function calculateSEOReadiness(profile: Partial<BusinessProfile>): number {
  const score =
    tierScore(profile, REQUIRED_PROFILE_FIELDS, 60) +
    tierScore(profile, TRUST_PROFILE_FIELDS, 25) +
    tierScore(profile, ENRICHMENT_PROFILE_FIELDS, 15);
  return Math.round(score);
}

// Human-readable fields that still block "SEO Ready" — the card shows these so a
// missing logo is called out by name instead of a generic "complete all fields".
export function getMissingProfileFields(profile: Partial<BusinessProfile>): string[] {
  return [...REQUIRED_PROFILE_FIELDS, ...TRUST_PROFILE_FIELDS]
    .filter((field) => !isFieldPresent(profile, field))
    .map((field) => FIELD_LABELS[field]);
}

// Enrichment fields that are still empty. They don't block "SEO Ready" but they
// are the remainder of the percentage, so the card names them instead of leaving
// a bare "93%" with no way to close the gap.
export function getOptionalProfileFields(profile: Partial<BusinessProfile>): string[] {
  return ENRICHMENT_PROFILE_FIELDS
    .filter((field) => !isFieldPresent(profile, field))
    .map((field) => FIELD_LABELS[field]);
}

// Helper to check if profile is complete for SEO
export function isSEOReady(profile: Partial<BusinessProfile>): boolean {
  return getMissingProfileFields(profile).length === 0 && calculateSEOReadiness(profile) >= 85;
}

// Country list with codes (ISO 3166-1 alpha-2)
// Based on Google Merchant Center & Google Maps availability for SWIS/Local Inventory Ads
// Source: https://support.google.com/merchants/answer/160637
export const countries = [
  // North America (2) - Full GMC + Local Inventory Ads support
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  
  // Western Europe (17) - Full GMC + Local Inventory Ads support
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'IS', name: 'Iceland', flag: '🇮🇸' },
  
  // Central & Eastern Europe (5) - GMC support
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰' },
  
  // Asia-Pacific (7) - GMC + Local Inventory Ads support
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼' },
  
  // Latin America (4) - GMC support
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  
  // Middle East & Africa (4) - GMC support
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  
  // South Korea (1) - Special GMC support
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
];

// Helper to format phone number for display
export function formatPhoneNumber(phone: string | null | undefined): string {
  // Handle null/undefined
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it starts with +1 (US/Canada), format as +1 (XXX) XXX-XXXX
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    return `+1 (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
  }
  
  // Otherwise return as-is
  return cleaned;
}

// Helper to normalize phone input
export function normalizePhoneInput(input: string): string {
  // Remove all non-digit characters except +
  let cleaned = input.replace(/[^\d+]/g, '');
  
  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    // If it looks like a US number (10 digits), add +1 prefix
    if (cleaned.length === 10 && /^[2-9]/.test(cleaned)) {
      cleaned = '+1' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  
  console.log('[normalizePhoneInput] Input:', input, '-> Output:', cleaned);
  return cleaned;
}
