/**
 * Supabase Storage Bucket Configuration
 * Centralized configuration for all storage buckets
 * 
 * Each bucket is a separate Supabase storage bucket, not a folder.
 * Bucket names are inferred from environment variables or use sensible defaults.
 */

export const StorageBuckets = {
  // Photos bucket - product/inventory images
  PHOTOS: {
    name: process.env.BUCKET_NAME || 'photos',
    isPublic: process.env.PUBLIC_FLAG?.toLowerCase() === 'true' || true,
  },
  
  // Tenants bucket - tenant branding assets (logos, etc.)
  TENANTS: {
    name: process.env.TENANT_BUCKET_NAME || 'tenants',
    isPublic: process.env.TENANT_PUBLIC_FLAG?.toLowerCase() === 'true' || true,
  },
  
  // Brands bucket - platform branding assets (platform logo, favicon, etc.)
  BRANDS: {
    name: process.env.BRAND_BUCKET_NAME || 'brands',
    isPublic: process.env.BRAND_PUBLIC_FLAG?.toLowerCase() === 'true' || true,
  },
} as const;

/**
 * Helper to extract path from URL
 * Example: https://.../storage/v1/object/public/photos/path/to/file.jpg -> path/to/file.jpg
 */
export function extractPathFromUrl(url: string, bucket: keyof typeof StorageBuckets): string | null {
  const config = StorageBuckets[bucket];
  const pattern = new RegExp(`/${config.name}/(.+)$`);
  const match = url.match(pattern);
  return match ? match[1] : null;
}
