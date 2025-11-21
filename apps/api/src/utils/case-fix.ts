/**
 * EMERGENCY CASE FIX UTILITIES
 * Handles the specific case mismatch patterns from build errors
 */

/**
 * Database result property mappings
 * Maps the actual database field names to what the code expects
 */
export const DB_FIELD_MAPPINGS = {
  // Tenant fields
  'created_by': 'createdBy',
  'trial_ends_at': 'trialEndsAt',
  
  // User fields  
  'password_hash': 'passwordHash',
  'last_login': 'lastLogin',
  'userId': 'userId',
  'tenantId': 'tenantId',
  
  // Item fields
  'inventory_item_id': 'inventoryItemId',
  'priceCents': 'priceCents',
  'itemStatus': 'itemStatus',
  
  // Business profile fields
  'business_name': 'businessName',
  'address_line1': 'addressLine1',
  'address_line2': 'addressLine2',
  'phone_number': 'phoneNumber',
  'website_url': 'websiteUrl',
  
  // Google OAuth fields
  'google_account_id': 'googleAccountId',
  'display_name': 'displayName',
  'profile_picture_url': 'profilePictureUrl',
  
  // JWT payload fields
  'tenantIds': 'tenantIds'
};

/**
 * Transform database results to include both snake_case and camelCase properties
 * This allows existing code to work while we transition
 */
export const addCamelCaseProperties = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(addCamelCaseProperties);
  }
  
  const enhanced = { ...obj };
  
  // Add camelCase versions of snake_case properties
  for (const [snakeKey, camelKey] of Object.entries(DB_FIELD_MAPPINGS)) {
    if (obj[snakeKey] !== undefined) {
      enhanced[camelKey] = obj[snakeKey];
    }
  }
  
  return enhanced;
};

/**
 * Specific fixes for the most common error patterns
 */
export const fixCommonPatterns = {
  /**
   * Fix JWT payload access patterns
   */
  fixJwtPayload: (payload: any) => {
    if (!payload) return payload;
    return {
      ...payload,
      // Add camelCase versions
      userId: payload.userId || payload.userId,
      tenantId: payload.tenantId || payload.tenantId,
      tenantIds: payload.tenantIds || payload.tenantIds
    };
  },

  /**
   * Fix business profile access patterns
   */
  fixBusinessProfile: (profile: any) => {
    if (!profile) return profile;
    return {
      ...profile,
      businessName: profile.business_name || profile.businessName,
      addressLine1: profile.address_line1 || profile.addressLine1,
      addressLine2: profile.address_line2 || profile.addressLine2,
      phoneNumber: profile.phone_number || profile.phoneNumber,
      websiteUrl: profile.website_url || profile.websiteUrl
    };
  },

  /**
   * Fix item/inventory access patterns
   */
  fixInventoryItem: (item: any) => {
    if (!item) return item;
    return {
      ...item,
      tenantId: item.tenantId || item.tenantId,
      priceCents: item.priceCents || item.priceCents,
      itemStatus: item.itemStatus || item.itemStatus,
      inventoryItemId: item.inventory_item_id || item.inventoryItemId
    };
  },

  /**
   * Fix Google OAuth account patterns
   */
  fixGoogleAccount: (account: any) => {
    if (!account) return account;
    return {
      ...account,
      googleAccountId: account.google_account_id || account.googleAccountId,
      displayName: account.display_name || account.displayName,
      profilePictureUrl: account.profile_picture_url || account.profilePictureUrl,
      tenantId: account.tenantId || account.tenantId
    };
  },

  /**
   * Fix tenant patterns
   */
  fixTenant: (tenant: any) => {
    if (!tenant) return tenant;
    return {
      ...tenant,
      createdBy: tenant.created_by || tenant.createdBy,
      trialEndsAt: tenant.trial_ends_at || tenant.trialEndsAt,
      tenantId: tenant.tenantId || tenant.tenantId
    };
  }
};

/**
 * Universal fix function that applies all common patterns
 */
export const applyUniversalFix = (data: any, type?: string): any => {
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => applyUniversalFix(item, type));
  }
  
  if (typeof data !== 'object') return data;
  
  // Apply type-specific fixes
  let fixed = data;
  switch (type) {
    case 'jwt':
      fixed = fixCommonPatterns.fixJwtPayload(data);
      break;
    case 'profile':
      fixed = fixCommonPatterns.fixBusinessProfile(data);
      break;
    case 'item':
      fixed = fixCommonPatterns.fixInventoryItem(data);
      break;
    case 'google':
      fixed = fixCommonPatterns.fixGoogleAccount(data);
      break;
    case 'tenant':
      fixed = fixCommonPatterns.fixTenant(data);
      break;
    default:
      // Apply all fixes for unknown types
      fixed = addCamelCaseProperties(data);
  }
  
  return fixed;
};

/**
 * Prisma result enhancer - adds camelCase properties to database results
 */
export const enhancePrismaResult = <T>(result: T): T => {
  return addCamelCaseProperties(result) as T;
};

/**
 * Query parameter fixer - converts camelCase to snake_case for database queries
 */
export const fixQueryParams = (params: any): any => {
  if (!params || typeof params !== 'object') return params;
  
  const fixed: any = {};
  
  for (const [key, value] of Object.entries(params)) {
    // Convert camelCase to snake_case for database queries
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    fixed[snakeKey] = value;
    
    // Also keep original key for compatibility
    fixed[key] = value;
  }
  
  return fixed;
};
