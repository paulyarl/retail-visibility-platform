/**
 * PlatformServiceFulfillmentService
 *
 * Orchestrates CRM object creation when a platform service is purchased.
 * Called fire-and-forget from bsaas-purchases.ts after successful purchase.
 *
 * Creates:
 *  1. CRM ticket (category: 'platform_service') — tracks fulfillment status
 *  2. CRM tasks — one per workflow step with due dates
 *  3. CRM alert — notifies merchant that service has started
 *
 * All CRM objects use existing tables and services — no new tables needed.
 */

import { BaseService } from './BaseService';
import { CrmTicketService } from './CrmTicketService';
import { CrmTaskService } from './CrmTaskService';
import { CrmAlertService } from './CrmAlertService';
import { logger } from '../logger';

interface ServiceFulfillmentParams {
  tenantId: string;
  featureKey: string;
  serviceName: string;
  purchaseId: string;
  priceCents: number;
}

interface WorkflowStep {
  title: string;
  description: string;
  dueDays: number;
}

const SERVICE_WORKFLOW_TEMPLATES: Record<string, WorkflowStep[]> = {
  logo_design: [
    { title: 'Collect logo requirements', description: 'Gather brand info, style preferences, color palette from merchant', dueDays: 1 },
    { title: 'Design initial logo concepts', description: 'Create 3 logo concepts for merchant review', dueDays: 3 },
    { title: 'Client review and feedback', description: 'Send concepts to merchant, collect feedback', dueDays: 5 },
    { title: 'Final logo delivery', description: 'Deliver final logo in multiple formats (PNG, SVG, PDF)', dueDays: 7 },
  ],
  banner_design: [
    { title: 'Collect banner requirements', description: 'Gather dimensions, messaging, brand assets', dueDays: 1 },
    { title: 'Design banner drafts', description: 'Create 2 banner variations for review', dueDays: 2 },
    { title: 'Client review and feedback', description: 'Send drafts to merchant, collect feedback', dueDays: 4 },
    { title: 'Final banner delivery', description: 'Deliver final banner in required formats', dueDays: 5 },
  ],
  store_setup: [
    { title: 'Store audit and planning', description: 'Review current store config, plan setup steps', dueDays: 1 },
    { title: 'Configure storefront settings', description: 'Set up layout, hours, contact info, policies', dueDays: 3 },
    { title: 'Product catalog setup', description: 'Assist with initial product creation and categorization', dueDays: 5 },
    { title: 'Final review and handoff', description: 'Walk merchant through completed setup, provide documentation', dueDays: 7 },
  ],
  profile_setup: [
    { title: 'Profile audit', description: 'Review existing profile, identify gaps', dueDays: 1 },
    { title: 'Profile optimization', description: 'Update business info, photos, descriptions for SEO', dueDays: 2 },
    { title: 'Final review', description: 'Merchant reviews optimized profile', dueDays: 3 },
  ],
  seo_optimization: [
    { title: 'SEO audit', description: 'Analyze current SEO state, identify opportunities', dueDays: 2 },
    { title: 'On-page optimization', description: 'Optimize meta tags, headings, content, images', dueDays: 4 },
    { title: 'Local SEO setup', description: 'Configure Google Business Profile, local citations', dueDays: 6 },
    { title: 'Final report and handoff', description: 'Deliver SEO report with recommendations', dueDays: 7 },
  ],
  social_media_kit: [
    { title: 'Collect brand assets', description: 'Gather logo, colors, fonts, brand guidelines', dueDays: 1 },
    { title: 'Create template designs', description: 'Design social media templates for each platform', dueDays: 3 },
    { title: 'Final kit delivery', description: 'Deliver social media kit with usage guide', dueDays: 5 },
  ],
};

export class PlatformServiceFulfillmentService extends BaseService {
  private static instance: PlatformServiceFulfillmentService;

  private constructor() { super(); }

  static getInstance(): PlatformServiceFulfillmentService {
    if (!PlatformServiceFulfillmentService.instance) {
      PlatformServiceFulfillmentService.instance = new PlatformServiceFulfillmentService();
    }
    return PlatformServiceFulfillmentService.instance;
  }

  async createFulfillmentWorkflow(params: ServiceFulfillmentParams): Promise<void> {
    const { tenantId, featureKey, serviceName, purchaseId, priceCents } = params;
    const serviceType = featureKey.replace('platform_service_', '');
    const workflow = SERVICE_WORKFLOW_TEMPLATES[serviceType] || [];
    const ticketService = CrmTicketService.getInstance();
    const taskService = CrmTaskService.getInstance();
    const alertService = CrmAlertService.getInstance();

    logger.info('[PlatformServices] Creating fulfillment workflow', undefined, {
      tenantId,
      featureKey,
      serviceType,
      workflowSteps: workflow.length,
    });

    // 1. Create CRM ticket for the service fulfillment
    const ticket = await ticketService.create({
      tenant_id: tenantId,
      title: `Platform Service: ${serviceName}`,
      description: `Service purchased via Feature Store.\n\nService: ${serviceName}\nFeature Key: ${featureKey}\nPurchase ID: ${purchaseId}\nPrice: $${(priceCents / 100).toFixed(2)}\n\nFulfillment workflow has been auto-created with ${workflow.length} tasks.`,
      priority: 'medium',
      category: 'platform_service',
    });

    // 2. Create workflow tasks
    for (let i = 0; i < workflow.length; i++) {
      const step = workflow[i];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + step.dueDays);

      await taskService.create({
        tenant_id: tenantId,
        title: step.title,
        description: step.description,
        priority: i === 0 ? 'high' : 'medium',
        due_date: dueDate,
        created_by: 'system',
      });
    }

    // 3. Create merchant alert
    await alertService.create({
      tenant_id: tenantId,
      type: 'platform_service',
      title: `Service started: ${serviceName}`,
      body: `Your "${serviceName}" service has been initiated. Our team will begin working on it shortly. You can track progress in your CRM portal.`,
      icon: '🎨',
      metadata: {
        feature_key: featureKey,
        purchase_id: purchaseId,
        ticket_id: ticket.id,
        service_type: serviceType,
        price_cents: priceCents,
      },
    });

    logger.info('[PlatformServices] Fulfillment workflow created', undefined, {
      tenantId,
      featureKey,
      ticketId: ticket.id,
      tasksCreated: workflow.length,
    });
  }
}

export default PlatformServiceFulfillmentService;
