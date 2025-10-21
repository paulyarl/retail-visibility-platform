import { z } from 'zod';

// E.164 phone number validation (international format)
const phoneRegex = /^\+[1-9]\d{1,14}$/;

// Email validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Website URL validation
const websiteRegex = /^https?:\/\/.+\..+/;

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
    .trim(),
  
  email: z.string()
    .regex(emailRegex, 'Please enter a valid email address')
    .toLowerCase()
    .trim(),
  
  website: z.string()
    .regex(websiteRegex, 'Website must be a valid URL (https://...)')
    .toLowerCase()
    .trim()
    .optional()
    .or(z.literal('')),
  
  contact_person: z.string()
    .max(100, 'Contact person name must be less than 100 characters')
    .trim()
    .optional()
    .or(z.literal('')),
  
  hours: z.record(z.string()).optional(),
  social_links: z.record(z.string()).optional(),
  seo_tags: z.array(z.string()).optional(),
});

export type BusinessProfile = z.infer<typeof businessProfileSchema>;

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
export const countries = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'CN', name: 'China', flag: '🇨🇳' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
];

// Helper to format phone number for display
export function formatPhoneNumber(phone: string): string {
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
    cleaned = '+' + cleaned;
  }
  
  return cleaned;
}
