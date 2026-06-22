/**
 * Organization Options Resolver
 *
 * Resolves effective org-level capabilities (tab access, panel access, propagation types)
 * from tier features for the organization_options capability type.
 *
 * This resolver is org-scoped — it uses the org's subscription tier features
 * rather than per-tenant merchant settings.
 */

import type { EffectiveOrgOptions, OrgTabKey, OrgPanelKey, OrgPropagationType } from './types';

const ALL_TABS: OrgTabKey[] = [
  'overview', 'locations', 'propagation', 'capabilities',
  'team', 'commerce', 'billing',
];

const ALL_PANELS: OrgPanelKey[] = [
  'task_checklist', 'quick_links', 'system_status',
  'recommendations', 'crm_summary',
];

const ALL_PROPAGATION_TYPES: OrgPropagationType[] = [
  'org_propagation_products', 'org_propagation_categories',
  'org_propagation_business_info', 'org_propagation_settings',
];

export function resolveOrgOptions(
  features: Record<string, boolean>,
  capabilityEnabled?: boolean
): EffectiveOrgOptions {
  const enabled = !!features.org_enabled || !!capabilityEnabled;
  const flexible = !!features.org_flexible;

  // Tabs: overview and billing are always available when org is enabled
  const allowedTabs: OrgTabKey[] = [];
  if (enabled) {
    allowedTabs.push('overview');
    allowedTabs.push('billing');

    if (flexible || features.org_tab_locations) allowedTabs.push('locations');
    if (flexible || features.org_tab_propagation) allowedTabs.push('propagation');
    if (flexible || features.org_tab_capabilities) allowedTabs.push('capabilities');
    if (flexible || features.org_tab_team) allowedTabs.push('team');
    if (flexible || features.org_tab_commerce) allowedTabs.push('commerce');
  }

  // Panels
  const allowedPanels: OrgPanelKey[] = [];
  if (enabled) {
    if (flexible || features.org_panel_task_checklist) allowedPanels.push('task_checklist');
    if (flexible || features.org_panel_quick_links) allowedPanels.push('quick_links');
    if (flexible || features.org_panel_system_status) allowedPanels.push('system_status');
    if (flexible || features.org_panel_recommendations) allowedPanels.push('recommendations');
    if (flexible || features.org_panel_crm_summary) allowedPanels.push('crm_summary');
  }

  // Propagation types
  const allowedPropagationTypes: OrgPropagationType[] = [];
  if (enabled) {
    if (flexible || features.org_propagation_products) allowedPropagationTypes.push('org_propagation_products');
    if (flexible || features.org_propagation_categories) allowedPropagationTypes.push('org_propagation_categories');
    if (flexible || features.org_propagation_business_info) allowedPropagationTypes.push('org_propagation_business_info');
    if (flexible || features.org_propagation_settings) allowedPropagationTypes.push('org_propagation_settings');
  }

  return {
    enabled,
    is_flexible: flexible,
    allowed_tabs: allowedTabs,
    allowed_panels: allowedPanels,
    allowed_propagation_types: allowedPropagationTypes,
    org_available: enabled && (allowedTabs.length > 0 || allowedPanels.length > 0),
  };
}
