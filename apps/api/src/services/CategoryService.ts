import { prisma } from '../prisma'
import { audit } from '../audit'
import { triggerRevalidate } from '../utils/revalidate'

export type UpdateCategoryInput = Partial<{
  name: string
  slug: string
  parentId: string | null
  googleCategoryId: string | null
  sortOrder: number
}>

export const categoryService = {
  async createTenantCategory(tenantId: string, input: Required<Pick<UpdateCategoryInput, 'name' | 'slug'>> & Partial<UpdateCategoryInput>) {
    const category = await prisma.tenantCategory.create({
      data: {
        tenantId,
        name: input.name,
        slug: input.slug,
        parentId: input.parentId ?? undefined,
        googleCategoryId: input.googleCategoryId ?? undefined,
        sortOrder: input.sortOrder ?? 0,
      },
    })

    try {
      await audit({
        tenantId,
        actor: null,
        action: 'category.create',
        payload: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          parentId: category.parentId,
          googleCategoryId: category.googleCategoryId,
        },
      })
    } catch {}

    triggerRevalidate(tenantId).catch(() => {})
    return category
  },

  async updateTenantCategory(tenantId: string, id: string, input: UpdateCategoryInput) {
    const category = await prisma.tenantCategory.update({ where: { id }, data: input })
    try {
      await audit({
        tenantId,
        actor: null,
        action: 'category.update',
        payload: { id, delta: input },
      })
    } catch {}
    triggerRevalidate(tenantId).catch(() => {})
    return category
  },

  async softDeleteTenantCategory(tenantId: string, id: string) {
    const category = await prisma.tenantCategory.update({ where: { id }, data: { isActive: false } })
    try {
      await audit({ tenantId, actor: null, action: 'category.delete', payload: { id } })
    } catch {}
    triggerRevalidate(tenantId).catch(() => {})
    return category
  },

  async alignCategory(tenantId: string, id: string, googleCategoryId: string) {
    const category = await prisma.tenantCategory.update({ where: { id }, data: { googleCategoryId } })
    try {
      await audit({ tenantId, actor: null, action: 'category.align', payload: { id, googleCategoryId } })
    } catch {}
    triggerRevalidate(tenantId).catch(() => {})
    return category
  },

  async assignItemCategory(
    tenantId: string,
    itemId: string,
    opts: { tenantCategoryId?: string; categorySlug?: string }
  ) {
    const { tenantCategoryId, categorySlug } = opts
    if (!tenantCategoryId && !categorySlug) {
      throw Object.assign(new Error('tenantCategoryId_or_categorySlug_required'), { statusCode: 400 })
    }

    const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, tenantId } })
    if (!item) {
      throw Object.assign(new Error('item_not_found'), { statusCode: 404 })
    }

    const category = await prisma.tenantCategory.findFirst({
      where: {
        tenantId,
        isActive: true,
        ...(tenantCategoryId ? { id: tenantCategoryId } : {}),
        ...(categorySlug ? { slug: categorySlug } : {}),
      },
    })
    if (!category) {
      throw Object.assign(new Error('tenant_category_not_found'), { statusCode: 404 })
    }

    const updated = await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { 
        tenantCategoryId: category.id,
        categoryPath: [category.slug] as any, // Keep for backward compatibility
      },
    })

    try {
      await audit({
        tenantId,
        actor: null,
        action: 'item.category.assign',
        payload: {
          itemId,
          tenantCategoryId: tenantCategoryId ?? null,
          categorySlug: categorySlug ?? null,
        },
      })
    } catch {}

    triggerRevalidate(tenantId).catch(() => {})
    return updated
  },
}
