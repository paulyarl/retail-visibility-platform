/**
 * DirectorySuggestionPublicService — public suggestion of a missing directory business.
 *
 * Extends PublicApiSingleton (RequestType.PUBLIC, no credentials).
 * Caching disabled (suggestion state is irrelevant after submission).
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface SuggestionInput {
  businessName: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  primaryCategory?: string;
  submitterEmail?: string;
  submitterComment?: string;
  sourcePage?: string;
  honeyPot?: string;
}

export interface SuggestionResult {
  success: boolean;
  suggestionId?: string;
  error?: string;
  /** Populated when the backend detects an existing listing (409). */
  existing?: {
    id: string;
    businessName: string;
    slug: string | null;
    city: string | null;
    state: string | null;
  };
}

export class DirectorySuggestionPublicService extends PublicApiSingleton {
  private static instance: DirectorySuggestionPublicService;

  private constructor() {
    super('directory-suggestion-public', { ttl: 0 });
  }

  public static getInstance(): DirectorySuggestionPublicService {
    if (!DirectorySuggestionPublicService.instance) {
      DirectorySuggestionPublicService.instance = new DirectorySuggestionPublicService();
    }
    return DirectorySuggestionPublicService.instance;
  }

  /** POST /api/public/directory/suggestions */
  async submitSuggestion(input: SuggestionInput): Promise<SuggestionResult> {
    try {
      const result = await this.makeDefaultRequest<any>(
        '/api/public/directory/suggestions',
        {
          method: 'POST',
          body: JSON.stringify(input),
        },
        undefined,
        0,
      );

      if (!result.success) {
        const error = typeof result.error === 'string' ? result.error : 'unknown';
        return { success: false, error };
      }

      const data = result.data?.data ?? result.data;
      return {
        success: data?.success ?? false,
        suggestionId: data?.suggestionId,
        error: data?.error,
      };
    } catch (err: any) {
      const status = err?.status;
      const body = err?.data || err?.body || {};

      if (status === 409) {
        return {
          success: false,
          error: 'already_listed',
          existing: body?.existing,
        };
      }

      if (status === 429) {
        return { success: false, error: 'rate_limit_exceeded' };
      }

      return { success: false, error: err?.message || 'unknown' };
    }
  }
}

export default DirectorySuggestionPublicService.getInstance();
