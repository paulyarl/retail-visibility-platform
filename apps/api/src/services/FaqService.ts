/**
 * FAQ Service
 *
 * CRUD operations for FAQs, categories, and product links.
 * Tenant-scoped with proper relations.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

export interface CreateFAQInput {
  tenant_id: string;
  category_id: string | null;
  question: string;
  answer: string;
  scope: 'storefront' | 'product';
  status: 'draft' | 'active' | 'archived';
  tags?: string[];
  display_order?: number;
  product_ids?: string[];
}

export interface UpdateFAQInput {
  category_id?: string;
  question?: string;
  answer?: string;
  scope?: 'storefront' | 'product';
  status?: 'draft' | 'active' | 'archived';
  tags?: string[];
  display_order?: number;
  product_ids?: string[];
}

export interface CreateCategoryInput {
  tenant_id: string;
  name: string;
  display_order?: number;
}

class FaqService {
  private static instance: FaqService;

  private constructor() {}

  static getInstance(): FaqService {
    if (!FaqService.instance) {
      FaqService.instance = new FaqService();
    }
    return FaqService.instance;
  }

  // ====================
  // FAQ CRUD
  // ====================

  async listFAQs(tenantId: string, filters?: { scope?: string; status?: string; categoryId?: string; search?: string }) {
    const where: any = { tenant_id: tenantId };
    if (filters?.scope) where.scope = filters.scope;
    if (filters?.status) where.status = filters.status;
    if (filters?.categoryId) where.category_id = filters.categoryId;
    if (filters?.search) {
      where.OR = [
        { question: { contains: filters.search, mode: 'insensitive' } },
        { answer: { contains: filters.search, mode: 'insensitive' } },
        { tags: { has: filters.search } },
      ];
    }

    return prisma.faqs.findMany({
      where,
      include: {
        faq_categories: { select: { id: true, name: true } },
        faq_product_links: { select: { product_id: true, inherit_storefront: true } },
      },
      orderBy: [
        { display_order: 'asc' },
        { created_at: 'desc' },
      ],
    });
  }

  async getFAQById(faqId: string, tenantId: string) {
    return prisma.faqs.findFirst({
      where: { id: faqId, tenant_id: tenantId },
      include: {
        faq_categories: { select: { id: true, name: true } },
        faq_product_links: { select: { product_id: true, inherit_storefront: true } },
      },
    });
  }

  async createFAQ(data: CreateFAQInput) {
    const { product_ids, ...faqData } = data;

    const faq = await prisma.faqs.create({
      data: faqData,
      include: {
        faq_categories: { select: { id: true, name: true } },
        faq_product_links: true,
      },
    });

    if (product_ids && product_ids.length > 0) {
      await prisma.faq_product_links.createMany({
        data: product_ids.map(pid => ({
          faq_id: faq.id,
          product_id: pid,
        })),
        skipDuplicates: true,
      });
    }

    return this.getFAQById(faq.id, data.tenant_id);
  }

  async updateFAQ(faqId: string, tenantId: string, data: UpdateFAQInput) {
    const { product_ids, ...faqData } = data;

    const updated = await prisma.faqs.updateMany({
      where: { id: faqId, tenant_id: tenantId },
      data: {
        ...faqData,
        updated_at: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new Error('FAQ not found or not owned by tenant');
    }

    if (product_ids !== undefined) {
      await prisma.faq_product_links.deleteMany({ where: { faq_id: faqId } });
      if (product_ids.length > 0) {
        await prisma.faq_product_links.createMany({
          data: product_ids.map(pid => ({
            faq_id: faqId,
            product_id: pid,
          })),
          skipDuplicates: true,
        });
      }
    }

    return this.getFAQById(faqId, tenantId);
  }

  async deleteFAQ(faqId: string, tenantId: string) {
    const result = await prisma.faqs.deleteMany({
      where: { id: faqId, tenant_id: tenantId },
    });
    return result.count > 0;
  }

  async reorderFAQs(tenantId: string, faqOrders: { id: string; display_order: number }[]) {
    await Promise.all(
      faqOrders.map(({ id, display_order }) =>
        prisma.faqs.updateMany({
          where: { id, tenant_id: tenantId },
          data: { display_order },
        })
      )
    );
    return true;
  }

  async bulkUpdateStatus(tenantId: string, faqIds: string[], status: 'draft' | 'active' | 'archived') {
    const result = await prisma.faqs.updateMany({
      where: { id: { in: faqIds }, tenant_id: tenantId },
      data: { status, updated_at: new Date() },
    });
    return result.count;
  }

  async bulkDelete(tenantId: string, faqIds: string[]) {
    const result = await prisma.faqs.deleteMany({
      where: { id: { in: faqIds }, tenant_id: tenantId },
    });
    return result.count;
  }

  // ====================
  // Categories
  // ====================

  async listCategories(tenantId: string) {
    return prisma.faq_categories.findMany({
      where: { tenant_id: tenantId },
      orderBy: { display_order: 'asc' },
    });
  }

  async createCategory(data: CreateCategoryInput) {
    return prisma.faq_categories.create({
      data: {
        tenant_id: data.tenant_id,
        name: data.name,
        display_order: data.display_order ?? 0,
      },
    });
  }

  async updateCategory(categoryId: string, tenantId: string, data: { name?: string; display_order?: number }) {
    return prisma.faq_categories.updateMany({
      where: { id: categoryId, tenant_id: tenantId },
      data: { ...data, updated_at: new Date() },
    });
  }

  async deleteCategory(categoryId: string, tenantId: string) {
    const result = await prisma.faq_categories.deleteMany({
      where: { id: categoryId, tenant_id: tenantId },
    });
    return result.count > 0;
  }

  // ====================
  // Product-scoped FAQs
  // ====================

  async listProductFAQs(tenantId: string, productId: string) {
    const productLinks = await prisma.faq_product_links.findMany({
      where: { product_id: productId },
      include: {
        faqs: {
          include: {
            faq_categories: { select: { id: true, name: true } },
          },
        },
      },
    });

    return productLinks.map(link => link.faqs);
  }

  // ====================
  // Templates
  // ====================

  async listGlobalTemplates() {
    return prisma.faq_templates.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
    });
  }

  async getTemplate(templateId: string) {
    return prisma.faq_templates.findUnique({
      where: { id: templateId },
    });
  }

  async applyTemplate(tenantId: string, templateId: string, selectedPairs?: number[]) {
    const template = await this.getTemplate(templateId);
    if (!template) throw new Error('Template not found');

    const pairs = (template.pairs as any[] || []);
    const pairsToApply = selectedPairs
      ? selectedPairs.map(i => pairs[i]).filter(Boolean)
      : pairs;

    if (pairsToApply.length === 0) {
      return { created: 0, skipped: 0 };
    }

    // Get or create "General" category
    let generalCategory = await prisma.faq_categories.findFirst({
      where: { tenant_id: tenantId, name: 'General' },
    });

    if (!generalCategory) {
      generalCategory = await prisma.faq_categories.create({
        data: { tenant_id: tenantId, name: 'General', display_order: 0 },
      });
    }

    let created = 0;
    let skipped = 0;

    for (const pair of pairsToApply) {
      if (!pair?.question || !pair?.answer) {
        skipped++;
        continue;
      }

      // Check for duplicate question
      const existing = await prisma.faqs.findFirst({
        where: { tenant_id: tenantId, question: pair.question },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.faqs.create({
        data: {
          tenant_id: tenantId,
          category_id: generalCategory.id,
          question: pair.question,
          answer: pair.answer,
          scope: 'storefront',
          status: 'draft',
          tags: pair.tags || [],
        },
      });
      created++;
    }

    return { created, skipped };
  }

  // ====================
  // Public Display
  // ====================

  async getPublicStorefrontFAQs(tenantId: string) {
    return prisma.faqs.findMany({
      where: {
        tenant_id: tenantId,
        scope: 'storefront',
        status: 'active',
      },
      include: {
        faq_categories: { select: { id: true, name: true, display_order: true } },
      },
      orderBy: [
        { faq_categories: { display_order: 'asc' } },
        { display_order: 'asc' },
      ],
    });
  }

  async getPublicProductFAQs(tenantId: string, productId: string) {
    // Product-scoped FAQs
    const productLinks = await prisma.faq_product_links.findMany({
      where: { product_id: productId },
      include: {
        faqs: {
          include: { faq_categories: { select: { id: true, name: true } } },
        },
      },
    });

    const productFAQs = productLinks
      .filter(link => link.faqs.status === 'active')
      .map(link => link.faqs);

    // Check if any link has inherit_storefront
    const hasInherit = productLinks.some(link => link.inherit_storefront);

    let storefrontFAQs: any[] = [];
    if (hasInherit || productFAQs.length === 0) {
      storefrontFAQs = await prisma.faqs.findMany({
        where: {
          tenant_id: tenantId,
          scope: 'storefront',
          status: 'active',
        },
        include: {
          faq_categories: { select: { id: true, name: true, display_order: true } },
        },
        orderBy: [
          { faq_categories: { display_order: 'asc' } },
          { display_order: 'asc' },
        ],
        take: 3,
      });
    }

    return { productFAQs, storefrontFAQs };
  }

  // ====================
  // Feedback
  // ====================

  async submitFeedback(
    tenantId: string,
    faqId: string,
    type: string,
    data?: { comment?: string; email?: string; ipAddress?: string }
  ): Promise<any> {
    return prisma.faq_feedback.create({
      data: {
        faq_id: faqId,
        tenant_id: tenantId,
        type,
        comment: data?.comment || null,
        email: data?.email || null,
        ip_address: data?.ipAddress || null,
      },
    });
  }

  async getFeedbackSummary(tenantId: string, faqId: string): Promise<{ up: number; down: number; suggestEdit: number }> {
    const counts = await prisma.faq_feedback.groupBy({
      by: ['type'],
      where: { tenant_id: tenantId, faq_id: faqId },
      _count: { type: true },
    });
    const result = { up: 0, down: 0, suggestEdit: 0 };
    for (const row of counts) {
      if (row.type === 'up') result.up = row._count.type;
      else if (row.type === 'down') result.down = row._count.type;
      else if (row.type === 'suggest_edit') result.suggestEdit = row._count.type;
    }
    return result;
  }
}

export default FaqService;
