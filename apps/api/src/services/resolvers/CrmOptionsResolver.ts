/**
 * CRM Options Resolver
 *
 * Resolves effective CRM options state from tier features and merchant preferences.
 */

import type { EffectiveCrm, CrmOptionsMerchantSettings } from './types';

export type CrmInquiryType =
  | 'crm_inquiry_product_on' | 'crm_inquiry_product_enabled'
  | 'crm_inquiry_storefront_on' | 'crm_inquiry_storefront_enabled'
  | 'crm_inquiry_directory_on' | 'crm_inquiry_directory_enabled'
  | 'crm_inquiry_anonymous'
  | 'crm_inquiry_customer' | 'crm_inquiry_assignment' | 'crm_inquiry_auto_response';

export type CrmContactType = 'crm_contact_management' | 'crm_contact_import' | 'crm_contact_sync';
export type CrmTicketType = 'crm_ticket_priority' | 'crm_ticket_assignment' | 'crm_ticket_templates' | 'crm_ticket_escalation';
export type CrmMessageType = 'crm_message_rich_text' | 'crm_message_attachments' | 'crm_message_templates';
export type CrmCustomerTicketType = 'crm_customer_tickets';
export type CrmDashboardType = 'crm_dashboard_analytics' | 'crm_requests_hub';

export function resolveCrmOptions(
  features: Record<string, boolean>,
  merchantPrefs?: CrmOptionsMerchantSettings | null
): EffectiveCrm {
  const cleanFeatures: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(features)) {
    cleanFeatures[key.trim()] = val;
  }
  const feat = cleanFeatures;

  const disabled = !!feat.crm_disabled;
  const tierEnabled = !disabled && !!feat.crm_enabled;
  const enabled = tierEnabled && (merchantPrefs?.crm_enabled !== false);
  const flexible = !!feat.crm_flexible;

  const inquiryProductOn = flexible || !!feat.crm_inquiry_product_on || !!feat.crm_inquiry_product_enabled;
  const inquiryStorefrontOn = flexible || !!feat.crm_inquiry_storefront_on || !!feat.crm_inquiry_storefront_enabled;
  const inquiryDirectoryOn = flexible || !!feat.crm_inquiry_directory_on || !!feat.crm_inquiry_directory_enabled;

  const contactsEnabled = flexible || !!feat.crm_contact_management;
  const ticketFeaturesEnabled = flexible || (!!feat.crm_ticket_priority || !!feat.crm_ticket_assignment || !!feat.crm_ticket_templates || !!feat.crm_ticket_escalation);
  const messageFeaturesEnabled = flexible || (!!feat.crm_message_rich_text || !!feat.crm_message_attachments || !!feat.crm_message_templates);
  const customerTicketsEnabled = flexible || !!feat.crm_customer_tickets;
  const dashboardEnabled = flexible || (!!feat.crm_dashboard_analytics || !!feat.crm_requests_hub);

  const allowedInquiry: CrmInquiryType[] = [];
  if (flexible) {
    allowedInquiry.push(
      'crm_inquiry_product_enabled', 'crm_inquiry_storefront_enabled',
      'crm_inquiry_directory_enabled', 'crm_inquiry_anonymous',
      'crm_inquiry_customer', 'crm_inquiry_assignment', 'crm_inquiry_auto_response'
    );
  } else {
    if (feat.crm_inquiry_product_on) allowedInquiry.push('crm_inquiry_product_on');
    else if (feat.crm_inquiry_product_enabled) allowedInquiry.push('crm_inquiry_product_enabled');
    if (feat.crm_inquiry_storefront_on) allowedInquiry.push('crm_inquiry_storefront_on');
    else if (feat.crm_inquiry_storefront_enabled) allowedInquiry.push('crm_inquiry_storefront_enabled');
    if (feat.crm_inquiry_directory_on) allowedInquiry.push('crm_inquiry_directory_on');
    else if (feat.crm_inquiry_directory_enabled) allowedInquiry.push('crm_inquiry_directory_enabled');
    if (feat.crm_inquiry_anonymous) allowedInquiry.push('crm_inquiry_anonymous');
    if (feat.crm_inquiry_customer) allowedInquiry.push('crm_inquiry_customer');
    if (feat.crm_inquiry_assignment) allowedInquiry.push('crm_inquiry_assignment');
    if (feat.crm_inquiry_auto_response) allowedInquiry.push('crm_inquiry_auto_response');
  }

  const allowedContact: CrmContactType[] = [];
  if (flexible) {
    allowedContact.push('crm_contact_management', 'crm_contact_import', 'crm_contact_sync');
  } else {
    if (feat.crm_contact_management) allowedContact.push('crm_contact_management');
    if (feat.crm_contact_import) allowedContact.push('crm_contact_import');
    if (feat.crm_contact_sync) allowedContact.push('crm_contact_sync');
  }

  const allowedTicket: CrmTicketType[] = [];
  if (flexible) {
    allowedTicket.push('crm_ticket_priority', 'crm_ticket_assignment', 'crm_ticket_templates', 'crm_ticket_escalation');
  } else {
    if (feat.crm_ticket_priority) allowedTicket.push('crm_ticket_priority');
    if (feat.crm_ticket_assignment) allowedTicket.push('crm_ticket_assignment');
    if (feat.crm_ticket_templates) allowedTicket.push('crm_ticket_templates');
    if (feat.crm_ticket_escalation) allowedTicket.push('crm_ticket_escalation');
  }

  const allowedMessage: CrmMessageType[] = [];
  if (flexible) {
    allowedMessage.push('crm_message_rich_text', 'crm_message_attachments', 'crm_message_templates');
  } else {
    if (feat.crm_message_rich_text) allowedMessage.push('crm_message_rich_text');
    if (feat.crm_message_attachments) allowedMessage.push('crm_message_attachments');
    if (feat.crm_message_templates) allowedMessage.push('crm_message_templates');
  }

  const allowedCustomerTicket: CrmCustomerTicketType[] = [];
  if (flexible || feat.crm_customer_tickets) {
    allowedCustomerTicket.push('crm_customer_tickets');
  }

  const allowedDashboard: CrmDashboardType[] = [];
  if (flexible) {
    allowedDashboard.push('crm_dashboard_analytics', 'crm_requests_hub');
  } else {
    if (feat.crm_dashboard_analytics) allowedDashboard.push('crm_dashboard_analytics');
    if (feat.crm_requests_hub) allowedDashboard.push('crm_requests_hub');
  }

  const allTypes = [...allowedInquiry, ...allowedContact, ...allowedTicket, ...allowedMessage, ...allowedCustomerTicket, ...allowedDashboard];

  return {
    enabled,
    inquiry_product_enabled: enabled && inquiryProductOn,
    inquiry_storefront_enabled: enabled && inquiryStorefrontOn,
    inquiry_directory_enabled: enabled && inquiryDirectoryOn,
    contacts_enabled: enabled && contactsEnabled,
    ticket_features_enabled: enabled && ticketFeaturesEnabled,
    message_features_enabled: enabled && messageFeaturesEnabled,
    customer_tickets_enabled: enabled && customerTicketsEnabled,
    dashboard_enabled: enabled && dashboardEnabled,
    allowed_inquiry_types: allowedInquiry,
    allowed_contact_types: allowedContact,
    allowed_ticket_types: allowedTicket,
    allowed_message_types: allowedMessage,
    allowed_customer_ticket_types: allowedCustomerTicket,
    allowed_dashboard_types: allowedDashboard,
    is_flexible: flexible,
    crm_available: enabled && allTypes.length > 0,
    merchant_preferences: merchantPrefs ?? null,
  };
}
