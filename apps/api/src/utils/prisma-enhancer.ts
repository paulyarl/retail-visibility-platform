/**
 * PRISMA RESULT ENHANCER
 * Automatically adds both naming conventions to Prisma query results
 * Use this to make database results work with both snake_case and camelCase
 */

import { enhanceDatabaseResult } from '../middleware/universal-transform';

/**
 * Enhance a single Prisma result
 */
export const enhance = <T>(result: T): T => {
  return enhanceDatabaseResult(result) as T;
};

/**
 * Enhance an array of Prisma results
 */
export const enhanceArray = <T>(results: T[]): T[] => {
  return results.map(result => enhance(result));
};

/**
 * Enhance a Prisma result that might be null
 */
export const enhanceNullable = <T>(result: T | null): T | null => {
  if (!result) return null;
  return enhance(result);
};

/**
 * Wrapper for common Prisma operations
 */
export const prismaEnhanced = {
  /**
   * Enhance findUnique result
   */
  findUnique: <T>(result: T | null): T | null => {
    return enhanceNullable(result);
  },

  /**
   * Enhance findFirst result
   */
  findFirst: <T>(result: T | null): T | null => {
    return enhanceNullable(result);
  },

  /**
   * Enhance findMany result
   */
  findMany: <T>(results: T[]): T[] => {
    return enhanceArray(results);
  },

  /**
   * Enhance create result
   */
  create: <T>(result: T): T => {
    return enhance(result);
  },

  /**
   * Enhance update result
   */
  update: <T>(result: T): T => {
    return enhance(result);
  },

  /**
   * Enhance upsert result
   */
  upsert: <T>(result: T): T => {
    return enhance(result);
  }
};

/**
 * Quick fix for specific database result patterns
 * Apply this to database results that are causing TypeScript errors
 */
export const quickFix = {
  /**
   * Fix business profile results
   */
  businessProfile: (profile: any) => {
    if (!profile) return profile;
    return enhance(profile);
  },

  /**
   * Fix Google account results
   */
  googleAccount: (account: any) => {
    if (!account) return account;
    return enhance(account);
  },

  /**
   * Fix tenant results
   */
  tenant: (tenant: any) => {
    if (!tenant) return tenant;
    return enhance(tenant);
  },

  /**
   * Fix inventory item results
   */
  inventoryItem: (item: any) => {
    if (!item) return item;
    return enhance(item);
  },

  /**
   * Fix user results
   */
  user: (user: any) => {
    if (!user) return user;
    return enhance(user);
  }
};
