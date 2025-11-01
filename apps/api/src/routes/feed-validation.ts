import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma'

const router = Router()

const serializeOptionsSchema = z.object({
  limit: z.number().int().min(1).max(5000).optional(),
  includeInactive: z.boolean().optional()
})

function normalizeSku(v: unknown) {
  return typeof v === 'string' ? v.trim() : null
}

async function getGoogleCategoryIdForItem(tenantId: string, categoryPath: string[] | null) {
  if (!Array.isArray(categoryPath) || categoryPath.length === 0) return null
  const slug = categoryPath[categoryPath.length - 1]
  const tenantCat = await prisma.tenantCategory.findFirst({ where: { tenantId, slug, isActive: true } })
  return tenantCat?.googleCategoryId || null
}

router.post('/:tenantId/feed/precheck', async (req, res) => {
  try {
    const tenantId = req.params.tenantId
    const limit = Math.min(parseInt(String(req.query.limit || '1000')), 5000)
    const items = await prisma.inventoryItem.findMany({ where: { tenantId }, take: isNaN(limit) ? 1000 : limit })

    const missingCategory = [] as any[]
    const unmapped = [] as any[]

    for (const it of items) {
      const sku = normalizeSku((it as any).sku)
      const categoryPath = (it as any).categoryPath as string[] | null
      if (!categoryPath || categoryPath.length === 0) {
        missingCategory.push({ id: it.id, sku, reason: 'missing_category' })
        continue
      }
      const gId = await getGoogleCategoryIdForItem(tenantId, categoryPath)
      if (!gId) {
        unmapped.push({ id: it.id, sku, categoryPath, reason: 'unmapped_category' })
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
    const items = await prisma.inventoryItem.findMany({ where: { tenantId } })

    const errors: any[] = []
    const warnings: any[] = []

    for (const it of items) {
      const sku = normalizeSku((it as any).sku)
      if (!sku) errors.push({ id: it.id, field: 'sku', message: 'sku_required' })
      const name = (it as any).name
      if (!name || String(name).trim().length === 0) errors.push({ id: it.id, field: 'name', message: 'name_required' })
      const price = (it as any).price
      if (price == null || Number(price) <= 0) errors.push({ id: it.id, field: 'price', message: 'price_invalid' })

      const categoryPath = (it as any).categoryPath as string[] | null
      if (!categoryPath || categoryPath.length === 0) {
        errors.push({ id: it.id, field: 'categoryPath', message: 'category_required' })
      } else {
        const gId = await getGoogleCategoryIdForItem(tenantId, categoryPath)
        if (!gId) errors.push({ id: it.id, field: 'googleCategoryId', message: 'category_unmapped' })
      }

      // Enhanced validations
      const image = (it as any).primaryImageUrl || (Array.isArray((it as any).images) ? (it as any).images[0] : null)
      if (!image) warnings.push({ id: it.id, field: 'image', message: 'image_recommended' })

      const availability = (it as any).availability // expected: 'in_stock' | 'out_of_stock' | 'preorder'
      if (!availability) warnings.push({ id: it.id, field: 'availability', message: 'availability_recommended' })

      const condition = (it as any).condition // expected: 'new' | 'used' | 'refurbished'
      if (!condition) warnings.push({ id: it.id, field: 'condition', message: 'condition_recommended' })

      // Identifier rules: provide at least brand+mpn or gtin
      const brand = (it as any).brand
      const gtin = (it as any).gtin
      const mpn = (it as any).mpn
      const hasIdentifiers = (gtin && String(gtin).trim().length > 0) || (brand && mpn)
      if (!hasIdentifiers) warnings.push({ id: it.id, field: 'identifiers', message: 'provide_gtin_or_brand_mpn' })
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
    const where: any = { tenantId }
    if (!opts.includeInactive) where.itemStatus = 'active'
    const take = opts.limit ?? 1000

    const items = await prisma.inventoryItem.findMany({ where, take })

    const output = [] as any[]
    for (const it of items) {
      const categoryPath = (it as any).categoryPath as string[] | null
      const googleCategoryId = await getGoogleCategoryIdForItem(tenantId, categoryPath)
      output.push({
        id: it.id,
        offerId: normalizeSku((it as any).sku) || it.id,
        title: (it as any).name || '',
        description: (it as any).description || '',
        price: (it as any).price,
        brand: (it as any).brand || null,
        gtin: (it as any).gtin || null,
        mpn: (it as any).mpn || null,
        googleProductCategory: googleCategoryId,
        categoryPath,
        link: (it as any).productUrl || null,
        imageLink: ((it as any).primaryImageUrl || null)
      })
    }

    res.json({ success: true, data: { total: output.length, items: output } })
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ success: false, error: 'invalid_request', details: e.issues })
    res.status(500).json({ success: false, error: 'serialize_failed' })
  }
})

export default router
