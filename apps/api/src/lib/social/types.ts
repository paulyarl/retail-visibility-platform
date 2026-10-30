/**
 * Social Posting Suite — normalized post entity + platform adapter contract.
 *
 * Spec: docs/LocalBiz/SOCIAL_POSTING_SUITE_SPEC.md §4 Subsystem 1
 * One composer submission fans out to one social_posts row per destination
 * (shared batch_id); each row publishes independently through its adapter.
 */

export type SocialPlatform =
  | 'meta_facebook'
  | 'meta_instagram'
  | 'meta_threads'
  | 'tiktok'
  | 'linkedin'
  | 'pinterest'
  | 'x';

export interface SocialPostMediaItem {
  social_media_id?: string;
  url: string;
  type: 'photo' | 'video';
  alt?: string;
}

export interface SocialPostDraft {
  tenantId: string;
  platform: SocialPlatform;
  /** page_id | ig_user_id | threads_user_id — falls back to the surface row. */
  targetRef?: string | null;
  body: string;
  linkUrl?: string | null;
  media?: SocialPostMediaItem[];
  platformPayload?: Record<string, unknown>;
}

export interface PublishResult {
  success: boolean;
  remoteId?: string;
  permalink?: string;
  error?: string;
  status?: number;
  retryAfterMs?: number;
}

export interface SocialPlatformAdapter {
  platform: SocialPlatform;
  /** Per-surface lint — e.g. "instagram requires at least one image". */
  validateDraft(draft: SocialPostDraft): string[];
  publish(tenantId: string, draft: SocialPostDraft): Promise<PublishResult>;
  delete?(tenantId: string, remoteId: string, targetRef: string): Promise<boolean>;
}

/** platform key → meta_surface_connections.surface */
export const META_SURFACE_MAP: Partial<Record<SocialPlatform, string>> = {
  meta_facebook: 'facebook_page',
  meta_instagram: 'instagram',
  meta_threads: 'threads',
};
