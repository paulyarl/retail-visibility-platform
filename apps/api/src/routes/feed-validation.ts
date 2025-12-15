import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma'
import { Prisma } from '@prisma/client'
import { Flags } from '../config'

const router = Router()

const serializeOptionsSchema = z.object({
  limit: z.number().int().min(1).max(5000).optional(),
  includeInactive: z.boolean().optional()
})

function normalizeSku(v: unknown) {
  return typeof v === 'string' ? v.trim() : null
}

/**
 * Get Google Category ID for an inventory item.
 * Items can have categories assigned in two ways:
 * 1. directory_category_id - Direct FK to directory_category (preferred)
 * 2. category_path - String array from Clover/legacy systems (fallback)
 */
async function getGoogleCategoryIdForItem(
  tenantId: string, 
  directoryCategoryId: string | null, 
  categoryPath: string[] | null
): Promise<string | null> {
  // Method 1: Direct directory_category_id (preferred)
  if (directoryCategoryId) {
    const directCat = await prisma.directory_category.findFirst({ 
      where: { id: directoryCategoryId, tenantId, isActive: true } 
    })
    if (directCat?.googleCategoryId) return directCat.googleCategoryId
  }
  
  // Method 2: Fallback to category_path slug matching
  if (Array.isArray(categoryPath) && categoryPath.length > 0) {
    const slug = categoryPath[categoryPath.length - 1]
    const tenantCat = await prisma.directory_category.findFirst({ 
      where: { tenantId, slug, isActive: true } 
    })
    if (tenantCat?.googleCategoryId) return tenantCat.googleCategoryId
  }
  
  return null
}

/**
 * Check if an item has any category assignment (either method)
 */
function hasCategory(directoryCategoryId: string | null, categoryPath: string[] | null): boolean {
  if (directoryCategoryId) return true
  if (Array.isArray(categoryPath) && categoryPath.length > 0) return true
  return false
}

router.post('/:tenantId/feed/precheck', async (req, res) => {
  try {
    const tenantId = req.params.tenantId
    const limit = Math.min(parseInt(String(req.query.limit || '1000')), 5000)
    const items = await prisma.inventory_items.findMany({ where: { tenant_id: tenantId }, take: isNaN(limit) ? 1000 : limit })

    const missingCategory = [] as any[]
    const unmapped = [] as any[]

    for (const it of items) {
      const sku = normalizeSku((it as any).sku)
      const directoryCategoryId = (it as any).directory_category_id as string | null
      const categoryPath = (it as any).category_path as string[] | null
      
      if (!hasCategory(directoryCategoryId, categoryPath)) {
        missingCategory.push({ id: it.id, sku, reason: 'missing_category' })
        continue
      }
      const gId = await getGoogleCategoryIdForItem(tenantId, directoryCategoryId, categoryPath)
      if (!gId) {
        unmapped.push({ id: it.id, sku, categoryPath, directoryCategoryId, reason: 'unmapped_category' })
      }
    }

    res.json({ success: true, data: { total: items.length, missingCategory, unmapped } })
  } catch (e) {
    res.status(500).json({ success: false, error: 'precheck_failed' })
  }
})

router.get('/:tenantId/feed/validate', async (req, res) => {
  try {
    const tenantId = req.params.tenantId
    const items = await prisma.inventory_items.findMany({ where: { tenant_id: tenantId } })

    const errors: any[] = []
    const warnings: any[] = []

    for (const it of items) {
      const sku = normalizeSku((it as any).sku)
      const name = (it as any).name || (it as any).title || ''
      const itemInfo = { id: it.id, sku: sku || undefined, name: name || undefined }
      
      if (!sku) errors.push({ ...itemInfo, field: 'sku', message: 'sku_required' })
      if (!name || String(name).trim().length === 0) errors.push({ ...itemInfo, field: 'name', message: 'name_required' })
      const price = (it as any).price
      if (price == null || Number(price) <= 0) errors.push({ ...itemInfo, field: 'price', message: 'price_invalid' })

      const directoryCategoryId = (it as any).directory_category_id as string | null
      const categoryPath = (it as any).category_path as string[] | null
      
      if (!hasCategory(directoryCategoryId, categoryPath)) {
        errors.push({ ...itemInfo, field: 'categoryPath', message: 'category_required' })
      } else {
        const gId = await getGoogleCategoryIdForItem(tenantId, directoryCategoryId, categoryPath)
        if (!gId) errors.push({ ...itemInfo, field: 'googleCategoryId', message: 'category_unmapped' })
      }

      // Enhanced validations
      const image = (it as any).image_url || (Array.isArray((it as any).image_gallery) ? (it as any).image_gallery[0] : null)
      if (!image) warnings.push({ ...itemInfo, field: 'image', message: 'image_recommended' })

      const availability = (it as any).availability // expected: 'in_stock' | 'out_of_stock' | 'preorder'
      if (!availability) warnings.push({ ...itemInfo, field: 'availability', message: 'availability_recommended' })

      const condition = (it as any).condition // expected: 'new' | 'used' | 'refurbished'
      if (!condition) warnings.push({ ...itemInfo, field: 'condition', message: 'condition_recommended' })

      // Identifier rules for Google Merchant:
      // - Best: GTIN/UPC (globally unique)
      // - Good: Brand + MPN (manufacturer-unique)
      // - Acceptable: Brand alone (helps with search/categorization)
      // UPC can be stored in: gtin field, or metadata.barcode (enrichment source)
      const brand = (it as any).brand
      const gtin = (it as any).gtin
      const mpn = (it as any).mpn
      const metadata = (it as any).metadata || {}
      const upcFromMetadata = metadata?.barcode
      
      const hasGtinOrUpc = (gtin && String(gtin).trim().length > 0) || (upcFromMetadata && String(upcFromMetadata).trim().length > 0)
      const hasBrand = brand && String(brand).trim().length > 0
      const hasMpn = mpn && String(mpn).trim().length > 0
      // Item passes if it has: GTIN/UPC, OR Brand (with or without MPN)
      const hasIdentifiers = hasGtinOrUpc || hasBrand
      if (!hasIdentifiers) warnings.push({ ...itemInfo, field: 'identifiers', message: 'identifiers_recommended' })
    }

    res.json({ success: true, data: { total: items.length, errors, warnings } })
  } catch (e) {
    res.status(500).json({ success: false, error: 'validate_failed' })
  }
})

router.post('/:tenantId/feed/serialize', async (req, res) => {
  try {
    const tenantId = req.params.tenantId
    const opts = serializeOptionsSchema.parse(req.body || {})
    const where: any = { tenant_id: tenantId }
    if (!opts.includeInactive) where.item_status = 'active'
    const take = opts.limit ?? 1000

    const items = await prisma.inventory_items.findMany({ where, take })

    const output = [] as any[]
    for (const it of items) {
      const directoryCategoryId = (it as any).directory_category_id as string | null
      const categoryPath = (it as any).category_path as string[] | null
      const googleCategoryId = await getGoogleCategoryIdForItem(tenantId, directoryCategoryId, categoryPath)
      output.push({
        id: it.id,
        offerId: normalizeSku((it as any).sku) || it.id,
        title: (it as any).name || (it as any).title || '',
        description: (it as any).description || '',
        price: (it as any).price,
        brand: (it as any).brand || null,
        gtin: (it as any).gtin || null,
        mpn: (it as any).mpn || null,
        googleProductCategory: googleCategoryId,
        categoryPath,
        directoryCategoryId,
        link: (it as any).productUrl || null,
        imageLink: (it as any).image_url || null
      })
    }

    res.json({ success: true, data: { total: output.length, items: output } })
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ success: false, error: 'invalid_request', details: e.issues })
    res.status(500).json({ success: false, error: 'serialize_failed' })
  }
})

// Coverage endpoint (no view dependency): resolve by joining item leaf slug to tenant_category.slug
router.get('/:tenantId/categories/coverage', async (req, res) => {
  // Feature flag gate
  if (!Flags.FEED_COVERAGE) {
    return res.status(404).json({ success: false, error: 'feature_disabled' })
  }

  try {
    const tenantId = req.params.tenantId
    // Total active, public items for tenant
    const total = await prisma.inventory_items.count({ where: { tenant_id: tenantId, item_status: 'active', visibility: 'public' } })

    // Mapped _count: join inventory_items to directory_category by leaf slug of category_path
    // Use regular Prisma queries instead of raw SQL to avoid type issues
    const mappedItems = await prisma.inventory_items.findMany({
      where: {
        tenant_id: tenantId,
        item_status: 'active',
        visibility: 'public',
      },
      select: {
        category_path: true,
      },
    });

    let mapped = 0;
    for (const item of mappedItems) {
      if (item.category_path && item.category_path.length > 0) {
        const leafSlug = item.category_path[item.category_path.length - 1];
        const category = await prisma.directory_category.findFirst({
          where: {
            tenantId: tenantId,
            slug: leafSlug,
            isActive: true,
            googleCategoryId: { not: null },
          },
        });
        if (category) {
          mapped++;
        }
      }
    }
    const unmapped = Math.max(total - mapped, 0)
    const coverage = total > 0 ? parseFloat(((mapped / total) * 100).toFixed(2)) : 0

    res.json({ success: true, data: { total, mapped, unmapped, coverage } })
  } catch (e) {
    res.status(500).json({ success: false, error: 'coverage_failed' })
  }
})

export default router
