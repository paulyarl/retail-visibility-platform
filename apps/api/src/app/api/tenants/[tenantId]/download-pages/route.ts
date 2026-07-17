import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { generateDownloadPageId } from '../../../../../lib/id-generator';
import { logger } from '../../../../../logger';

const prisma = new PrismaClient();

/**
 * GET /api/tenants/[tenantId]/download-pages
 * 
 * List download pages for tenant
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '25');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = { tenant_id: tenantId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [pages, total] = await Promise.all([
      prisma.digital_download_pages.findMany({
        where,
        include: {
          inventory_items_digital_download_pages_item_idToinventory_items: {
            select: {
              id: true,
              name: true,
              sku: true,
              product_type: true,
            },
          },
          digital_downloads: {
            select: {
              id: true,
              asset_name: true,
              asset_type: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.digital_download_pages.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        pages: pages.map(page => ({
          id: page.id,
          tenantId: page.tenant_id,
          itemId: page.item_id,
          slug: page.slug,
          title: page.title,
          description: page.description,
          pageType: page.page_type,
          status: page.status,
          publishedAt: page.published_at,
          createdAt: page.created_at,
          updatedAt: page.updated_at,
          item: page.inventory_items_digital_download_pages_item_idToinventory_items,
          assets: page.digital_downloads,
          assetCount: page.digital_downloads.length,
        })),
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    logger.error('Error fetching download pages:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch download pages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tenants/[tenantId]/download-pages
 * 
 * Create a new download page
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { tenantId } = params;
    const body = await request.json() as {
      itemId?: string;
      title?: string;
      slug?: string;
      description?: string;
      pageType?: string;
      customCss?: string;
      customJs?: string;
      logoUrl?: string;
      bannerUrl?: string;
      brandColor?: string;
      instructions?: string;
      thankYouMessage?: string;
      supportEmail?: string;
      supportUrl?: string;
      requireAuthentication?: boolean;
      requirePurchaseVerification?: boolean;
      accessExpires?: boolean;
      accessDurationDays?: number;
      allowMultipleDownloads?: boolean;
      downloadLimit?: number;
      downloadTracking?: boolean;
      customDownloadLimit?: number;
      customAccessDurationDays?: number;
      seoTitle?: string;
      seoDescription?: string;
      createdBy?: string;
    };

    // Validate required fields
    if (!body.itemId) {
      return NextResponse.json(
        { success: false, error: 'Item ID is required' },
        { status: 400 }
      );
    }

    if (!body.title || body.title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    // Check if item exists and belongs to tenant
    const item = await prisma.inventory_items.findFirst({
      where: {
        id: body.itemId,
        tenant_id: tenantId,
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Item not found or does not belong to tenant' },
        { status: 404 }
      );
    }

    // Check if download page already exists for this item
    const existingPage = await prisma.digital_download_pages.findFirst({
      where: {
        tenant_id: tenantId,
        item_id: body.itemId,
      },
    });

    if (existingPage) {
      return NextResponse.json(
        { success: false, error: 'Download page already exists for this item' },
        { status: 400 }
      );
    }

    // Generate slug if not provided
    let slug = body.slug || generateSlug(item.name);
    
    // Ensure slug is unique
    const slugExists = await prisma.digital_download_pages.findFirst({
      where: { tenant_id: tenantId, slug },
    });
    
    if (slugExists) {
      slug = `${slug}-${Date.now()}`;
    }

    // Create download page
    const downloadPage = await prisma.digital_download_pages.create({
      data: {
        id: generateDownloadPageId(tenantId),
        tenant_id: tenantId,
        item_id: body.itemId,
        slug,
        title: body.title,
        description: body.description,
        page_type: body.pageType || 'standard',
        custom_css: body.customCss,
        custom_js: body.customJs,
        logo_url: body.logoUrl,
        banner_url: body.bannerUrl,
        brand_color: body.brandColor,
        instructions: body.instructions,
        thank_you_message: body.thankYouMessage,
        support_email: body.supportEmail,
        support_url: body.supportUrl,
        require_authentication: body.requireAuthentication ?? true,
        require_purchase_verification: body.requirePurchaseVerification ?? true,
        access_expires: body.accessExpires ?? false,
        access_duration_days: body.accessDurationDays,
        allow_multiple_downloads: body.allowMultipleDownloads ?? true,
        download_limit: body.downloadLimit,
        download_tracking: body.downloadTracking ?? true,
        custom_download_limit: body.customDownloadLimit,
        custom_access_duration_days: body.customAccessDurationDays,
        seo_title: body.seoTitle,
        seo_description: body.seoDescription,
        status: 'draft',
        created_by: body.createdBy,
      },
      include: {
        inventory_items_digital_download_pages_item_idToinventory_items: {
          select: {
            id: true,
            name: true,
            sku: true,
            product_type: true,
          },
        },
      },
    });

    // Update inventory item with download page reference
    await prisma.inventory_items.update({
      where: { id: body.itemId },
      data: { download_page_id: downloadPage.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: downloadPage.id,
        tenantId: downloadPage.tenant_id,
        itemId: downloadPage.item_id,
        slug: downloadPage.slug,
        title: downloadPage.title,
        description: downloadPage.description,
        pageType: downloadPage.page_type,
        status: downloadPage.status,
        createdAt: downloadPage.created_at,
        updatedAt: downloadPage.updated_at,
        item: downloadPage.inventory_items_digital_download_pages_item_idToinventory_items,
      },
    });
  } catch (error) {
    logger.error('Error creating download page:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return NextResponse.json(
      { success: false, error: 'Failed to create download page' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to generate slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 100);
}
