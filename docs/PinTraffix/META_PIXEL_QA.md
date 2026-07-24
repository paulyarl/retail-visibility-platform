# Meta (Facebook/Instagram) Pixel QA Checklist

Engineering enablement for the Sprint 4 Meta/Instagram transition.

## Environment setup

1. Add the Meta Pixel ID to the deployment environment:

```
NEXT_PUBLIC_META_PIXEL_ID=xxxxxxxxxxxxxxxx
```

2. For the Conversions API, add the server-side access token to the **backend** environment (not public):

```
META_CONVERSIONS_API_ACCESS_TOKEN=...
META_PIXEL_ID=...
```

3. Redeploy the web app so `NEXT_PUBLIC_META_PIXEL_ID` is bundled.

## Frontend Pixel verification

- [ ] Open any public page (e.g. `/solutions/clover-storefront`).
- [ ] In DevTools → Network, filter `facebook.com/tr` or `connect.facebook.net`.
- [ ] Confirm `fbevents.js` loads.
- [ ] Confirm a `PageView` event fires.
- [ ] Confirm `noscript` fallback `<img>` is present in the DOM.

## UTM URL variants

- [ ] `utm_source=instagram` and `utm_source=facebook` variants are generated from `apps/web/src/lib/social/campaignUrls.ts`.
- [ ] Each variant includes `utm_content=P-XX` matching the loop ID.
- [ ] `ref=facebook` / `ref=instagram` is appended for consistency with `ref=pinterest`.
- [ ] Marketing URL matrix uses `getP0CampaignUrls()` or `buildCampaignUrl()`.

## Conversion events on trial CTAs

Trial CTAs should fire `Lead` or `CompleteRegistration` pixel events when clicked.

Current recommendation:

```tsx
import { metaTrack } from '@/components/tracking/MetaPixel';

<button onClick={() => metaTrack('Lead', { content_name: 'Pinterest P0' })}>
  Start free trial
</button>
```

- [ ] Primary CTA on each `/solutions/*` page fires `Lead`.
- [ ] `/auth/signup` completion fires `CompleteRegistration` (server or client).
- [ ] Optional `ViewContent` fires on each `/solutions/*` page load.

## Conversions API server-side events

Events that should be sent server-side to improve matching and iOS 14.5+ coverage:

| Event | Trigger | Properties |
|---|---|---|
| `PageView` | public page render | `event_source_url`, `client_ip_address` (hashed) |
| `Lead` | sign-up CTA click | `em` (if collected and hashed), `external_id` |
| `CompleteRegistration` | onboarding complete | `em` (hashed), `value`, `currency` |

- [ ] Backend endpoint accepts a `fbp` cookie and `event_id` for deduplication.
- [ ] Server-side `CompleteRegistration` is wired into `/api/onboarding` completion.

## Design asset requirements for Meta

- [ ] Top 2 winning Pin visuals exported in 1:1 (1080 × 1080) and 4:5 (1080 × 1350).
- [ ] Asset folder: `apps/web/public/images/meta/`.
- [ ] Filenames follow `<loopId>-<source>-<ratio>.<ext>` (e.g. `P-03-instagram-4x5.png`).

## Handoff to Week 5

- [ ] Top 2 Pin angles selected and documented in `docs/PinTraffix/META_CREATIVE_BRIEF.md`.
- [ ] URL matrix delivered to Growth.
- [ ] Pixel event QA complete.
- [ ] P1 backlog for Week 5/6 prioritized.
