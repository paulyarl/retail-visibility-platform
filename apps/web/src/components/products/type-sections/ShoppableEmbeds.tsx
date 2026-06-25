'use client';

interface ShoppableEmbedsProps {
  product: any;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
  storefrontType?: string;
  socialPlatformFlags?: {
    tiktok?: boolean;
    instagram?: boolean;
  };
}

export function ShoppableEmbeds({
  product,
  layoutVariant = 'classic',
  storefrontType,
  socialPlatformFlags,
}: ShoppableEmbedsProps) {
  if (storefrontType !== 'social') return null;

  const isCompact = layoutVariant === 'quick-commerce';
  const tiktokUrl = product.metadata?.tiktokVideoUrl || product.metadata?.tiktok_video_url;
  const instagramUrl = product.metadata?.instagramPostUrl || product.metadata?.instagram_post_url;

  const showTikTok = socialPlatformFlags?.tiktok && tiktokUrl;
  const showInstagram = socialPlatformFlags?.instagram && instagramUrl;

  if (!showTikTok && !showInstagram) return null;

  return (
    <div className={`flex flex-col gap-3 ${isCompact ? 'mt-2' : 'mt-4'}`}>
      {showTikTok && (
        <div className={`rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 ${isCompact ? 'max-h-80' : 'max-h-96'}`}>
          <blockquote
            className="tiktok-embed"
            cite={tiktokUrl}
            data-video-id={extractTikTokId(tiktokUrl)}
            style={{ maxWidth: '100%' }}
          >
            <a href={tiktokUrl} target="_blank" rel="noopener noreferrer">Watch on TikTok</a>
          </blockquote>
        </div>
      )}
      {showInstagram && (
        <div className={`rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 ${isCompact ? 'max-h-80' : 'max-h-96'}`}>
          <blockquote
            className="instagram-media"
            data-instgrm-permalink={instagramUrl}
            data-instgrm-version="14"
            style={{ maxWidth: '100%', width: '100%' }}
          >
            <a href={instagramUrl} target="_blank" rel="noopener noreferrer">View on Instagram</a>
          </blockquote>
        </div>
      )}
    </div>
  );
}

function extractTikTokId(url: string): string | undefined {
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1];
}
