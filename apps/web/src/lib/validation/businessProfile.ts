import { z } from 'zod';

// E.164 phone number validation (international format)
const phoneRegex = /^\+[1-9]\d{1,14}$/;

// Email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Website URL validation (HTTPS required to match backend)
const websiteRegex = /^https:\/\/.+\..+/;

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
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  
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
  business_description?: string;
  hours?: Record<string, string> | null;
  social_links?: Record<string, string> | null;
  seo_tags?: string[] | null;
  latitude?: number | null;
  longitude?: number | null;
  slug?: string;
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
});

import { externalApiService } from '@/services/ExternalApiService';

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
    console.error('[BusinessProfile] Failed to geocode address:', error);
    return null;
  }
}

// Partial schema for updates (all fields optional)
export const businessProfileUpdateSchema = businessProfileSchema.partial();

// Helper to calculate SEO readiness score (0-100)
export function calculateSEOReadiness(profile: Partial<BusinessProfile>): number {
  const requiredFields = [
    'business_name',
    'address_line1',
    'city',
    'postal_code',
    'country_code',
    'phone_number',
    'email',
  ];
  
  const optionalFields = [
    'website',
    'contact_person',
    'social_links',
  ];
  
  let score = 0;
  const requiredWeight = 70; // 70% for required fields
  const optionalWeight = 30; // 30% for optional fields
  
  // Check required fields (70 points)
  const completedRequired = requiredFields.filter(field => {
    const value = profile[field as keyof BusinessProfile];
    return value && value !== '';
  }).length;
  score += (completedRequired / requiredFields.length) * requiredWeight;
  
  // Check optional fields (30 points)
  const completedOptional = optionalFields.filter(field => {
    const value = profile[field as keyof BusinessProfile];
    if (field === 'social_links') {
      return value && typeof value === 'object' && Object.keys(value).length > 0;
    }
    return value && value !== '';
  }).length;
  score += (completedOptional / optionalFields.length) * optionalWeight;
  
  return Math.round(score);
}

// Helper to check if profile is complete for SEO
export function isSEOReady(profile: Partial<BusinessProfile>): boolean {
  return calculateSEOReadiness(profile) >= 85;
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
