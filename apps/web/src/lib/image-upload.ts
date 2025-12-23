/**
 * Centralized Image Upload Middleware
 * 
 * Handles all image uploads consistently across the platform:
 * - Product images
 * - Logos (tenant & platform)
 * - Banners
 * - Storefront images
 * - Favicons
 * 
 * Features:
 * - PNG transparency preservation
 * - SVG support (no compression)
 * - ICO file support (treated as PNG)
 * - Automatic format detection
 * - Configurable compression
 * - Aspect ratio validation
 * - File size validation
 */

export type CompressionLevel = 'low' | 'medium' | 'high';

export interface ImageUploadOptions {
  maxWidth?: number;           // Max width for compression (default: 1200)
  quality?: number;             // JPEG quality 0-1 (default: 0.85)
  compressionLevel?: CompressionLevel; // Preset compression level
  maxSizeMB?: number;          // Max file size in MB (default: 5)
  aspectRatio?: {              // Optional aspect ratio validation
    min?: number;              // Minimum ratio (width/height)
    max?: number;              // Maximum ratio (width/height)
    errorMessage?: string;     // Custom error message
  };
  allowedTypes?: ImageType[];  // Allowed image types (default: all)
}

export type ImageType = 'png' | 'jpeg' | 'svg' | 'ico' | 'webp' | 'gif';

export interface ImageUploadResult {
  dataUrl: string;             // Base64 data URL
  contentType: string;         // MIME type
  width: number;               // Image width
  height: number;              // Image height
  originalSize: number;        // Original file size in bytes
  compressedSize: number;      // Compressed size in bytes
  compressionRatio: number;    // Compression ratio (0-1)
}

export interface ImageValidationError {
  code: 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'ASPECT_RATIO' | 'LOAD_FAILED' | 'COMPRESSION_FAILED';
  message: string;
}

/**
 * Compression level presets
 * 
 * Note: Compression is INVERSE to quality, but consider VOLUME:
 * - LOW compression = HIGH quality (0.92) = LARGER files → Use for FEW images (platform logo)
 * - MEDIUM compression = MEDIUM quality (0.85) = MEDIUM files → Use for SOME images (tenant branding)
 * - HIGH compression = LOW quality (0.75) = SMALLER files → Use for MANY images (products)
 */
const COMPRESSION_PRESETS = {
  low: {
    maxWidth: 1920,
    quality: 0.92,
    description: 'Low compression - Highest quality, larger files (platform branding - only 1 image)',
  },
  medium: {
    maxWidth: 1200,
    quality: 0.85,
    description: 'Medium compression - Balanced quality and size (tenant branding - few images per tenant)',
  },
  high: {
    maxWidth: 800,
    quality: 0.75,
    description: 'High compression - Lower quality, smaller files (products - hundreds/thousands of images)',
  },
} as const;

/**
 * Apply compression level preset to options
 */
function applyCompressionLevel(options: ImageUploadOptions): ImageUploadOptions {
  if (!options.compressionLevel) {
    return options;
  }

  const preset = COMPRESSION_PRESETS[options.compressionLevel];
  
  return {
    ...options,
    // Apply preset values if not explicitly overridden
    maxWidth: options.maxWidth ?? preset.maxWidth,
    quality: options.quality ?? preset.quality,
  };
}

/**
 * Detect image type from file
 */
function detectImageType(file: File): ImageType | null {
  // Check MIME type first
  if (file.type === 'image/svg+xml') return 'svg';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/jpeg') return 'jpeg';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  if (file.type === 'image/x-icon' || file.type === 'image/vnd.microsoft.icon') return 'ico';
  
  // Fallback to file extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'svg') return 'svg';
  if (ext === 'png') return 'png';
  if (ext === 'jpg' || ext === 'jpeg') return 'jpeg';
  if (ext === 'webp') return 'webp';
  if (ext === 'gif') return 'gif';
  if (ext === 'ico') return 'ico';
  
  return null;
}

/**
 * Get content type for image type
 */
function getContentType(imageType: ImageType): string {
  switch (imageType) {
    case 'svg': return 'image/svg+xml';
    case 'png': return 'image/png';
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'ico': return 'image/png'; // Treat ICO as PNG
    default: return 'image/png';
  }
}

/**
 * Validate image file
 */
async function validateImage(
  file: File,
  options: ImageUploadOptions
): Promise<{ valid: true } | { valid: false; error: ImageValidationError }> {
  // Detect image type
  const imageType = detectImageType(file);
  if (!imageType) {
    return {
      valid: false,
      error: {
        code: 'INVALID_TYPE',
        message: 'Unsupported file type. Please upload PNG, JPEG, SVG, WebP, GIF, or ICO files.',
      },
    };
  }

  // Check if type is allowed
  const allowedTypes = options.allowedTypes || ['png', 'jpeg', 'svg', 'ico', 'webp', 'gif'];
  if (!allowedTypes.includes(imageType)) {
    return {
      valid: false,
      error: {
        code: 'INVALID_TYPE',
        message: `Only ${allowedTypes.join(', ').toUpperCase()} files are allowed.`,
      },
    };
  }

  // Check file size
  const maxSizeBytes = (options.maxSizeMB || 5) * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: `File size must be less than ${options.maxSizeMB || 5}MB.`,
      },
    };
  }

  // Validate aspect ratio (skip for SVG)
  if (options.aspectRatio && imageType !== 'svg') {
    try {
      const img = await loadImage(file);
      const ratio = img.width / img.height;
      
      if (options.aspectRatio.min && ratio < options.aspectRatio.min) {
        return {
          valid: false,
          error: {
            code: 'ASPECT_RATIO',
            message: options.aspectRatio.errorMessage || 
              `Image aspect ratio is too narrow (minimum ${options.aspectRatio.min}:1).`,
          },
        };
      }
      
      if (options.aspectRatio.max && ratio > options.aspectRatio.max) {
        return {
          valid: false,
          error: {
            code: 'ASPECT_RATIO',
            message: options.aspectRatio.errorMessage || 
              `Image aspect ratio is too wide (maximum ${options.aspectRatio.max}:1).`,
          },
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: {
          code: 'LOAD_FAILED',
          message: 'Failed to load image for validation.',
        },
      };
    }
  }

  return { valid: true };
}

/**
 * Load image from file
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

/**
 * Process SVG file (no compression, just convert to data URL)
 */
async function processSVG(file: File): Promise<ImageUploadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({
        dataUrl,
        contentType: 'image/svg+xml',
        width: 0, // SVG is vector, no fixed dimensions
        height: 0,
        originalSize: file.size,
        compressedSize: file.size, // No compression for SVG
        compressionRatio: 1,
      });
    };
    
    reader.onerror = () => reject(new Error('Failed to read SVG file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Compress raster image (PNG, JPEG, WebP, GIF, ICO)
 */
async function compressImage(
  file: File,
  imageType: ImageType,
  options: ImageUploadOptions
): Promise<ImageUploadResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Resize if needed
        const maxWidth = options.maxWidth || 1200;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Preserve transparency for PNG and ICO
        if (imageType === 'png' || imageType === 'ico') {
          ctx.clearRect(0, 0, width, height);
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Determine output format
        // ICO files are treated as PNG to preserve transparency
        const outputFormat = (imageType === 'png' || imageType === 'ico') 
          ? 'image/png' 
          : imageType === 'webp'
          ? 'image/webp'
          : 'image/jpeg';
        
        // PNG and WebP don't use quality parameter the same way
        const outputQuality = (imageType === 'png' || imageType === 'ico') 
          ? 1 
          : options.quality || 0.85;
        
        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            const compressedReader = new FileReader();
            compressedReader.onloadend = () => {
              const dataUrl = compressedReader.result as string;
              resolve({
                dataUrl,
                contentType: outputFormat,
                width,
                height,
                originalSize: file.size,
                compressedSize: blob.size,
                compressionRatio: blob.size / file.size,
              });
            };
            compressedReader.readAsDataURL(blob);
          },
          outputFormat,
          outputQuality
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Main upload function - validates and processes image
 */
export async function uploadImage(
  file: File,
  options: ImageUploadOptions = {}
): Promise<ImageUploadResult> {
  // Apply compression level preset if specified
  const processedOptions = applyCompressionLevel(options);
  
  // Validate image
  const validation = await validateImage(file, processedOptions);
  if (!validation.valid) {
    throw new Error(validation.error.message);
  }
  
  // Detect image type
  const imageType = detectImageType(file);
  if (!imageType) {
    throw new Error('Failed to detect image type');
  }
  
  // Process based on type
  if (imageType === 'svg') {
    return processSVG(file);
  } else {
    return compressImage(file, imageType, processedOptions);
  }
}

/**
 * Preset configurations for common use cases
 * 
 * Strategy based on IMAGE VOLUME:
 * - MANY images (products) → HIGH compression (smaller files)
 * - FEW images (platform) → LOW compression (high quality)
 * - SOME images (tenants) → MEDIUM compression (balanced)
 */
export const ImageUploadPresets = {
  /** Product images - HIGH compression (many images, need small files) */
  product: {
    compressionLevel: 'high' as CompressionLevel,
    maxSizeMB: 5,
    allowedTypes: ['png', 'jpeg', 'webp'] as ImageType[],
  },
  
  /** Logo - MEDIUM compression, supports transparency and SVG */
  logo: {
    compressionLevel: 'medium' as CompressionLevel,
    maxSizeMB: 5,
    aspectRatio: {
      min: 0.5,
      max: 2,
      errorMessage: 'Logo should be roughly square (aspect ratio between 1:2 and 2:1).',
    },
    allowedTypes: ['png', 'jpeg', 'svg', 'ico'] as ImageType[],
  },
  
  /** Banner - MEDIUM compression, wide landscape */
  banner: {
    compressionLevel: 'medium' as CompressionLevel,
    maxSizeMB: 5,
    aspectRatio: {
      min: 2,
      errorMessage: 'Banner should be wide/landscape (aspect ratio at least 2:1, e.g., 1200x400).',
    },
    allowedTypes: ['png', 'jpeg', 'webp'] as ImageType[],
  },
  
  /** Favicon - HIGH compression, small files */
  favicon: {
    compressionLevel: 'high' as CompressionLevel,
    maxSizeMB: 1,
    aspectRatio: {
      min: 0.9,
      max: 1.1,
      errorMessage: 'Favicon should be square.',
    },
    allowedTypes: ['png', 'ico', 'svg'] as ImageType[],
  },
  
  /** Storefront - MEDIUM compression (few hero images per tenant) */
  storefront: {
    compressionLevel: 'medium' as CompressionLevel,
    maxSizeMB: 10,
    allowedTypes: ['png', 'jpeg', 'webp', 'svg'] as ImageType[],
  },
  
  /** Avatar/Profile - HIGH compression (many users, small display) */
  avatar: {
    compressionLevel: 'high' as CompressionLevel,
    maxSizeMB: 2,
    aspectRatio: {
      min: 0.9,
      max: 1.1,
      errorMessage: 'Avatar should be square.',
    },
    allowedTypes: ['png', 'jpeg', 'webp'] as ImageType[],
  },
  
  /** Platform branding - LOW compression (only 1 logo, can afford quality) */
  platformBranding: {
    compressionLevel: 'low' as CompressionLevel,
    maxSizeMB: 3,
    allowedTypes: ['png', 'jpeg', 'svg', 'ico'] as ImageType[],
  },
  
  /** Tenant branding - MEDIUM compression (few images per tenant) */
  tenantBranding: {
    compressionLevel: 'medium' as CompressionLevel,
    maxSizeMB: 5,
    allowedTypes: ['png', 'jpeg', 'svg', 'ico'] as ImageType[],
  },
  
  /** Directory photos - MEDIUM compression (fewer photos per listing, showcase quality) */
  directory: {
    compressionLevel: 'medium' as CompressionLevel,
    maxSizeMB: 8,
    allowedTypes: ['png', 'jpeg', 'webp'] as ImageType[],
  },
} as const;

/**
 * Helper function to get accepted file types string for input element
 */
export function getAcceptString(types: ImageType[]): string {
  const mimeTypes: Record<ImageType, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  
  return types.map(t => mimeTypes[t]).join(',') + ',.ico'; // Add .ico extension for better compatibility
}
