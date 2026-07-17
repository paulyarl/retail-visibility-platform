import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import CrmOptionsService from '../services/CrmOptionsService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { logger } from '../logger';

const router = Router();

// Validation schema
const crmOptionsSettingsSchema = z.object({
  crm_enabled: z.boolean().optional(),
  crm_inquiry_product_enabled: z.boolean().optional(),
  crm_inquiry_storefront_enabled: z.boolean().optional(),
  crm_inquiry_directory_enabled: z.boolean().optional(),
  crm_inquiry_anonymous: z.boolean().optional(),
  crm_inquiry_customer: z.boolean().optional(),
  crm_inquiry_assignment: z.boolean().optional(),
  crm_inquiry_auto_response: z.boolean().optional(),
  crm_contact_management: z.boolean().optional(),
  crm_contact_import: z.boolean().optional(),
  crm_contact_sync: z.boolean().optional(),
  crm_ticket_priority: z.boolean().optional(),
  crm_ticket_assignment: z.boolean().optional(),
  crm_ticket_templates: z.boolean().optional(),
  crm_ticket_escalation: z.boolean().optional(),
  crm_message_rich_text: z.boolean().optional(),
  crm_message_attachments: z.boolean().optional(),
  crm_message_templates: z.boolean().optional(),
  crm_customer_tickets: z.boolean().optional(),
  crm_dashboard_analytics: z.boolean().optional(),
  crm_requests_hub: z.boolean().optional(),
});

// Default settings — core features on, advanced features off
const DEFAULT_SETTINGS = {
  crm_enabled: true,
  crm_inquiry_product_enabled: true,
  crm_inquiry_storefront_enabled: true,
  crm_inquiry_directory_enabled: true,
  crm_inquiry_anonymous: true,
  crm_inquiry_customer: true,
  crm_inquiry_assignment: true,
  crm_inquiry_auto_response: false,
  crm_contact_management: true,
  crm_contact_import: false,
  crm_contact_sync: false,
  crm_ticket_priority: true,
  crm_ticket_assignment: true,
  crm_ticket_templates: false,
  crm_ticket_escalation: false,
  crm_message_rich_text: false,
  crm_message_attachments: false,
  crm_message_templates: false,
  crm_customer_tickets: false,
  crm_dashboard_analytics: false,
  crm_requests_hub: false,
};

const CRM_FEATURE_KEYS = [
  'crm_enabled',
  'crm_inquiry_product_enabled',
  'crm_inquiry_storefront_enabled',
  'crm_inquiry_directory_enabled',
  'crm_inquiry_anonymous',
  'crm_inquiry_customer',
  'crm_inquiry_assignment',
  'crm_inquiry_auto_response',
  'crm_contact_management',
  'crm_contact_import',
  'crm_contact_sync',
  'crm_ticket_priority',
  'crm_ticket_assignment',
  'crm_ticket_templates',
  'crm_ticket_escalation',
  'crm_message_rich_text',
  'crm_message_attachments',
  'crm_message_templates',
  'crm_customer_tickets',
  'crm_dashboard_analytics',
  'crm_requests_hub',
] as const;

// Get CRM options settings for a tenant
router.get('/:tenantId/crm-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const crmService = CrmOptionsService.getInstance();
    const tierState = await crmService.resolveCrmOptionsState(tenantId);

    if (!tierState.enabled) {
      const allOff: Record<string, boolean> = {};
      for (const key of CRM_FEATURE_KEYS) { allOff[key] = false; }
      return res.json({ success: true, settings: allOff, tierState });
    }

    const merchantPrefs = await prisma.tenant_crm_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    const tierFilteredSettings: Record<string, boolean> = {
      crm_enabled: !!rawSettings.crm_enabled && tierState.enabled,
    };

    // Inquiry scope gates
    const inquiryScopeKeys = ['crm_inquiry_product_enabled', 'crm_inquiry_storefront_enabled', 'crm_inquiry_directory_enabled'] as const;
    for (const key of inquiryScopeKeys) {
      let isAllowed = false;
      if (key === 'crm_inquiry_product_enabled') isAllowed = tierState.inquiryProductEnabled;
      else if (key === 'crm_inquiry_storefront_enabled') isAllowed = tierState.inquiryStorefrontEnabled;
      else if (key === 'crm_inquiry_directory_enabled') isAllowed = tierState.inquiryDirectoryEnabled;
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }

    // Inquiry features
    const inquiryKeys = ['crm_inquiry_anonymous', 'crm_inquiry_customer', 'crm_inquiry_assignment', 'crm_inquiry_auto_response'] as const;
    for (const key of inquiryKeys) {
      const isAllowed = tierState.isFlexible || tierState.allowedInquiryTypes.includes(key as any);
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }

    // Contact features
    const contactKeys = ['crm_contact_management', 'crm_contact_import', 'crm_contact_sync'] as const;
    for (const key of contactKeys) {
      const isAllowed = tierState.isFlexible || tierState.allowedContactTypes.includes(key as any);
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }

    // Ticket features
    const ticketKeys = ['crm_ticket_priority', 'crm_ticket_assignment', 'crm_ticket_templates', 'crm_ticket_escalation'] as const;
    for (const key of ticketKeys) {
      const isAllowed = tierState.isFlexible || tierState.allowedTicketTypes.includes(key as any);
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }

    // Message features
    const messageKeys = ['crm_message_rich_text', 'crm_message_attachments', 'crm_message_templates'] as const;
    for (const key of messageKeys) {
      const isAllowed = tierState.isFlexible || tierState.allowedMessageTypes.includes(key as any);
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }

    // Customer ticket portal
    tierFilteredSettings.crm_customer_tickets = (tierState.isFlexible || tierState.allowedCustomerTicketTypes.includes('crm_customer_tickets')) ? !!rawSettings.crm_customer_tickets : false;

    // Dashboard features
    const dashboardKeys = ['crm_dashboard_analytics', 'crm_requests_hub'] as const;
    for (const key of dashboardKeys) {
      const isAllowed = tierState.isFlexible || tierState.allowedDashboardTypes.includes(key as any);
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }

    res.json({ success: true, settings: tierFilteredSettings, tierState });
  } catch (error) {
    logger.error('Error fetching CRM options settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch CRM options settings' });
  }
});

// Update CRM options settings for a tenant
router.put('/:tenantId/crm-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const validationResult = crmOptionsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: 'validation_error', message: 'Invalid CRM options settings data', details: validationResult.error.issues });
    }

    const data = validationResult.data;
    const crmService = CrmOptionsService.getInstance();
    const tierState = await crmService.resolveCrmOptionsState(tenantId);

    if (!tierState.enabled) {
      return res.status(403).json({ success: false, error: 'capability_disabled', message: 'CRM options capability is disabled for this tenant\'s tier' });
    }

    const filteredData: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'crm_enabled') { filteredData[key] = value; continue; }

      // Inquiry scope gates
      if (key === 'crm_inquiry_product_enabled') {
        if (tierState.inquiryProductEnabled) { filteredData[key] = value; }
        else if (value === true) { return res.status(403).json({ success: false, error: 'tier_restricted', message: 'Product inquiries are not available on your current plan', feature_key: key }); }
        continue;
      }
      if (key === 'crm_inquiry_storefront_enabled') {
        if (tierState.inquiryStorefrontEnabled) { filteredData[key] = value; }
        else if (value === true) { return res.status(403).json({ success: false, error: 'tier_restricted', message: 'Storefront inquiries are not available on your current plan', feature_key: key }); }
        continue;
      }
      if (key === 'crm_inquiry_directory_enabled') {
        if (tierState.inquiryDirectoryEnabled) { filteredData[key] = value; }
        else if (value === true) { return res.status(403).json({ success: false, error: 'tier_restricted', message: 'Directory inquiries are not available on your current plan', feature_key: key }); }
        continue;
      }

      // Inquiry features
      if (key.startsWith('crm_inquiry_')) {
        const isAllowed = tierState.isFlexible || tierState.allowedInquiryTypes.includes(key as any);
        if (isAllowed) { filteredData[key] = value; }
        else if (value === true) { return res.status(403).json({ success: false, error: 'tier_restricted', message: `Inquiry feature '${key}' is not available on your current plan`, feature_key: key }); }
        continue;
      }

      // Contact features
      if (key.startsWith('crm_contact_')) {
        const isAllowed = tierState.isFlexible || tierState.allowedContactTypes.includes(key as any);
        if (isAllowed) { filteredData[key] = value; }
        else if (value === true) { return res.status(403).json({ success: false, error: 'tier_restricted', message: `Contact feature '${key}' is not available on your current plan`, feature_key: key }); }
        continue;
      }

      // Ticket features
      if (key.startsWith('crm_ticket_')) {
        const isAllowed = tierState.isFlexible || tierState.allowedTicketTypes.includes(key as any);
        if (isAllowed) { filteredData[key] = value; }
        else if (value === true) { return res.status(403).json({ success: false, error: 'tier_restricted', message: `Ticket feature '${key}' is not available on your current plan`, feature_key: key }); }
        continue;
      }

      // Message features
      if (key.startsWith('crm_message_')) {
        const isAllowed = tierState.isFlexible || tierState.allowedMessageTypes.includes(key as any);
        if (isAllowed) { filteredData[key] = value; }
        else if (value === true) { return res.status(403).json({ success: false, error: 'tier_restricted', message: `Message feature '${key}' is not available on your current plan`, feature_key: key }); }
        continue;
      }

      // Customer ticket portal
      if (key === 'crm_customer_tickets') {
        const isAllowed = tierState.isFlexible || tierState.allowedCustomerTicketTypes.includes('crm_customer_tickets');
        if (isAllowed) { filteredData[key] = value; }
        else if (value === true) { return res.status(403).json({ success: false, error: 'tier_restricted', message: 'Customer support tickets are not available on your current plan', feature_key: key }); }
        continue;
      }

      // Dashboard features
      if (key.startsWith('crm_dashboard_') || key === 'crm_requests_hub') {
        const isAllowed = tierState.isFlexible || tierState.allowedDashboardTypes.includes(key as any);
        if (isAllowed) { filteredData[key] = value; }
        else if (value === true) { return res.status(403).json({ success: false, error: 'tier_restricted', message: `Dashboard feature '${key}' is not available on your current plan`, feature_key: key }); }
        continue;
      }
    }

    const existing = await prisma.tenant_crm_options_settings.findUnique({ where: { tenant_id: tenantId } });
    let settings;
    if (existing) {
      settings = await prisma.tenant_crm_options_settings.update({
        where: { tenant_id: tenantId },
        data: { ...filteredData, updated_at: new Date() },
      });
    } else {
      settings = await prisma.tenant_crm_options_settings.create({
        data: { id: `cos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, tenant_id: tenantId, ...filteredData },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        crm_enabled: settings.crm_enabled,
        crm_inquiry_product_enabled: settings.crm_inquiry_product_enabled,
        crm_inquiry_storefront_enabled: settings.crm_inquiry_storefront_enabled,
        crm_inquiry_directory_enabled: settings.crm_inquiry_directory_enabled,
        crm_inquiry_anonymous: settings.crm_inquiry_anonymous,
        crm_inquiry_customer: settings.crm_inquiry_customer,
        crm_inquiry_assignment: settings.crm_inquiry_assignment,
        crm_inquiry_auto_response: settings.crm_inquiry_auto_response,
        crm_contact_management: settings.crm_contact_management,
        crm_contact_import: settings.crm_contact_import,
        crm_contact_sync: settings.crm_contact_sync,
        crm_ticket_priority: settings.crm_ticket_priority,
        crm_ticket_assignment: settings.crm_ticket_assignment,
        crm_ticket_templates: settings.crm_ticket_templates,
        crm_ticket_escalation: settings.crm_ticket_escalation,
        crm_message_rich_text: settings.crm_message_rich_text,
        crm_message_attachments: settings.crm_message_attachments,
        crm_message_templates: settings.crm_message_templates,
        crm_customer_tickets: settings.crm_customer_tickets,
        crm_dashboard_analytics: settings.crm_dashboard_analytics,
        crm_requests_hub: settings.crm_requests_hub,
      },
    });
  } catch (error) {
    logger.error('Error updating CRM options settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update CRM options settings' });
  }
});

// Public endpoint — Get CRM options settings for storefront
// DEPRECATED: Use GET /api/tenants/:tenantId/effective-capabilities instead
router.get('/public/tenant/:tenantId/crm-options', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.warn(`[DEPRECATION] GET /public/tenant/${tenantId}/crm-options is deprecated. Use /api/tenants/${tenantId}/effective-capabilities instead.`);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString());

    const crmService = CrmOptionsService.getInstance();
    const tierState = await crmService.resolveCrmOptionsState(tenantId);

    if (!tierState.enabled) {
      const allOff: Record<string, boolean> = {};
      for (const key of CRM_FEATURE_KEYS) { allOff[key] = false; }
      return res.json({ success: true, settings: allOff, tierState });
    }

    const merchantPrefs = await prisma.tenant_crm_options_settings.findUnique({ where: { tenant_id: tenantId } });
    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    const publicSettings: Record<string, boolean> = {
      crm_enabled: !!rawSettings.crm_enabled && tierState.enabled,
      crm_inquiry_product_enabled: tierState.inquiryProductEnabled ? !!rawSettings.crm_inquiry_product_enabled : false,
      crm_inquiry_storefront_enabled: tierState.inquiryStorefrontEnabled ? !!rawSettings.crm_inquiry_storefront_enabled : false,
      crm_inquiry_directory_enabled: tierState.inquiryDirectoryEnabled ? !!rawSettings.crm_inquiry_directory_enabled : false,
      crm_inquiry_anonymous: (tierState.isFlexible || tierState.allowedInquiryTypes.includes('crm_inquiry_anonymous')) ? !!rawSettings.crm_inquiry_anonymous : false,
      crm_inquiry_customer: (tierState.isFlexible || tierState.allowedInquiryTypes.includes('crm_inquiry_customer')) ? !!rawSettings.crm_inquiry_customer : false,
    };

    res.json({ success: true, settings: publicSettings, tierState });
  } catch (error) {
    logger.error('Error fetching public CRM options settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch CRM options settings' });
  }
});

// Get CRM options capability state for a tenant
router.get('/:tenantId/crm-options/capability', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const crmService = CrmOptionsService.getInstance();
    const state = await crmService.resolveCrmOptionsState(tenantId);
    res.json({ success: true, capability: state });
  } catch (error) {
    logger.error('Error resolving CRM options capability:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to resolve CRM options capability' });
  }
});

export default router;
