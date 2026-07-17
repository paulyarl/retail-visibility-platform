/**
 * Shop Branding Configuration System
 * Comprehensive branding options for shop customization
 */

export interface ShopBranding {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background?: string;
    text?: string;
  };
  fonts: {
    heading: string;
    body: string;
    custom?: {
      name: string;
      url: string;
    };
  };
  logo: {
    url: string;
    size: 'small' | 'medium' | 'large';
    position: 'left' | 'center' | 'right';
    style: 'square' | 'rounded' | 'circle';
  };
  banner: {
    url: string;
    height: number;
    overlay: boolean;
    overlayOpacity?: number;
    position: 'top' | 'center' | 'bottom';
  };
  layout: {
    style: 'modern' | 'classic' | 'minimal' | 'bold';
    spacing: 'compact' | 'normal' | 'spacious';
    borderRadius: 'none' | 'small' | 'medium' | 'large';
  };
}

export interface BrandingPreset {
  id: string;
  name: string;
  description: string;
  branding: ShopBranding;
  preview: string;
  category: 'modern' | 'classic' | 'minimal' | 'colorful' | 'professional';
}

export interface BrandingValidationResult {
  isValid: boolean;
  errors: BrandingError[];
  warnings: BrandingWarning[];
}

export interface BrandingError {
  field: string;
  message: string;
  fixable: boolean;
}

export interface BrandingWarning {
  field: string;
  message: string;
  recommendation: string;
}

export interface ShopBrandingService {
  getShopBranding(shopId: string): Promise<ShopBranding>;
  updateShopBranding(shopId: string, branding: ShopBranding): Promise<void>;
  validateBranding(branding: ShopBranding): Promise<BrandingValidationResult>;
  applyPreset(shopId: string, presetId: string): Promise<void>;
  resetToDefault(shopId: string): Promise<void>;
  getAvailablePresets(): Promise<BrandingPreset[]>;
}

// Predefined color palettes
export const COLOR_PRESETS = {
  ocean: {
    primary: '#0077BE',
    secondary: '#00A8E8',
    accent: '#00CED1',
    background: '#F0F8FF',
    text: '#1E3A8A'
  },
  forest: {
    primary: '#228B22',
    secondary: '#32CD32',
    accent: '#90EE90',
    background: '#F0FFF0',
    text: '#0F4F0F'
  },
  sunset: {
    primary: '#FF6B35',
    secondary: '#FF8C42',
    accent: '#FFB347',
    background: '#FFF5F5',
    text: '#8B2500'
  },
  midnight: {
    primary: '#1A1A2E',
    secondary: '#16213E',
    accent: '#0F3460',
    background: '#F5F5F5',
    text: '#1A1A2E'
  },
  lavender: {
    primary: '#6B46C1',
    secondary: '#9333EA',
    accent: '#A78BFA',
    background: '#FAF5FF',
    text: '#4C1D95'
  },
  coral: {
    primary: '#FF6B6B',
    secondary: '#FF8787',
    accent: '#FFA8A8',
    background: '#FFF5F5',
    text: '#C92A2A'
  }
};

// Predefined font families
export const FONT_FAMILIES = {
  modern: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'Inter, system-ui, sans-serif'
  },
  classic: {
    heading: 'Georgia, serif',
    body: 'Georgia, serif'
  },
  minimal: {
    heading: 'Helvetica, Arial, sans-serif',
    body: 'Helvetica, Arial, sans-serif'
  },
  elegant: {
    heading: 'Playfair Display, serif',
    body: 'Source Sans Pro, sans-serif'
  },
  bold: {
    heading: 'Montserrat, sans-serif',
    body: 'Open Sans, sans-serif'
  }
};

// Branding presets
export const BRANDING_PRESETS: BrandingPreset[] = [
  {
    id: 'modern-blue',
    name: 'Modern Blue',
    description: 'Clean and professional blue theme',
    category: 'modern',
    preview: '/presets/modern-blue.png',
    branding: {
      colors: COLOR_PRESETS.ocean,
      fonts: FONT_FAMILIES.modern,
      logo: {
        url: '',
        size: 'medium',
        position: 'left',
        style: 'rounded'
      },
      banner: {
        url: '',
        height: 300,
        overlay: true,
        overlayOpacity: 0.3,
        position: 'center'
      },
      layout: {
        style: 'modern',
        spacing: 'normal',
        borderRadius: 'medium'
      }
    }
  },
  {
    id: 'classic-green',
    name: 'Classic Green',
    description: 'Traditional and trustworthy green theme',
    category: 'classic',
    preview: '/presets/classic-green.png',
    branding: {
      colors: COLOR_PRESETS.forest,
      fonts: FONT_FAMILIES.classic,
      logo: {
        url: '',
        size: 'large',
        position: 'center',
        style: 'square'
      },
      banner: {
        url: '',
        height: 400,
        overlay: false,
        position: 'top'
      },
      layout: {
        style: 'classic',
        spacing: 'spacious',
        borderRadius: 'small'
      }
    }
  },
  {
    id: 'minimal-gray',
    name: 'Minimal Gray',
    description: 'Clean and minimalist gray theme',
    category: 'minimal',
    preview: '/presets/minimal-gray.png',
    branding: {
      colors: COLOR_PRESETS.midnight,
      fonts: FONT_FAMILIES.minimal,
      logo: {
        url: '',
        size: 'small',
        position: 'left',
        style: 'square'
      },
      banner: {
        url: '',
        height: 250,
        overlay: false,
        position: 'center'
      },
      layout: {
        style: 'minimal',
        spacing: 'compact',
        borderRadius: 'none'
      }
    }
  },
  {
    id: 'warm-orange',
    name: 'Warm Orange',
    description: 'Friendly and energetic orange theme',
    category: 'colorful',
    preview: '/presets/warm-orange.png',
    branding: {
      colors: COLOR_PRESETS.sunset,
      fonts: FONT_FAMILIES.bold,
      logo: {
        url: '',
        size: 'medium',
        position: 'center',
        style: 'rounded'
      },
      banner: {
        url: '',
        height: 350,
        overlay: true,
        overlayOpacity: 0.4,
        position: 'bottom'
      },
      layout: {
        style: 'bold',
        spacing: 'normal',
        borderRadius: 'large'
      }
    }
  },
  {
    id: 'elegant-purple',
    name: 'Elegant Purple',
    description: 'Sophisticated and luxurious purple theme',
    category: 'professional',
    preview: '/presets/elegant-purple.png',
    branding: {
      colors: COLOR_PRESETS.lavender,
      fonts: FONT_FAMILIES.elegant,
      logo: {
        url: '',
        size: 'large',
        position: 'center',
        style: 'circle'
      },
      banner: {
        url: '',
        height: 400,
        overlay: true,
        overlayOpacity: 0.2,
        position: 'center'
      },
      layout: {
        style: 'modern',
        spacing: 'spacious',
        borderRadius: 'medium'
      }
    }
  }
];

// Implementation of ShopBrandingService
class ShopBrandingServiceImpl implements ShopBrandingService {
  private static instance: ShopBrandingServiceImpl;
  private shopBranding: Map<string, ShopBranding> = new Map();

  private constructor() {
    this.loadDefaultBranding();
  }

  static getInstance(): ShopBrandingServiceImpl {
    if (!ShopBrandingServiceImpl.instance) {
      ShopBrandingServiceImpl.instance = new ShopBrandingServiceImpl();
    }
    return ShopBrandingServiceImpl.instance;
  }

  private loadDefaultBranding(): void {
    // Load default branding for shops
    this.shopBranding.set('default', {
      colors: COLOR_PRESETS.ocean,
      fonts: FONT_FAMILIES.modern,
      logo: {
        url: '',
        size: 'medium',
        position: 'left',
        style: 'rounded'
      },
      banner: {
        url: '',
        height: 300,
        overlay: true,
        overlayOpacity: 0.3,
        position: 'center'
      },
      layout: {
        style: 'modern',
        spacing: 'normal',
        borderRadius: 'medium'
      }
    });
  }

  async getShopBranding(shopId: string): Promise<ShopBranding> {
    return this.shopBranding.get(shopId) || this.shopBranding.get('default')!;
  }

  async updateShopBranding(shopId: string, branding: ShopBranding): Promise<void> {
    const validation = await this.validateBranding(branding);
    
    if (!validation.isValid) {
      throw new Error(`Branding validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    this.shopBranding.set(shopId, branding);
    
    // In a real implementation, save to database
    console.log(`Branding updated for shop ${shopId}`);
  }

  async validateBranding(branding: ShopBranding): Promise<BrandingValidationResult> {
    const errors: BrandingError[] = [];
    const warnings: BrandingWarning[] = [];

    // Validate colors
    if (!this.isValidColor(branding.colors.primary)) {
      errors.push({
        field: 'colors.primary',
        message: 'Primary color is invalid',
        fixable: true
      });
    }

    if (!this.isValidColor(branding.colors.secondary)) {
      errors.push({
        field: 'colors.secondary',
        message: 'Secondary color is invalid',
        fixable: true
      });
    }

    if (!this.isValidColor(branding.colors.accent)) {
      errors.push({
        field: 'colors.accent',
        message: 'Accent color is invalid',
        fixable: true
      });
    }

    // Validate fonts
    if (!branding.fonts.heading) {
      errors.push({
        field: 'fonts.heading',
        message: 'Heading font is required',
        fixable: true
      });
    }

    if (!branding.fonts.body) {
      errors.push({
        field: 'fonts.body',
        message: 'Body font is required',
        fixable: true
      });
    }

    // Validate logo
    if (!branding.logo.url) {
      warnings.push({
        field: 'logo.url',
        message: 'Logo URL is recommended for better branding',
        recommendation: 'Upload a logo to enhance your shop identity'
      });
    }

    // Validate banner
    if (branding.banner.height < 200 || branding.banner.height > 600) {
      warnings.push({
        field: 'banner.height',
        message: 'Banner height should be between 200-600px for optimal display',
        recommendation: 'Adjust banner height for better user experience'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async applyPreset(shopId: string, presetId: string): Promise<void> {
    const preset = BRANDING_PRESETS.find(p => p.id === presetId);
    if (!preset) {
      throw new Error(`Preset ${presetId} not found`);
    }

    await this.updateShopBranding(shopId, preset.branding);
  }

  async resetToDefault(shopId: string): Promise<void> {
    const defaultBranding = this.shopBranding.get('default')!;
    await this.updateShopBranding(shopId, defaultBranding);
  }

  async getAvailablePresets(): Promise<BrandingPreset[]> {
    return BRANDING_PRESETS;
  }

  // Utility methods
  private isValidColor(color: string): boolean {
    // Simple hex color validation
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexRegex.test(color);
  }

  async generateCSS(shopId: string): Promise<string> {
    const branding = await this.getShopBranding(shopId);
    
    return `
      :root {
        --shop-primary: ${branding.colors.primary};
        --shop-secondary: ${branding.colors.secondary};
        --shop-accent: ${branding.colors.accent};
        --shop-background: ${branding.colors.background || '#ffffff'};
        --shop-text: ${branding.colors.text || '#000000'};
        --shop-heading-font: ${branding.fonts.heading};
        --shop-body-font: ${branding.fonts.body};
        --shop-border-radius: ${this.getBorderRadiusValue(branding.layout.borderRadius)};
      }
    `;
  }

  private getBorderRadiusValue(radius: 'none' | 'small' | 'medium' | 'large'): string {
    switch (radius) {
      case 'none': return '0';
      case 'small': return '4px';
      case 'medium': return '8px';
      case 'large': return '16px';
      default: return '8px';
    }
  }

  async previewBranding(shopId: string, branding: ShopBranding): Promise<string> {
    // Generate a preview URL or HTML snippet
    // In a real implementation, this would generate a live preview
    return `/shops/${shopId}/branding/preview`;
  }
}

// Export singleton instance
export const shopBrandingService = ShopBrandingServiceImpl.getInstance();

// React hook for branding management
import { useState, useEffect } from 'react';
import { clientLogger } from '@/lib/client-logger';

export function useShopBranding(shopId: string) {
  const [branding, setBranding] = useState<ShopBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<BrandingPreset[]>([]);

  useEffect(() => {
    const loadBranding = async () => {
      setLoading(true);
      try {
        const [shopBranding, availablePresets] = await Promise.all([
          shopBrandingService.getShopBranding(shopId),
          shopBrandingService.getAvailablePresets()
        ]);
        
        setBranding(shopBranding);
        setPresets(availablePresets);
      } catch (error) {
        clientLogger.error('Error loading branding:', { detail: error });
      } finally {
        setLoading(false);
      }
    };

    loadBranding();
  }, [shopId]);

  const updateBranding = async (newBranding: ShopBranding) => {
    try {
      await shopBrandingService.updateShopBranding(shopId, newBranding);
      setBranding(newBranding);
    } catch (error) {
      clientLogger.error('Error updating branding:', { detail: error });
      throw error;
    }
  };

  const applyPreset = async (presetId: string) => {
    try {
      await shopBrandingService.applyPreset(shopId, presetId);
      const updatedBranding = await shopBrandingService.getShopBranding(shopId);
      setBranding(updatedBranding);
    } catch (error) {
      clientLogger.error('Error applying preset:', { detail: error });
      throw error;
    }
  };

  const resetToDefault = async () => {
    try {
      await shopBrandingService.resetToDefault(shopId);
      const defaultBranding = await shopBrandingService.getShopBranding(shopId);
      setBranding(defaultBranding);
    } catch (error) {
      clientLogger.error('Error resetting branding:', { detail: error });
      throw error;
    }
  };

  const validateBranding = async (brandingToValidate: ShopBranding) => {
    return await shopBrandingService.validateBranding(brandingToValidate);
  };

  return {
    branding,
    loading,
    presets,
    updateBranding,
    applyPreset,
    resetToDefault,
    validateBranding
  };
}
