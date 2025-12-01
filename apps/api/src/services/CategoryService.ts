import { prisma } from '../prisma'
import { audit } from '../audit'
import { triggerRevalidate } from '../utils/revalidate'
import { generateQuickStart } from '../lib/id-generator'

export type UpdateCategoryInput = Partial<{
  name: string
  slug: string
  parentId: string | null
  googleCategoryId: string | null
  sortOrder: number
}>

export const categoryService = {
  async getTenantCategories(tenantId: string) {
    const categories = await prisma.directoryCategory.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    })
    return categories
  },

  async createTenantCategory(tenantId: string, input: Required<Pick<UpdateCategoryInput, 'name' | 'slug'>> & Partial<UpdateCategoryInput>) {
    const category = await prisma.directoryCategory.create({
      data: {
        id: generateQuickStart("tc"),
        tenantId,
        name: input.name,
        slug: input.slug,
        parentId: input.parentId ?? undefined,
        googleCategoryId: input.googleCategoryId ?? undefined,
        sortOrder: input.sortOrder ?? 0,
        updatedAt: new Date(),
      } as any,
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

  async updateDirectoryCategory(tenantId: string, id: string, input: UpdateCategoryInput) {
    const category = await prisma.directoryCategory.update({ where: { id }, data: input })
    return category
  },

  async softDeleteDirectoryCategory(tenantId: string, id: string) {
    const category = await prisma.directoryCategory.update({ where: { id }, data: { isActive: false } })
    return category
  },

  async alignCategory(tenantId: string, id: string, googleCategoryId: string) {
    const category = await prisma.directoryCategory.update({ where: { id }, data: { googleCategoryId } })
    try {
      await audit({ tenantId, actor: null, action: 'category.align', payload: { id, googleCategoryId } })
    } catch {}
    triggerRevalidate(tenantId).catch(() => {})
    return category
  },

  async assignItemCategory(
    tenantId: string,
    item_id: string,
    opts: { directoryCategoryId?: string; categorySlug?: string }
  ) {
    const { directoryCategoryId, categorySlug } = opts
    if (!directoryCategoryId && !categorySlug) {
      throw Object.assign(new Error('directoryCategoryId_or_categorySlug_required'), { statusCode: 400 })
    }

    let category: { id: string; name: string; slug: string; parentId: string | null } | null = null

    if (directoryCategoryId) {
      category = await prisma.directoryCategory.findFirst({
        where: {
          id: directoryCategoryId,
          isActive: true,
        },
      })
    } else if (categorySlug) {
      category = await prisma.directoryCategory.findFirst({
        where: {
          slug: categorySlug,
          isActive: true,
        },
      })
    }

    if (!category) {
      if (directoryCategoryId) {
        throw Object.assign(new Error('directory_category_not_found'), { statusCode: 404 })
      } else {
        throw Object.assign(new Error('category_not_found'), { statusCode: 404 })
      }
    }

    // Update item with category
    await prisma.inventoryItem.update({
      where: { id: item_id },
      data: {
        directoryCategoryId: category.id,
        categoryPath: [category.slug] as any, // Keep for backward compatibility
      },
    })

    try {
      await audit({
        tenantId,
        actor: null,
        action: 'item.category.assign',
        payload: {
          item_id,
          directoryCategoryId: category.id,
          categorySlug: category.slug,
        },
      })
    } catch {}

    // Get the updated item to return
    const updatedItem = await prisma.inventoryItem.findUnique({
      where: { id: item_id },
      include: {
        directoryCategory: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    triggerRevalidate(tenantId).catch(() => {})
    return updatedItem
  },
}
