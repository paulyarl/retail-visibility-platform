# Image Upload Middleware

Centralized image upload handling for consistent behavior across the entire platform.

## Features

- ✅ **PNG Transparency** - Preserves transparency in PNG files
- ✅ **SVG Support** - Native SVG support without compression
- ✅ **ICO Support** - Treats `.ico` files as PNG with transparency
- ✅ **WebP Support** - Modern image format support
- ✅ **GIF Support** - Animated GIF support
- ✅ **Automatic Compression** - Smart compression based on file type
- ✅ **Aspect Ratio Validation** - Configurable aspect ratio constraints
- ✅ **File Size Validation** - Configurable size limits
- ✅ **Type Safety** - Full TypeScript support

## Usage

### Basic Usage

```typescript
import { uploadImage } from '@/lib/image-upload';

const handleFileUpload = async (file: File) => {
  try {
    const result = await uploadImage(file);
    
    console.log('Data URL:', result.dataUrl);
    console.log('Content Type:', result.contentType);
    console.log('Dimensions:', result.width, 'x', result.height);
    console.log('Compression:', Math.round((1 - result.compressionRatio) * 100) + '%');
    
    // Upload to server
    await fetch('/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        dataUrl: result.dataUrl,
        contentType: result.contentType,
      }),
    });
  } catch (error) {
    console.error('Upload failed:', error.message);
  }
};
```

### Using Presets

```typescript
import { uploadImage, ImageUploadPresets } from '@/lib/image-upload';

// Logo upload (square-ish, supports PNG/JPEG/SVG/ICO)
const handleLogoUpload = async (file: File) => {
  const result = await uploadImage(file, ImageUploadPresets.logo);
  // ...
};

// Banner upload (wide landscape, PNG/JPEG/WebP)
const handleBannerUpload = async (file: File) => {
  const result = await uploadImage(file, ImageUploadPresets.banner);
  // ...
};

// Product image (high quality, flexible)
const handleProductUpload = async (file: File) => {
  const result = await uploadImage(file, ImageUploadPresets.product);
  // ...
};

// Favicon (small, square, PNG/ICO/SVG)
const handleFaviconUpload = async (file: File) => {
  const result = await uploadImage(file, ImageUploadPresets.favicon);
  // ...
};
```

### Custom Configuration

```typescript
import { uploadImage } from '@/lib/image-upload';

const result = await uploadImage(file, {
  maxWidth: 1920,
  quality: 0.9,
  maxSizeMB: 10,
  aspectRatio: {
    min: 1.5,
    max: 2.5,
    errorMessage: 'Image must be landscape (1.5:1 to 2.5:1)',
  },
  allowedTypes: ['png', 'jpeg', 'webp', 'svg'],
});
```

### File Input Accept Attribute

```typescript
import { getAcceptString, ImageUploadPresets } from '@/lib/image-upload';

// Get accept string for file input
const acceptTypes = getAcceptString(ImageUploadPresets.logo.allowedTypes);

<input 
  type="file" 
  accept={acceptTypes}
  onChange={handleFileChange}
/>
```

## Available Presets

### `ImageUploadPresets.product`
- **Use:** Product images
- **Max Width:** 1200px
- **Quality:** 0.9 (high)
- **Max Size:** 5MB
- **Types:** PNG, JPEG, WebP
- **Aspect Ratio:** Any

### `ImageUploadPresets.logo`
- **Use:** Logos (tenant & platform)
- **Max Width:** 800px
- **Quality:** 0.85
- **Max Size:** 5MB
- **Types:** PNG, JPEG, SVG, ICO
- **Aspect Ratio:** 0.5:1 to 2:1 (roughly square)

### `ImageUploadPresets.banner`
- **Use:** Banner images
- **Max Width:** 1920px
- **Quality:** 0.85
- **Max Size:** 5MB
- **Types:** PNG, JPEG, WebP
- **Aspect Ratio:** Minimum 2:1 (landscape)

### `ImageUploadPresets.favicon`
- **Use:** Favicons
- **Max Width:** 512px
- **Quality:** 1.0 (lossless)
- **Max Size:** 1MB
- **Types:** PNG, ICO, SVG
- **Aspect Ratio:** 0.9:1 to 1.1:1 (square)

### `ImageUploadPresets.storefront`
- **Use:** Storefront images
- **Max Width:** 1920px
- **Quality:** 0.9
- **Max Size:** 10MB
- **Types:** PNG, JPEG, WebP, SVG
- **Aspect Ratio:** Any

### `ImageUploadPresets.avatar`
- **Use:** User avatars/profiles
- **Max Width:** 400px
- **Quality:** 0.85
- **Max Size:** 2MB
- **Types:** PNG, JPEG, WebP
- **Aspect Ratio:** 0.9:1 to 1.1:1 (square)

## Migration Guide

### Before (Old Code)

```typescript
// Old: Custom compression function in each component
const compressImage = async (file: File) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // ... 50+ lines of canvas manipulation
      canvas.toBlob((blob) => {
        // ... more code
      }, 'image/jpeg', 0.85);
    };
    
    reader.readAsDataURL(file);
  });
};

const handleUpload = async (file: File) => {
  // Manual validation
  if (!file.type.startsWith('image/')) {
    throw new Error('Invalid file type');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large');
  }
  
  const dataUrl = await compressImage(file);
  const contentType = 'image/jpeg'; // Hardcoded, loses PNG transparency!
  
  // Upload...
};
```

### After (New Middleware)

```typescript
import { uploadImage, ImageUploadPresets } from '@/lib/image-upload';

const handleUpload = async (file: File) => {
  try {
    const result = await uploadImage(file, ImageUploadPresets.logo);
    
    // Upload to server
    await fetch('/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        dataUrl: result.dataUrl,
        contentType: result.contentType, // Automatically correct!
      }),
    });
  } catch (error) {
    // Friendly error messages
    console.error(error.message);
  }
};
```

## Error Handling

The middleware throws descriptive errors:

```typescript
try {
  const result = await uploadImage(file, ImageUploadPresets.logo);
} catch (error) {
  // Error messages:
  // - "Unsupported file type. Please upload PNG, JPEG, SVG, WebP, GIF, or ICO files."
  // - "Only PNG, JPEG, SVG, ICO files are allowed."
  // - "File size must be less than 5MB."
  // - "Logo should be roughly square (aspect ratio between 1:2 and 2:1)."
  // - "Failed to load image for validation."
  
  setError(error.message);
}
```

## Benefits

### 1. Consistency
- Same compression logic everywhere
- Same validation rules
- Same error messages

### 2. Maintainability
- Fix bugs once, applies everywhere
- Add new features in one place
- Easy to update compression algorithms

### 3. Type Safety
- Full TypeScript support
- Compile-time type checking
- Autocomplete for presets

### 4. Performance
- Optimized compression
- Smart format detection
- Efficient canvas operations

### 5. User Experience
- Clear error messages
- Proper transparency handling
- SVG support for scalable graphics

## Supported File Types

| Type | Extension | MIME Type | Transparency | Compression |
|------|-----------|-----------|--------------|-------------|
| PNG | `.png` | `image/png` | ✅ Yes | ✅ Yes |
| JPEG | `.jpg`, `.jpeg` | `image/jpeg` | ❌ No | ✅ Yes |
| SVG | `.svg` | `image/svg+xml` | ✅ Yes | ❌ No (vector) |
| ICO | `.ico` | `image/x-icon` | ✅ Yes (as PNG) | ✅ Yes |
| WebP | `.webp` | `image/webp` | ✅ Yes | ✅ Yes |
| GIF | `.gif` | `image/gif` | ✅ Yes | ✅ Yes |

## Integration Checklist

To migrate existing upload code:

- [ ] Import `uploadImage` and preset
- [ ] Replace custom compression function
- [ ] Remove manual file type validation
- [ ] Remove manual size validation
- [ ] Remove hardcoded content types
- [ ] Use `result.dataUrl` and `result.contentType`
- [ ] Update error handling
- [ ] Update file input `accept` attribute
- [ ] Test with PNG (transparency)
- [ ] Test with SVG (no compression)
- [ ] Test with ICO (favicon)

## Future Enhancements

Potential additions:

- [ ] Image cropping/editing
- [ ] Multiple file upload
- [ ] Progress tracking
- [ ] Client-side image optimization (WebP conversion)
- [ ] EXIF data stripping
- [ ] Thumbnail generation
- [ ] Watermarking
- [ ] Format conversion
