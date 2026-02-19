/**
 * RBAC Validation Utilities
 * Separated to avoid circular dependency issues
 */

import { RBACService } from '../services/RBACService';

/**
 * Validate user role against API-driven role groups
 * Utility function to avoid circular dependencies
 */
export async function validateRoleAgainstGroup(userRole: string, requiredGroup: string): Promise<boolean> {
  try {
    console.log(`[RBACValidation] Validating role ${userRole} against group ${requiredGroup} via RBACService`);
    return await RBACService.getInstance().validateRoleAgainstGroup(userRole, requiredGroup);
  } catch (error) {
    console.error('[RBACValidation] Failed to validate role against group:', error);
    return false;
  }
}
