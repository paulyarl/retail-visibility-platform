# Product Video Skill

## Overview

Merchants can attach a video URL to products during creation (via the Item Creation Wizard's Media step) or when editing items. The video is displayed on three surfaces:

1. **Item Detail Page** (`/t/[tenantId]/items/[itemId]`) — merchant-facing item management view
2. **Public Product Page** (`/products/[id]`) — customer-facing product detail page (all layouts)
3. **Wizard Preview** (`MediaStep`) — live preview during product creation/editing

## When to Use

- A merchant wants to showcase a product with a video demo, walkthrough, or promotional content
- A merchant has a YouTube playlist (e.g., product unboxing series, tutorial series) they want to embed
- A merchant has a Vimeo video for higher-quality or ad-free playback

## Supported URL Formats

The video URL field accepts any string, but only YouTube and Vimeo URLs will render an embedded player. All other URLs will show a "Video unavailable" fallback with an external link.

### YouTube

| URL Format | Example | Behavior |
|---|---|---|
| Standard watch URL | `https://youtube.com/watch?v=dQw4w9WgXcQ` | Single video embed |
| Short URL | `https://youtu.be/dQw4w9WgXcQ` | Single video embed |
| Embed URL | `https://youtube.com/embed/dQw4w9WgXcQ` | Single video embed |
| Shorts URL | `https://youtube.com/shorts/dQw4w9WgXcQ` | Single video embed |
| Watch URL with playlist | `https://youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxxxx` | Embeds that video with playlist queue |
| Pure playlist URL | `https://youtube.com/playlist?list=PLxxxxx` | Embeds full playlist player |

### Vimeo

| URL Format | Example | Behavior |
|---|---|---|
| Standard URL | `https://vimeo.com/123456789` | Single video embed |

### Unsupported URLs

Any URL that is not YouTube or Vimeo (e.g., TikTok, Instagram, direct video file links) will display a "Video unavailable" message with an "Open link" button pointing to the original URL. The player will not crash or break the page.

## Architecture

### Component

`apps/web/src/components/products/ProductVideoPlayer.tsx` — a single reusable client component used across all three surfaces.

**Key design decisions:**

- **Facade pattern**: Shows a thumbnail image with a play button overlay. The heavy YouTube/Vimeo iframe is NOT loaded until the user clicks play. This prevents layout shift, reduces initial page weight, and avoids loading third-party scripts unnecessarily.
- **Lazy iframe loading**: The `src` attribute is only set on the `<iframe>` after the user clicks. Before that, only a lightweight thumbnail image (`https://img.youtube.com/vi/{videoId}/hqdefault.jpg`) is loaded.
- **Single URL parser**: One `parseVideoUrl()` function handles all URL formats (YouTube, YouTube playlists, Vimeo). No duplicated regex across pages.
- **Graceful degradation**: Invalid URLs, deleted videos, and unsupported providers all show a fallback UI with an external link — never a broken iframe.
- **No eager network requests**: YouTube embeds typically load ~500KB of JavaScript. With the facade pattern, this only happens on user intent.

### Data Flow

```
Wizard (MediaStep)
  → data.videoUrl stored in wizard state
  → On submit: stored in item metadata as metadata.videoUrl
  → API (index.ts): reads metadata.videoUrl, returns as both video_url and videoUrl on product object
  → ProductDataService: fetches via /api/public/products/:id?include=variants,metadata,analytics,store
  → Product page: passes videoUrl to layout components
  → Layout renders <ProductVideoPlayer videoUrl={...} /> below the product gallery
```

### Capability Gating

The video URL field in the wizard is gated by the `showsVideo` capability flag from `useProductOptionsCapability`. Tenants on lower tiers see a locked "Video attachments are not available on your current plan" message instead of the input field.

### Props

```typescript
interface ProductVideoPlayerProps {
  videoUrl: string;      // The raw URL from the product data
  title?: string;        // Accessibility label for the iframe (default: 'Product Video')
  compact?: boolean;     // Slightly tighter spacing for compact layouts (default: false)
}
```

## Files

| File | Role |
|---|---|
| `apps/web/src/components/products/ProductVideoPlayer.tsx` | The reusable player component |
| `apps/web/src/app/t/[tenantId]/items/[itemId]/page.tsx` | Item detail page — renders player in a Card section |
| `apps/web/src/app/products/[id]/page.tsx` | Public product page — passes `videoPlayer` ReactNode to layout components |
| `apps/web/src/app/products/[id]/ProductShowcaseLayout.tsx` | Showcase layout — renders player below gallery in left panel |
| `apps/web/src/app/products/[id]/ProductQuickCommerceLayout.tsx` | Quick Commerce layout — renders player below gallery in left panel |
| `apps/web/src/components/inventory/wizards/steps/MediaStep.tsx` | Wizard media step — renders player as live preview |
| `apps/api/src/index.ts` | API — stores/returns `video_url` and `metadata.videoUrl` (lines ~4988, ~5264) |

## Best Practices for Merchants

- **Use YouTube for widest compatibility** — YouTube thumbnails load reliably and the embed API is stable
- **Use playlists for product series** — e.g., "How to use", "Unboxing", "FAQ" playlists
- **Keep videos under 5 minutes** — attention spans on product pages are short
- **Use high-quality thumbnails** — YouTube auto-generates thumbnails from your video; upload a custom one for best results
- **Test the URL before publishing** — enter the URL in the wizard and check the preview before saving

## Common Pitfalls

- **Private/unlisted YouTube videos** — will not play in the embed unless the viewer has access. Make sure videos are set to "Public"
- **Vimeo videos with domain restrictions** — Vimeo Pro/Business accounts can restrict embedding to specific domains. Ensure your storefront domain is whitelisted
- **YouTube Shorts URLs** — supported but the embed renders as a standard 16:9 player, not the vertical Shorts format
- **Playlist with no thumbnail** — pure playlist URLs (`/playlist?list=...`) have no video thumbnail, so the player shows a gradient background with a play button instead
- **URL typos** — the player shows a graceful fallback, but merchants should verify the preview in the wizard before publishing

## Expansion Opportunity: TikTok & Instagram Support

**Status**: Parked — not yet implemented. Add when merchant demand justifies the effort.

Both platforms are technically embeddable and could be added to `parseVideoUrl` and `validateVideoUrl` with moderate effort.

### TikTok
- **Embed URL**: `https://www.tiktok.com/embed/v2/{videoId}`
- **URL formats**: `tiktok.com/@user/video/123456789`, `vm.tiktok.com/shortlink`
- **Aspect ratio**: 9:16 vertical — requires a different container than the current 16:9 `aspect-video`
- **Thumbnails**: No public thumbnail API — facade would show gradient + play button only

### Instagram
- **Embed URL**: `https://www.instagram.com/p/{shortcode}/embed`
- **URL formats**: `instagram.com/p/CxYz123/`, `instagram.com/reel/CxYz123/`
- **Aspect ratio**: 1:1 square or 9:16 for reels — same container mismatch issue
- **Thumbnails**: No public thumbnail API — same gradient fallback

### Implementation Considerations
- **Aspect ratio mismatch**: Both platforms use vertical/square formats. The player would need to detect the provider and switch the container's aspect ratio (e.g., `aspect-[9/16]` for TikTok/reels, `aspect-square` for Instagram posts).
- **No thumbnails**: The facade pattern loses much of its value without thumbnails — users see a generic play button instead of a preview frame.
- **Embed reliability**: YouTube and Vimeo embed APIs have been stable for 10+ years. TikTok/Instagram embed APIs are less predictable and may change.
- **Loading weight**: TikTok's embed loads a significant JS bundle. Instagram's is lighter but still heavier than a simple iframe.
- **Validation**: Would need to add TikTok and Instagram hostname checks to `validateVideoUrl` in `MediaStep.tsx` and `parseVideoUrl` in `ProductVideoPlayer.tsx`.

### Recommendation
Hold off until merchants specifically request TikTok/Instagram support. YouTube and Vimeo cover the vast majority of product video use cases. If demand emerges, the expansion is straightforward — add the providers to both `parseVideoUrl` and `validateVideoUrl`, and introduce a per-provider aspect ratio on the container.

## Related Skills

- `video-commerce-integration` — Advanced shoppable video, live shopping events, and interactive product hotspots (deferred project)
