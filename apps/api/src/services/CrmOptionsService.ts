/**
 * CRM Options Service
 *
 * Capability-aware service for resolving and managing CRM options.
 * Determines which CRM features are available to a tenant based on their tier capabilities.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEffectiveTier } from '../utils/trial-tier-transparency';

// ====================
// TYPES
// ====================

export type CrmInquiryType =
  | 'crm_inquiry_product_enabled'
  | 'crm_inquiry_storefront_enabled'
  | 'crm_inquiry_directory_enabled'
  | 'crm_inquiry_anonymous'
  | 'crm_inquiry_customer'
  | 'crm_inquiry_assignment'
  | 'crm_inquiry_auto_response';

export type CrmContactType =
  | 'crm_contact_management'
  | 'crm_contact_import'
  | 'crm_contact_sync';

export type CrmTicketType =
  | 'crm_ticket_priority'
  | 'crm_ticket_assignment'
  | 'crm_ticket_templates'
  | 'crm_ticket_escalation';

export type CrmMessageType =
  | 'crm_message_rich_text'
  | 'crm_message_attachments'
  | 'crm_message_templates';

export type CrmCustomerTicketType =
  | 'crm_customer_tickets';

export type CrmDashboardType =
  | 'crm_dashboard_analytics'
  | 'crm_requests_hub';

export const ALL_CRM_INQUIRY_TYPES: CrmInquiryType[] = [
  'crm_inquiry_product_enabled',
  'crm_inquiry_storefront_enabled',
  'crm_inquiry_directory_enabled',
  'crm_inquiry_anonymous',
  'crm_inquiry_customer',
  'crm_inquiry_assignment',
  'crm_inquiry_auto_response',
];

export const ALL_CRM_CONTACT_TYPES: CrmContactType[] = [
  'crm_contact_management',
  'crm_contact_import',
  'crm_contact_sync',
];

export const ALL_CRM_TICKET_TYPES: CrmTicketType[] = [
  'crm_ticket_priority',
  'crm_ticket_assignment',
  'crm_ticket_templates',
  'crm_ticket_escalation',
];

export const ALL_CRM_MESSAGE_TYPES: CrmMessageType[] = [
  'crm_message_rich_text',
  'crm_message_attachments',
  'crm_message_templates',
];

export const ALL_CRM_CUSTOMER_TICKET_TYPES: CrmCustomerTicketType[] = [
  'crm_customer_tickets',
];

export const ALL_CRM_DASHBOARD_TYPES: CrmDashboardType[] = [
  'crm_dashboard_analytics',
  'crm_requests_hub',
];

export interface CrmOptionsState {
  enabled: boolean;
  /** Inquiry scope: product page */
  inquiryProductEnabled: boolean;
  /** Inquiry scope: storefront page */
  inquiryStorefrontEnabled: boolean;
  /** Inquiry scope: directory entry */
  inquiryDirectoryEnabled: boolean;
  /** Contacts management enabled */
  contactsEnabled: boolean;
  /** Ticket sub-features enabled (tickets themselves are always on) */
  ticketFeaturesEnabled: boolean;
  /** Message sub-features enabled */
  messageFeaturesEnabled: boolean;
  /** Customer support tickets (portal) enabled */
  customerTicketsEnabled: boolean;
  /** Dashboard / analytics enabled */
  dashboardEnabled: boolean;
  allowedInquiryTypes: CrmInquiryType[];
  allowedContactTypes: CrmContactType[];
  allowedTicketTypes: CrmTicketType[];
  allowedMessageTypes: CrmMessageType[];
  allowedCustomerTicketTypes: CrmCustomerTicketType[];
  allowedDashboardTypes: CrmDashboardType[];
  isFlexible: boolean;
  crmAvailable: boolean;
  features: Record<string, boolean>;
}

export interface CrmTypeMeta {
  key: string;
  label: string;
  description: string;
  group: 'inquiry' | 'contact' | 'ticket' | 'message' | 'dashboard';
}

const CRM_TYPE_META: Record<string, CrmTypeMeta> = {
  crm_inquiry_product_enabled: { key: 'crm_inquiry_product_enabled', label: 'Product Inquiries', description: 'Receive inquiries from product detail pages', group: 'inquiry' },
  crm_inquiry_storefront_enabled: { key: 'crm_inquiry_storefront_enabled', label: 'Storefront Inquiries', description: 'Receive inquiries from storefront page', group: 'inquiry' },
  crm_inquiry_directory_enabled: { key: 'crm_inquiry_directory_enabled', label: 'Directory Inquiries', description: 'Receive inquiries from directory listing', group: 'inquiry' },
  crm_inquiry_anonymous: { key: 'crm_inquiry_anonymous', label: 'Anonymous Inquiries', description: 'Allow anonymous visitors to submit inquiries', group: 'inquiry' },
  crm_inquiry_customer: { key: 'crm_inquiry_customer', label: 'Customer Inquiries', description: 'Allow logged-in customers to submit inquiries', group: 'inquiry' },
  crm_inquiry_assignment: { key: 'crm_inquiry_assignment', label: 'Inquiry Assignment', description: 'Assign inquiries to team members', group: 'inquiry' },
  crm_inquiry_auto_response: { key: 'crm_inquiry_auto_response', label: 'Auto-Response', description: 'Send automatic acknowledgment on inquiry receipt', group: 'inquiry' },
  crm_contact_management: { key: 'crm_contact_management', label: 'Contact Management', description: 'Manage CRM contacts', group: 'contact' },
  crm_contact_import: { key: 'crm_contact_import', label: 'Contact Import', description: 'Import contacts from CSV', group: 'contact' },
  crm_contact_sync: { key: 'crm_contact_sync', label: 'Contact Sync', description: 'Sync contacts with external systems', group: 'contact' },
  crm_ticket_priority: { key: 'crm_ticket_priority', label: 'Ticket Priority', description: 'Set priority levels on support tickets', group: 'ticket' },
  crm_ticket_assignment: { key: 'crm_ticket_assignment', label: 'Ticket Assignment', description: 'Assign tickets to platform staff', group: 'ticket' },
  crm_ticket_templates: { key: 'crm_ticket_templates', label: 'Ticket Templates', description: 'Use templates for ticket creation', group: 'ticket' },
  crm_ticket_escalation: { key: 'crm_ticket_escalation', label: 'Ticket Escalation', description: 'Auto-escalate tickets based on SLA', group: 'ticket' },
  crm_customer_tickets: { key: 'crm_customer_tickets', label: 'Customer Support Tickets', description: 'Allow customers to create support tickets via portal', group: 'ticket' },
  crm_message_rich_text: { key: 'crm_message_rich_text', label: 'Rich Text Messages', description: 'Rich text formatting in ticket messages', group: 'message' },
  crm_message_attachments: { key: 'crm_message_attachments', label: 'Message Attachments', description: 'Attach files to ticket messages', group: 'message' },
  crm_message_templates: { key: 'crm_message_templates', label: 'Message Templates', description: 'Use templates for message replies', group: 'message' },
  crm_dashboard_analytics: { key: 'crm_dashboard_analytics', label: 'CRM Analytics', description: 'Dashboard analytics and metrics', group: 'dashboard' },
  crm_requests_hub: { key: 'crm_requests_hub', label: 'Requests Hub', description: 'Tenant-facing unified requests inbox', group: 'dashboard' },
};

// ====================
// SERVICE
// ====================

class CrmOptionsService {
  private static instance: CrmOptionsService;
  private constructor() {}

  static getInstance(): CrmOptionsService {
    if (!CrmOptionsService.instance) {
      CrmOptionsService.instance = new CrmOptionsService();
    }
    return CrmOptionsService.instance;
  }

  /**
   * Resolve CRM options state for a tenant from their tier capabilities.
   */
  async resolveCrmOptionsState(tenantId: string): Promise<CrmOptionsState> {
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          subscription_tier: true,
          subscription_status: true,
          organization_id: true,
          organizations_list: {
            select: { subscription_tier: true },
          },
        },
      });

      if (!tenant) {
        logger.warn('[CrmOptionsService] Tenant not found', undefined, { tenantId });
        return this.getDisabledState();
      }

      const orgTierKey = tenant.organizations_list?.subscription_tier || null;
      const tenantTierKey = tenant.subscription_tier || null;
      const resolvedOrgTierKey = orgTierKey ? getEffectiveTier(orgTierKey) : null;
      const resolvedTenantTierKey = tenantTierKey ? getEffectiveTier(tenantTierKey) : null;
      const tierKeys = [resolvedOrgTierKey, resolvedTenantTierKey].filter((k): k is string => !!k);

      if (tierKeys.length === 0) {
        return this.getDisabledState();
      }

      const tiers = await prisma.subscription_tiers_list.findMany({
        where: { tier_key: { in: tierKeys } },
      });
      const tierIds = tiers.map(t => t.id);

      // Primary: query by capability_type_id (robust against feature key typos/spaces)
      // Fallback: query by feature_key prefix if capability type not found
      const crmCapType = await prisma.capability_type_list.findUnique({
        where: { key: 'crm_options' },
      });

      const tierFeatures = await prisma.tier_features_list.findMany({
        where: {
          tier_id: { in: tierIds },
          ...(crmCapType
            ? { capability_type_id: crmCapType.id }
            : { feature_key: { startsWith: 'crm_' } }),
          is_enabled: true,
        },
      });

      const mergedFeatures: Record<string, boolean> = {};
      for (const tf of tierFeatures) {
        // Trim feature_key to handle potential leading/trailing spaces in DB
        const cleanKey = tf.feature_key.trim();
        mergedFeatures[cleanKey] = mergedFeatures[cleanKey] || tf.is_enabled;
      }

      return this.resolveFromFeatures(mergedFeatures);
    } catch (error) {
      logger.error('[CrmOptionsService] Error resolving CRM options state', undefined, { error: (error as Error).message, tenantId });
      return this.getDisabledState();
    }
  }

  /**
   * Resolve CrmOptionsState from a raw feature map.
   */
  resolveFromFeatures(features: Record<string, boolean>): CrmOptionsState {
    const enabled = !!features.crm_enabled;
    const disabled = !!features.crm_disabled;
    const flexible = !!features.crm_flexible;

    // Scope group gates (inquiry channels)
    const inquiryProductEnabled = flexible || !!features.crm_inquiry_product_on || !!features.crm_inquiry_product_enabled;
    const inquiryStorefrontEnabled = flexible || !!features.crm_inquiry_storefront_on || !!features.crm_inquiry_storefront_enabled;
    const inquiryDirectoryEnabled = flexible || !!features.crm_inquiry_directory_on || !!features.crm_inquiry_directory_enabled;

    // Feature group gates
    const contactsEnabled = flexible || !!features.crm_contact_management;
    const ticketFeaturesEnabled = flexible || (!!features.crm_ticket_priority || !!features.crm_ticket_assignment || !!features.crm_ticket_templates || !!features.crm_ticket_escalation);
    const messageFeaturesEnabled = flexible || (!!features.crm_message_rich_text || !!features.crm_message_attachments || !!features.crm_message_templates);
    const customerTicketsEnabled = flexible || !!features.crm_customer_tickets;
    const dashboardEnabled = flexible || (!!features.crm_dashboard_analytics || !!features.crm_requests_hub);

    // Collect allowed types
    const allowedInquiryTypes: CrmInquiryType[] = [];
    if (flexible) {
      allowedInquiryTypes.push(...ALL_CRM_INQUIRY_TYPES);
    } else {
      for (const type of ALL_CRM_INQUIRY_TYPES) {
        if (features[type]) allowedInquiryTypes.push(type);
      }
    }

    const allowedContactTypes: CrmContactType[] = [];
    if (flexible) {
      allowedContactTypes.push(...ALL_CRM_CONTACT_TYPES);
    } else {
      for (const type of ALL_CRM_CONTACT_TYPES) {
        if (features[type]) allowedContactTypes.push(type);
      }
    }

    const allowedTicketTypes: CrmTicketType[] = [];
    if (flexible) {
      allowedTicketTypes.push(...ALL_CRM_TICKET_TYPES);
    } else {
      for (const type of ALL_CRM_TICKET_TYPES) {
        if (features[type]) allowedTicketTypes.push(type);
      }
    }

    const allowedMessageTypes: CrmMessageType[] = [];
    if (flexible) {
      allowedMessageTypes.push(...ALL_CRM_MESSAGE_TYPES);
    } else {
      for (const type of ALL_CRM_MESSAGE_TYPES) {
        if (features[type]) allowedMessageTypes.push(type);
      }
    }

    const allowedCustomerTicketTypes: CrmCustomerTicketType[] = [];
    if (flexible) {
      allowedCustomerTicketTypes.push(...ALL_CRM_CUSTOMER_TICKET_TYPES);
    } else {
      for (const type of ALL_CRM_CUSTOMER_TICKET_TYPES) {
        if (features[type]) allowedCustomerTicketTypes.push(type);
      }
    }

    const allowedDashboardTypes: CrmDashboardType[] = [];
    if (flexible) {
      allowedDashboardTypes.push(...ALL_CRM_DASHBOARD_TYPES);
    } else {
      for (const type of ALL_CRM_DASHBOARD_TYPES) {
        if (features[type]) allowedDashboardTypes.push(type);
      }
    }

    const allTypes = [
      ...allowedInquiryTypes,
      ...allowedContactTypes,
      ...allowedTicketTypes,
      ...allowedMessageTypes,
      ...allowedDashboardTypes,
    ];

    return {
      enabled: enabled && !disabled,
      inquiryProductEnabled: enabled && !disabled && inquiryProductEnabled,
      inquiryStorefrontEnabled: enabled && !disabled && inquiryStorefrontEnabled,
      inquiryDirectoryEnabled: enabled && !disabled && inquiryDirectoryEnabled,
      contactsEnabled: enabled && !disabled && contactsEnabled,
      ticketFeaturesEnabled: enabled && !disabled && ticketFeaturesEnabled,
      messageFeaturesEnabled: enabled && !disabled && messageFeaturesEnabled,
      customerTicketsEnabled: enabled && !disabled && customerTicketsEnabled,
      dashboardEnabled: enabled && !disabled && dashboardEnabled,
      allowedInquiryTypes,
      allowedContactTypes,
      allowedTicketTypes,
      allowedMessageTypes,
      allowedCustomerTicketTypes,
      allowedDashboardTypes,
      isFlexible: flexible,
      crmAvailable: enabled && !disabled && allTypes.length > 0,
      features,
    };
  }

  /**
   * Check if a specific CRM type is allowed for a tenant.
   */
  async isCrmTypeAllowed(tenantId: string, type: string): Promise<boolean> {
    const state = await this.resolveCrmOptionsState(tenantId);
    return state.enabled && state.features[type] === true;
  }

  getCrmTypeMeta(key: string): CrmTypeMeta | undefined {
    return CRM_TYPE_META[key];
  }

  private getDisabledState(): CrmOptionsState {
    return {
      enabled: false,
      inquiryProductEnabled: false,
      inquiryStorefrontEnabled: false,
      inquiryDirectoryEnabled: false,
      contactsEnabled: false,
      ticketFeaturesEnabled: false,
      messageFeaturesEnabled: false,
      customerTicketsEnabled: false,
      dashboardEnabled: false,
      allowedInquiryTypes: [],
      allowedContactTypes: [],
      allowedTicketTypes: [],
      allowedMessageTypes: [],
      allowedCustomerTicketTypes: [],
      allowedDashboardTypes: [],
      isFlexible: false,
      crmAvailable: false,
      features: {},
    };
  }
}

export default CrmOptionsService;
