/**
 * Public API Singleton - Stable Version
 * 
 * Extends FlexibleApiSingletonStable with public-specific defaults
 * Clean, stable version using delegation pattern
 */

import { FlexibleApiSingletonStable, RequestType, RequestTarget, SingletonCacheOptions } from './FlexibleApiSingletonStable';

export abstract class PublicApiSingletonStable extends FlexibleApiSingletonStable {
  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes for public data
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 15 * 60 * 1000, // 15 minutes for public data
      ...cacheOptions
    });
  }
}
