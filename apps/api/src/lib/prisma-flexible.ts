/**
 * PRISMA FLEXIBLE CLIENT
 * Allows both camelCase and snake_case property names
 * Automatically transforms between conventions for seamless migration
 */

import { PrismaClient, Prisma } from '@prisma/client';

// Convert camelCase to snake_case
const camelToSnake = (str: string): string => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

// Convert snake_case to camelCase
const snakeToCamel = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

// Transform object keys recursively
const transformKeys = (obj: any, transformer: (str: string) => string): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => transformKeys(item, transformer));

  const transformed: any = {};
  for (const [key, value] of Object.entries(obj)) {
    transformed[transformer(key)] = transformKeys(value, transformer);
  }
  return transformed;
};

// Add both naming conventions to an object
const makeFlexible = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(makeFlexible);

  const flexible: any = { ...obj };

  // Add alternative naming conventions
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = camelToSnake(key);
    const camelKey = snakeToCamel(key);

    if (snakeKey !== key && !flexible[snakeKey]) {
      flexible[snakeKey] = makeFlexible(value);
    }
    if (camelKey !== key && !flexible[camelKey]) {
      flexible[camelKey] = makeFlexible(value);
    }
  }

  return flexible;
};

// Prisma method wrapper that transforms inputs and outputs
const createFlexibleProxy = (originalClient: PrismaClient): PrismaClient => {
  return new Proxy(originalClient, {
    get(target, prop) {
      const original = (target as any)[prop];

      if (typeof original === 'function') {
        // Wrap Prisma methods
        return (...args: any[]) => {
          // Transform input arguments
          const transformedArgs = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
              return transformKeys(arg, camelToSnake);
            }
            return arg;
          });

          const result = original.apply(target, transformedArgs);

          // If it's a promise, transform the result
          if (result && typeof result.then === 'function') {
            return result.then((data: any) => {
              if (data && typeof data === 'object') {
                return makeFlexible(data);
              }
              return data;
            });
          }

          // For non-promise results
          if (result && typeof result === 'object') {
            return makeFlexible(result);
          }

          return result;
        };
      }

      // For nested model access (like prisma.user, prisma.tenant, etc.)
      if (typeof original === 'object' && original !== null) {
        return createFlexibleProxy(original as any);
      }

      return original;
    }
  });
};

// Create the flexible Prisma client
export const createFlexiblePrisma = (originalPrisma: PrismaClient): PrismaClient => {
  return createFlexibleProxy(originalPrisma);
};

// Helper to enhance individual results
export const enhancePrismaResult = <T>(result: T): T => {
  return makeFlexible(result) as T;
};

// Export types
export type FlexiblePrismaClient = PrismaClient;
