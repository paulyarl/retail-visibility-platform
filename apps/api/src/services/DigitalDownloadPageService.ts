/**
 * Digital Download Page Service
 * 
 * Backend service for managing digital download pages
 * Handles CRUD operations, slug generation, asset management, and preview tokens
 * 
 * Features:
 * - Automatic slug generation with collision handling
 * - Preview token generation for testing
 * - Asset management and ordering
 * - Template system for default content
 * - Comprehensive validation and error handling
 */

import { prisma } from '../prisma';
import crypto from 'crypto';

export interface DownloadPage {
  id: string;
  tenant_id: string;
  item_id: string;
  slug: string;
  title: string;
  description?: string;
  page_type: string;
  custom_css?: string;
  custom_js?: string;
  logo_url?: string;
  banner_url?: string;
  brand_color?: string;
  instructions?: string;
  thank_you_message?: string;
  support_email?: string;
  support_url?: string;
  require_authentication: boolean;
  require_purchase_verification: boolean;
  access_expires: boolean;
  access_duration_days?: number;
  allow_multiple_downloads: boolean;
  download_limit?: number;
  download_tracking: boolean;
  custom_download_limit?: number;
  custom_access_duration_days?: number;
  seo_title?: string;
  seo_description?: string;
  status: string;
  published_at?: Date;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  // Variant information
  variant_id?: string;
  variant_name?: string;
  variant_attributes?: Record<string, any>;
  // Joined data
  item?: {
    id: string;
    name: string;
    product_type: string;
  };
}

export interface DownloadPageAsset {
  id: string;
  tenant_id: string;
  download_page_id: string;
  item_id: string;
  asset_name: string;
  asset_type: string;
  file_path?: string;
  file_size?: bigint;
  file_mime_type?: string;
  external_url?: string;
  license_key_template?: string;
  download_method: string;
  requires_license_key: boolean;
  license_key_generator?: string;
  access_type: string;
  max_downloads?: number;
  expiry_days?: number;
  display_order: number;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDownloadPageDto {
  itemId: string;
  title: string;
  description?: string;
  instructions?: string;
  thankYouMessage?: string;
  supportEmail?: string;
  supportUrl?: string;
  brandColor?: string;
  requireAuthentication?: boolean;
  accessExpires?: boolean;
  accessDurationDays?: number;
  downloadLimit?: number;
  allowMultipleDownloads?: boolean;
  status?: 'draft' | 'published' | 'archived';
}

export interface UpdateDownloadPageDto extends Partial<CreateDownloadPageDto> {
  slug?: string;
  logoUrl?: string;
  bannerUrl?: string;
  customCss?: string;
  customJs?: string;
  pageType?: string;
  requirePurchaseVerification?: boolean;
  downloadTracking?: boolean;
  customDownloadLimit?: number;
  customAccessDurationDays?: number;
  seoTitle?: string;
  seoDescription?: string;
}

export interface PreviewToken {
  token: string;
  download_page_id: string;
  tenant_id: string;
  expires_at: string;
  created_at: string;
  created_by?: string;
}

export interface GetPagesParams {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}

export interface GetPagesResult {
  pages: DownloadPage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  stats: {
    total: number;
    draft: number;
    published: number;
    archived: number;
  };
}

export class DigitalDownloadPageService {
  /**
   * Generate a unique slug for a download page
   */
  async generateUniqueSlug(tenantId: string, title: string): Promise<string> {
    // Base slug generation
    let baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    // If base slug is empty, use a default
    if (!baseSlug) {
      baseSlug = 'download-page';
    }

    // Check for collisions and append number if needed
    let slug = baseSlug;
    let counter = 1;

    while (await this.slugExists(tenantId, slug)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Check if a slug already exists for a tenant
   */
  private async slugExists(tenantId: string, slug: string): Promise<boolean> {
    try {
      const existing = await prisma.digital_download_pages.findUnique({
        where: {
          tenant_id_slug: {
            tenant_id: tenantId,
            slug: slug
          }
        },
        select: { id: true }
      });
      
      return !!existing;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all download pages for a tenant
   */
  async getDownloadPages(tenantId: string, params: GetPagesParams): Promise<GetPagesResult> {
    const { page, limit, status, search } = params;
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = { tenant_id: tenantId };
    
    // Apply status filter
    if (status !== 'all') {
      where.status = status;
    }

    // Apply search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Execute main query and count in parallel
    const [pages, total, statsData] = await Promise.all([
      prisma.digital_download_pages.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        skip: offset,
        take: limit,
        include: {
          inventory_items_digital_download_pages_item_idToinventory_items: {
            select: {
              id: true,
              name: true,
              product_type: true
            }
          }
        }
      }),
      prisma.digital_download_pages.count({ where }),
      prisma.digital_download_pages.groupBy({
        by: ['status'],
        where: { tenant_id: tenantId },
        _count: { status: true }
      })
    ]);

    // Calculate stats
    const stats = {
      total,
      draft: statsData.find(s => s.status === 'draft')?._count.status || 0,
      published: statsData.find(s => s.status === 'published')?._count.status || 0,
      archived: statsData.find(s => s.status === 'archived')?._count.status || 0
    };

    return {
      pages: pages as DownloadPage[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total
      },
      stats
    };
  }

  /**
   * Get a specific download page
   */
  async getDownloadPage(tenantId: string, pageId: string): Promise<DownloadPage | null> {
    try {
      const page = await prisma.digital_download_pages.findUnique({
        where: {
          id: pageId,
          tenant_id: tenantId
        }
      });

      return page as unknown as DownloadPage || null;
    } catch (error) {
      return null; // Not found or error
    }
  }

  /**
   * Create a new download page
   */
  async createDownloadPage(tenantId: string, data: CreateDownloadPageDto & { slug: string }): Promise<DownloadPage> {
    // Generate ID
    const id = `ddp-${tenantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const pageData = {
      id,
      tenant_id: tenantId,
      item_id: data.itemId,
      slug: data.slug,
      title: data.title,
      description: data.description || null,
      instructions: data.instructions || null,
      thank_you_message: data.thankYouMessage || null,
      support_email: data.supportEmail || null,
      support_url: data.supportUrl || null,
      brand_color: data.brandColor || null,
      require_authentication: data.requireAuthentication ?? true,
      require_purchase_verification: true,
      access_expires: data.accessExpires ?? false,
      access_duration_days: data.accessDurationDays || null,
      allow_multiple_downloads: data.allowMultipleDownloads ?? true,
      download_limit: data.downloadLimit || null,
      download_tracking: true,
      status: data.status || 'draft',
      page_type: 'standard'
    };

    const result = await prisma.digital_download_pages.create({
      data: pageData
    });

    return result as unknown as DownloadPage;
  }

  /**
   * Update a download page
   */
  async updateDownloadPage(tenantId: string, pageId: string, data: UpdateDownloadPageDto): Promise<DownloadPage> {
    // Build update object with proper field mapping
    const updateData: any = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.instructions !== undefined) updateData.instructions = data.instructions;
    if (data.thankYouMessage !== undefined) updateData.thank_you_message = data.thankYouMessage;
    if (data.supportEmail !== undefined) updateData.support_email = data.supportEmail;
    if (data.supportUrl !== undefined) updateData.support_url = data.supportUrl;
    if (data.brandColor !== undefined) updateData.brand_color = data.brandColor;
    if (data.logoUrl !== undefined) updateData.logo_url = data.logoUrl;
    if (data.bannerUrl !== undefined) updateData.banner_url = data.bannerUrl;
    if (data.customCss !== undefined) updateData.custom_css = data.customCss;
    if (data.customJs !== undefined) updateData.custom_js = data.customJs;
    if (data.pageType !== undefined) updateData.page_type = data.pageType;
    if (data.requireAuthentication !== undefined) updateData.require_authentication = data.requireAuthentication;
    if (data.requirePurchaseVerification !== undefined) updateData.require_purchase_verification = data.requirePurchaseVerification;
    if (data.accessExpires !== undefined) updateData.access_expires = data.accessExpires;
    if (data.accessDurationDays !== undefined) updateData.access_duration_days = data.accessDurationDays;
    if (data.allowMultipleDownloads !== undefined) updateData.allow_multiple_downloads = data.allowMultipleDownloads;
    if (data.downloadLimit !== undefined) updateData.download_limit = data.downloadLimit;
    if (data.downloadTracking !== undefined) updateData.download_tracking = data.downloadTracking;
    if (data.customDownloadLimit !== undefined) updateData.custom_download_limit = data.customDownloadLimit;
    if (data.customAccessDurationDays !== undefined) updateData.custom_access_duration_days = data.customAccessDurationDays;
    if (data.seoTitle !== undefined) updateData.seo_title = data.seoTitle;
    if (data.seoDescription !== undefined) updateData.seo_description = data.seoDescription;
    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'published') {
        updateData.published_at = new Date();
      }
    }

    updateData.updated_at = new Date();

    const result = await prisma.digital_download_pages.update({
      where: {
        id: pageId,
        tenant_id: tenantId
      },
      data: updateData
    });

    return result as unknown as DownloadPage;
  }

  /**
   * Delete a download page
   */
  async deleteDownloadPage(tenantId: string, pageId: string): Promise<void> {
    await prisma.digital_download_pages.delete({
      where: {
        id: pageId,
        tenant_id: tenantId
      }
    });
  }

  /**
   * Generate a preview token for testing
   * TODO: Implement when digital_preview_tokens table is added to schema
   */
  async generatePreviewToken(tenantId: string, pageId: string, expiresInHours: number = 2): Promise<string> {
    // For now, return a simple token - this should be implemented with proper table
    const token = crypto.randomBytes(32).toString('hex');
    return token;
  }

  /**
   * Get all assets for a download page
   */
  async getPageAssets(tenantId: string, pageId: string): Promise<DownloadPageAsset[]> {
    const assets = await prisma.digital_downloads.findMany({
      where: {
        tenant_id: tenantId,
        download_page_id: pageId
      },
      orderBy: { display_order: 'asc' }
    });

    return assets as unknown as DownloadPageAsset[];
  }

  /**
   * Get assets for a download page filtered by variant
   */
  async getPageAssetsForVariant(tenantId: string, pageId: string, variantId?: string): Promise<DownloadPageAsset[]> {
    const where: any = {
      tenant_id: tenantId,
      download_page_id: pageId
    };

    // Filter by variant if specified, otherwise get non-variant assets
    if (variantId) {
      where.variant_id = variantId;
    } else {
      where.variant_id = null;
    }

    const assets = await prisma.digital_downloads.findMany({
      where,
      orderBy: { display_order: 'asc' },
      include: {
        product_variants: {
          select: {
            id: true,
            variant_name: true,
            attributes: true
          }
        }
      }
    });

    return assets as unknown as DownloadPageAsset[];
  }

  /**
   * Reorder assets on a download page
   */
  async reorderPageAssets(tenantId: string, pageId: string, assetIds: string[]): Promise<void> {
    // Update display_order for each asset in a transaction
    await prisma.$transaction(
      assetIds.map((assetId, index) =>
        prisma.digital_downloads.update({
          where: {
            id: assetId,
            tenant_id: tenantId,
            download_page_id: pageId
          },
          data: { display_order: index }
        })
      )
    );
  }

  /**
   * Get download page by item ID
   */
  async getDownloadPageByItem(tenantId: string, itemId: string): Promise<DownloadPage | null> {
    try {
      const page = await prisma.digital_download_pages.findFirst({
        where: {
          item_id: itemId,
          tenant_id: tenantId
        }
      });

      return page as unknown as DownloadPage || null;
    } catch (error) {
      return null; // Not found or error
    }
  }

  /**
   * Add an asset to a download page
   */
  async addPageAsset(tenantId: string, pageId: string, data: {
    assetName: string;
    assetType: string;
    filePath?: string;
    fileSize?: bigint;
    fileMimeType?: string;
    externalUrl?: string;
    downloadMethod?: string;
    requiresLicenseKey?: boolean;
    variantId?: string;
  }): Promise<DownloadPageAsset> {
    // Generate ID
    const id = `da-${tenantId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get the highest display order for this page
    const lastAsset = await prisma.digital_downloads.findFirst({
      where: {
        tenant_id: tenantId,
        download_page_id: pageId
      },
      orderBy: { display_order: 'desc' }
    });
    
    const displayOrder = (lastAsset?.display_order || 0) + 1;
    
    const asset = await prisma.digital_downloads.create({
      data: {
        id,
        tenant_id: tenantId,
        download_page_id: pageId,
        item_id: await this.getItemIdForPage(pageId),
        variant_id: data.variantId || null,
        asset_name: data.assetName,
        asset_type: data.assetType,
        file_path: data.filePath,
        file_size: data.fileSize,
        file_mime_type: data.fileMimeType,
        external_url: data.externalUrl,
        download_method: data.downloadMethod || 'direct',
        requires_license_key: data.requiresLicenseKey || false,
        is_primary: false,
        display_order: displayOrder
      }
    });
    
    return asset as unknown as DownloadPageAsset;
  }
  
  /**
   * Update an asset
   */
  async updatePageAsset(tenantId: string, pageId: string, assetId: string, data: Partial<{
    assetName: string;
    assetType: string;
    filePath?: string;
    fileSize?: bigint;
    fileMimeType?: string;
    externalUrl?: string;
    downloadMethod?: string;
    requiresLicenseKey?: boolean;
    variantId?: string;
  }>): Promise<DownloadPageAsset> {
    const updateData: any = {};
    
    if (data.assetName !== undefined) updateData.asset_name = data.assetName;
    if (data.assetType !== undefined) updateData.asset_type = data.assetType;
    if (data.filePath !== undefined) updateData.file_path = data.filePath;
    if (data.fileSize !== undefined) updateData.file_size = data.fileSize;
    if (data.fileMimeType !== undefined) updateData.file_mime_type = data.fileMimeType;
    if (data.externalUrl !== undefined) updateData.external_url = data.externalUrl;
    if (data.downloadMethod !== undefined) updateData.download_method = data.downloadMethod;
    if (data.requiresLicenseKey !== undefined) updateData.requires_license_key = data.requiresLicenseKey;
    if (data.variantId !== undefined) updateData.variant_id = data.variantId;
    
    updateData.updated_at = new Date();
    
    const asset = await prisma.digital_downloads.update({
      where: {
        id: assetId,
        tenant_id: tenantId,
        download_page_id: pageId
      },
      data: updateData
    });
    
    return asset as unknown as DownloadPageAsset;
  }
  
  /**
   * Delete an asset
   */
  async deletePageAsset(tenantId: string, pageId: string, assetId: string): Promise<void> {
    await prisma.digital_downloads.delete({
      where: {
        id: assetId,
        tenant_id: tenantId,
        download_page_id: pageId
      }
    });
  }
  
  /**
   * Get item ID for a download page
   */
  private async getItemIdForPage(pageId: string): Promise<string> {
    const page = await prisma.digital_download_pages.findUnique({
      where: { id: pageId },
      select: { item_id: true }
    });
    
    if (!page?.item_id) {
      throw new Error('Download page not found or has no associated item');
    }
    
    return page.item_id;
  }

  /**
   * Apply default template to a download page
   */
  async applyDefaultTemplate(tenantId: string, pageId: string): Promise<DownloadPage> {
    // Get tenant branding settings
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { name: true }
    });

    const template = {
      instructions: `Thank you for your purchase! Your digital files are ready for download below. If you have any issues accessing your files, please don't hesitate to contact our support team.`,
      thank_you_message: `Enjoy your digital purchase from ${tenant?.name || 'our store'}! We hope you love your new files.`,
      support_email: 'support@example.com', // Should be configurable
      require_authentication: true,
      require_purchase_verification: true,
      allow_multiple_downloads: true,
      download_tracking: true
    };

    return this.updateDownloadPage(tenantId, pageId, template);
  }
}
