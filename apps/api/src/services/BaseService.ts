/**
 * Base Service - UniversalSingleton Foundation
 * Provides common functionality for all singleton services
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import type { RequestCtx } from '../context';

export abstract class BaseService {
  protected prisma = prisma;
  protected logger = logger;

  /**
   * Handle common error patterns
   */
  protected handleError(error: unknown, context?: RequestCtx): Error {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.logger.error('Service error: ' + errorMessage, context, { error });
    return new Error(errorMessage);
  }

  /**
   * Log service operations
   */
  protected logOperation(operation: string, details?: any): void {
    this.logger.info(`Service operation: ${operation}`, details);
  }

  /**
   * Validate required parameters
   */
  protected validateRequired(params: Record<string, any>, required: string[]): void {
    const missing = required.filter(key => !params[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
  }

  /**
   * Execute database query with error handling
   */
  protected async executeQuery<T = any>(
    sql: string, 
    params: any[] = []
  ): Promise<T[]> {
    try {
      const result = await this.prisma.$queryRawUnsafe<T[]>(sql, ...params);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      this.logger.error('Database query error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error, sql, params });
      throw this.handleError(error, undefined);
    }
  }

  /**
   * Paginate results
   */
  protected paginate<T>(
    items: T[], 
    page: number, 
    limit: number
  ): {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  } {
    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedItems = items.slice(startIndex, endIndex);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }
}
