export interface OrganizationData {
  organizationId: string;
  organizationName: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  limits: {
    maxLocations: number;
    maxTotalSKUs: number;
  };
  current: {
    totalLocations: number;
    totalSKUs: number;
  };
  status: {
    locations: 'ok' | 'warning' | 'at_limit';
    skus: 'ok' | 'warning' | 'at_limit';
    overall: 'ok' | 'warning' | 'at_limit';
  };
  locationBreakdown: Array<{
    tenantId: string;
    tenantName: string;
    skuCount: number;
    metadata?: any;
  }>;
}

export interface BillingCounters {
  organizationId: string;
  organizationName: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  limits: {
    maxLocations: number;
    maxTotalSKUs: number;
  };
  current: {
    totalLocations: number;
    totalSKUs: number;
  };
  status: {
    locations: 'ok' | 'warning' | 'at_limit';
    skus: 'ok' | 'warning' | 'at_limit';
    overall: 'ok' | 'warning' | 'at_limit';
  };
}

export interface TabDef {
  key: string;
  label: string;
  icon: any;
  feature?: string;
}
