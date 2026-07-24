# Sprint 3 — Visual Asset Manifest

Engineering pre-work for the Sprint 3 Pinterest visual-asset production.

## Asset inventory

| Asset ID | Filename (no ext) | Dimensions | Format | Loop(s) | Destination | Used in code |
|---|---|---|---|---|---|---|
| p01-clover-storefront-hero | `p01-clover-storefront-hero` | 1200 × 1800 | PNG / WebP | P-01 | `/solutions/clover-storefront` | `apps/web/src/lib/pinterest/pinCampaigns.ts` |
| p03-deposit-commerce-hero | `p03-deposit-commerce-hero` | 1200 × 1800 | PNG / WebP | P-03 | `/solutions/deposit-commerce` | `apps/web/src/lib/pinterest/pinCampaigns.ts` |
| p02-google-visibility-hero | `p02-google-visibility-hero` | 1200 × 1800 | PNG / WebP | P-02 | `/solutions/google-visibility` | `apps/web/src/lib/pinterest/pinCampaigns.ts` |
| p04-omnichannel-hero | `p04-omnichannel-hero` | 1200 × 1800 | PNG / WebP | P-04 | `/solutions/omnichannel` | `apps/web/src/lib/pinterest/pinCampaigns.ts` |
| ecommerce-hero | `ecommerce-hero` | 1200 × 1800 | PNG / WebP | — | `/solutions/ecommerce` | `apps/web/src/app/solutions/ecommerce/page.tsx` |
| deposit-reserve-flow | `deposit-reserve-flow-1`, `deposit-reserve-flow-2` | 1200 × 1800 | PNG / WebP | P-03, P-09 | `/solutions/deposit-commerce` | replace `placehold.co` in `page.tsx` |
| google-before-after | `google-before-after-1`, `google-before-after-2`, `google-before-after-3` | 1200 × 1800 | PNG / WebP | P-02, P-10 | `/solutions/google-visibility`, `/guides/google-visibility-checklist` | replace `placehold.co` in pages |
| clover-split-screens | `clover-split-1`, `clover-split-2`, `clover-split-3` | 1200 × 1800 | PNG / WebP | P-01, P-09 | `/solutions/clover-storefront` | replace `placehold.co` in `page.tsx` |
| omnichannel-split-path | `omnichannel-split-1`, `omnichannel-split-2` | 1200 × 1800 | PNG / WebP | P-04 | `/solutions/omnichannel` | replace `placehold.co` in `page.tsx` |
| qr-code-grid | `p06-qr-code-grid` | 1200 × 1800 | PNG / WebP | P-06 | `/features#qr` | `apps/web/src/lib/pinterest/pinCampaigns.ts` |
| example-storefronts | `example-1` … `example-5` | 600 × 900 | PNG / WebP | P-18 | `/examples` | replace `placehold.co` in `page.tsx` |

## Delivery folder

Export final assets to:

```
apps/web/public/images/pinterest/
```

## Engineering swap checklist

After design drops assets, update the `heroImage` const in each landing `page.tsx` from the `placehold.co` placeholder to the local path:

```ts
const heroImage = '/images/pinterest/<asset-id>.png';
```

`metadataBase` is already configured in each `page.tsx`, so relative paths resolve correctly for `openGraph` and `twitter:image` tags.

## UTM string source of truth

Loop-specific UTM content tags and outbound URLs are defined in:

```
apps/web/src/lib/pinterest/pinCampaigns.ts
```

Marketing should use `buildPinUrl(P0_PINS_BY_LOOP['P-03'])` to generate the exact Pin destination link with unique `utm_content` per loop.
