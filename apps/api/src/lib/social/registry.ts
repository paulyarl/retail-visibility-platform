import { metaFacebookAdapter } from './meta-facebook';
import { metaInstagramAdapter } from './meta-instagram';
import { metaThreadsAdapter } from './meta-threads';
import type { SocialPlatform, SocialPlatformAdapter } from './types';

const ADAPTERS: Partial<Record<SocialPlatform, SocialPlatformAdapter>> = {
  meta_facebook: metaFacebookAdapter,
  meta_instagram: metaInstagramAdapter,
  meta_threads: metaThreadsAdapter,
};

export function getSocialAdapter(platform: string): SocialPlatformAdapter | null {
  return ADAPTERS[platform as SocialPlatform] ?? null;
}
