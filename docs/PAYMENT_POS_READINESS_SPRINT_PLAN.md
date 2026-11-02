# Payment & POS Readiness Sprint Plan — Tenant Readiness

Status: draft (v0.1 — next effort after the 2026-11-02 infra posture work)

## 0. Why now

The platform is selling *tenant readiness*: a real merchant should be able to
collect money and sync their POS catalog on day one. Today's honest state
(readiness pass 2026-11-02):

- **Stripe** — only proven path end-to-end; still carries debt (`stripe-webhook.ts`
  vs `stripe-webhooks.ts` vs `stripe-connect-webhooks.ts` duplication).
- **PayPal** — bespoke REST checkout + verified webhooks, E2E-proven in stg +
  PayPal sandbox; **never run in production**. Factory class is dead code
  (`PayPalGateway.ts.disabled`, factory `throw`s).
- **Square** — *two products*: bespoke REST payments route (works, but ships
  `console.log` credential-shape debug lines) and POS catalog sync
  (`VariantAwareSquareSync`, production-unproven). Factory `throw`s
  "not implemented" — misleading; the route exists outside the interface.
- **Clover** — OAuth + demo emulator + real-API path behind
  `CLOVER_USE_REAL_API`; production-connect unproven. Founding-partner
  merchant identified for the closing loop.
- **Debt** — ~40 `.bak` files, src-root fix scripts
  (`fix-payment-gateways.ts`, `remove-square-gateway.ts`), duplicated Square
  OAuth services. Money-path code was patched live; sweep before tenants.

**Doctrine rule that resolves half the "gaps":** name the money model per
provider — *platform-collects* (bespoke routes, platform creds: storefront
checkouts on platform tenants) vs *tenant-collects* (gateway factory,
per-tenant creds). Both exist unnamed today. Task C1 makes it a paragraph,
not a recurring confusion.

## 1. Workstream map

| Stream | Goal | Provider |
|---|---|---|
| A — Payments | Live-fire proven checkout per provider, named money model | Stripe · PayPal · Square |
| B — POS sync | First production sync per provider + the Clover channel play | Square · Clover |
| C — Hygiene | Money-path debt cleared before tenant traffic | All |

## 2. Stream C — Hygiene (do first; unblocks honest testing)

| # | Task | Exit |
|---|---|---|
| C1 | Write the money-model paragraph into `routes/PAYMENTS_API_DOCUMENTATION.md`: platform-collects (bespoke routes, `unifiedConfig` creds) vs tenant-collects (`tenant_payment_gateways` + factory). One table, per provider. | Doc merged; the two models named in one place |
| C2 | Webhook mount audit — **finding (2026-11-02): live shadowing.** `bootstrap.ts:114` mounts `webhooks.ts` at `/api/webhooks` first; its `/stripe` handler (raw body, sig-verified, mostly logs events to DB) shadows the registry late-mount of `stripe-webhook.ts` at the same full path `/api/webhooks/stripe` — which holds the real `payment_intent.*`/`invoice.*`/`subscription.*`/`setup_intent.*` business handlers and is additionally broken (`constructEvent(req.body)` would get an already-parsed body if it ever ran). Stripe payment/subscription events are likely being logged but not processed. `stripe-webhooks.ts` (plural) was unreferenced → deleted. `stripe-connect-webhooks.ts` is legitimately mounted at `/api/webhooks/stripe-connect`. | Decide the merge: fold `stripe-webhook.ts` handlers into `webhooks.ts` `/stripe` (or make it the mounted handler and delete the logger branch) — one route, all event types actually dispatched |
| C3 | Kill `.bak` files + src-root fix scripts — **done 2026-11-02**: 493 `*.bak` + `check/fix/remove-payment-gateways.ts` deleted, checkapi clean. | `find src -name "*.bak"` → 0 ✅ |
| C4 | Dedupe Square OAuth services — **finding: both are live.** `SquareOAuthService` imported by `oauth-token-refresh.ts` + `routes/oauth/square.ts`; `square-oauth.service` imported by `square-integration.service.ts`. Real semantic merge, not a delete — also resolves the C6 `SQUARE_APPLICATION_SECRET` vs `SQUARE_CLIENT_SECRET` alias split. | One import path |
| C5 | **stg key posture**: `stg` Doppler holds LIVE Stripe keys (flagged in `STAGING_ENVIRONMENT_SPEC.md`) — swap to `sk_test_*`. Blocking for stg money testing. | stg runs test-mode only |
| C6 | **Env-key aliasing trap**: duplicated services read different names for the same console secret — `unifiedConfig` exposes `CLOVER_APP_ID`/`CLOVER_APP_SECRET` but `clover-oauth`/`CloverOAuthSingletonService` read `CLOVER_CLIENT_ID`/`CLOVER_CLIENT_SECRET`/`CLOVER_REDIRECT_URI`; `SquareOAuthService` reads `SQUARE_APPLICATION_SECRET`, `square-oauth.service` reads `SQUARE_CLIENT_SECRET`. Until C4 dedupes, set console secrets under BOTH names. | Aliases documented (or removed by C4) — no "wrong key name" mystery failures |

## 3. Stream A — Payments

Proof matrix target (platform tenant, live data): `$1 order → provider
confirm → webhook → refund → ledger row` per provider, stg then prd.

### A1 — Stripe: formalize the proven path
- Run the matrix on stg (test keys after C5) then prd ($1 real charge).
- Resolve the webhook winner per C2.
- Exit: Stripe prod-verified; documented as the reference implementation
  the other gateways are measured against.

### A2 — PayPal: ship the proven path, bury the dead one
- The `PAYPAL_SDK_PLACEHOLDER.md` decision: go **REST-direct** (axios) —
  matching how the working bespoke route already behaves — rather than
  re-verifying SDK method names. Either port `PayPalGateway` to REST or
  delete it and document the route as THE PayPal path. No third option.
- Live-fire matrix on stg (sandbox creds) then prd ($1 order, capture,
  webhook lands, refund).
- If tenant-collects PayPal is in scope: `paypal-connect` partner
  onboarding gets the same first-prod run.
- Exit: PayPal prod-verified; factory either routes to a working class or
  `paypal` is removed from `GatewayType` with a comment pointing at the
  bespoke route.

### A3 — Square payments: cleanup + first prod run
- **Security pass first**: strip the `console.log` "Environment variables
  check" credential-shape logging → `logger`, no cred-adjacent output.
- Live-fire matrix stg→prd ($1 payment, confirm, refund).
- Square webhook gap: a `/webhook` handler exists on the checkout router
  but its HMAC check runs `crypto.hmac` over `JSON.stringify(req.body)` —
  if the route is mounted behind global JSON parsing the bytes differ and
  verification can never pass (same class of bug as the shadowed Stripe
  handler). Needs a raw-body mount (bootstrap `express.raw` pattern like
  `/api/webhooks`) or signature verification moved to the raw-payload
  layer before any Square webhook is registered in the console.
- Decide Square's scope: payments-live vs POS-only — whichever wins,
  `GatewayType`/factory text must stop lying ("not yet implemented" when
  the route exists).
- Exit: Square payment prod-verified OR explicitly de-scoped in the enum.

## 4. Stream B — POS sync

### B1 — Square POS: first production sync
- First real-tenant (platform tenant) production sync run against
  `VariantAwareSquareSync`.
- Watch: variant/modifier mapping, category quirks, image handling,
  out-of-stock propagation to the storefront.
- Exit: platform tenant catalog synced from a real Square account; issues
  found are filed, not fixed ad hoc.

### B2 — Clover: founding-partner track (the channel play)
Per `CLOVER_POS_STRATEGIC_ANALYSIS.md` §"The Channel Play" and
`docs/LocalBiz/OPERATOR_DISCOVERY_CALL_SPEC.md`:

| Step | Owner | Exit |
|---|---|---|
| Founding-partner pitch (one-pager) | Operator | Merchant agrees |
| Comped tier provisioned | Operator | Tenant exists |
| OAuth install on partner's merchant account | Merchant + operator | `pos=clover` production connection, first real install |
| Flip `CLOVER_USE_REAL_API=true` (prd tenant-scoped) | Dev | Real catalog syncs |
| First-run fix wave | Dev | Sync stable for partner's real catalog |
| Partner feedback loop | Operator | Notes → pitch refinement |

Non-code gates for the channel: Clover developer account, App Market app
review (privacy policy URL, OAuth redirect stability, scopes
justification). App submission is queued *after* the partner install
proves the loop — review wants a working integration.

### B3 — `pos_type` plumbing (ties A→B→discovery)
- `pos_type` flag write from the operator discovery checklist → tenant
  record (parking-lot item promoted into this sprint).
- Outreach ladder + claim-handoff pitch variants read `pos_type`.
- `pos_installed` feeds the claim verification packet (physicality signal).
- Exit: a claimed Clover tenant is routed to the sync-wedge pitch
  automatically.

## 5. Testing & promotion discipline

- **Env vars:** Doppler is source of truth → `stg`→Railway staging,
  `prd`→Railway prod + Fly standby (push via
  `railway variable set --skip-deploys`, then one deploy). Test-mode keys
  in stg, live keys only in prd — C5 blocks stg money tests until fixed.
- **Code path:** staging branch → Railway staging + Vercel preview →
  verify → merge to main → prod. Money-path changes additionally require
  the live-fire matrix on **stg before merge** and re-verified on prd —
  a green build is not a payments test.
- **Proof artifacts:** each matrix run leaves a record (provider, env,
  order/payment id, webhook event id, refund id) appended to this doc's
  log section — the audit trail is the feature.
- **Never again:** no direct prod patches of payment code (the `.bak`
  graveyard's origin story). Hotfix path is staging → fast-tracked merge.

## 6. Risks

| Risk | Mitigation |
|---|---|
| First prod runs surface real bugs (that's the point) | Platform tenant only — blast radius is our own storefront, not a customer's |
| Clover partner install fails OAuth/app config | Dev account + redirect URLs verified before the pitch meeting; emulator still demos the end state |
| App Market review drags | Channel isn't blocked on it — founding partner + manual outreach still works; review is the amplifier |
| Square tenant-collects scope creep | A3 decision gates it; platform-collects is the default until tenants demand otherwise |
| stg live Stripe keys charged real cards | C5 lands before any stg money test |

## 7. Definition of done

- [ ] C1–C5 hygiene closed
- [ ] Live-fire matrix green on **stg + prd** for Stripe, PayPal, Square payments
- [ ] Square POS: one real production sync on the platform tenant
- [ ] Clover: founding partner installed, real sync running, fixes landed
- [ ] Clover App Market submission prepared (review may still be in flight)
- [ ] `pos_type` flows: discovery flag → pitch routing → verification signal
- [ ] Proof matrix log appended below

## 8. Proof matrix log

| Date | Env | Provider | Order/Payment | Webhook | Refund | Notes |
|---|---|---|---|---|---|---|
| | | | | | | |

## 9. Deferred dependency majors (parking lot — 2026-11-02)

Cohort-1 (in-range) updates landed and verified; these were deliberately
**not** bumped — each is a named pass, not silent drift:

| Package | From → To | Deferred because |
|---|---|---|
| `stripe`, `square` | 22→23, 44→46 | In-sprint — bump where money paths get live-tested (A-stream) |
| `@anthropic-ai/sdk`, `openai`, `@mistralai/mistralai`, `googleapis` | →1.3, →7, →3.4, →189 | AI-provider pass — the AI-gateway surface, testable in isolation |
| `auth0` | 5→7 | Two majors in auth code — own pass |
| `prisma` + `@prisma/client` | 6.19→8.0.0-rc / 7.10 | Coordinated migration (client generation changes); wait for stable 8 |
| `typescript` | 6.0.3→7.0.2 | New native compiler — don't touch the build pipeline mid-sprint |
| `aws-sdk` | 1.x | Remove, don't upgrade (legacy v1 alongside v3 clients) |
| `stripe-cli` | deprecated | Remove — dev convenience, upstream renamed |
| `next` | — | Pinned 16.4.3 by `patchedDependencies`; stays until upstream ships the `resolveMetadata` fix |
