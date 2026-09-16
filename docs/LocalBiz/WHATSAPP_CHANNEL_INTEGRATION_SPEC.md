# WhatsApp Channel Integration — Sprint Spec

Status: Revised — gaps closed (2026-09-15). Supersedes the 2026-09-14 draft.
Owner: Platform team
Tier surface: tenant-facing (bot channel) + platform admin (channel connect)
Related specs: `docs/LocalBiz/MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md`, `docs/LocalBiz/directory_presence_claim_handoff_spec.md`

> **Revision note.** This revision closes 4 blockers, 7 high, 4 medium, and the low-severity
> inconsistencies found in the gap review. Every change is traceable via the ledger in §19.
> The largest changes: a **P0 prerequisite fix** for Meta webhook raw-body signature
> verification (§4.1), a corrected **pipeline-extraction contract** that does not double-append
> the user message (§8.2), a **text-rendering layer** for card-based skills (§8.4), and a
> corrected **admin surface + admin API** (§9).

---

## 1. Summary

Add WhatsApp as an **inbound bot channel**: a shopper messages the platform's WhatsApp Business
number, the message is routed to the tenant's existing bot pipeline, and the bot's reply is sent
back over the WhatsApp Cloud API. No new AI, no new conversation model — this sprint **reuses the
existing bot engine** (`BotConversationService` → FAQ/skills → `BotDynamicResponseService` →
guardrails) and the existing Meta webhook + Graph API patterns, and adds only the WhatsApp
transport layer.

This is deliberately **demo-thin**: one platform-owned WhatsApp number, text-in/text-out,
inbound-reply only. Everything else (templates, media, per-tenant numbers, inbox UI, billing
pass-through) is explicitly out of scope and listed in §10.

## 2. Why now (GTM context)

The sales play this unblocks:

1. **Audit** the prospect's business (Business Audit V2 — `mpt-j9bbem3l` / `mpt-6oeuiizo`).
2. The audit's structured output already surfaces the pain: `website.has_availability_inquiry`
   (can shoppers check if a product is in stock via WhatsApp / SMS / click-to-call / web form?).
   A `false`/`null` is the pain, stated by our own deliverable.
3. **Seed** a free `directory_presence` listing from the prospect (load-from-prospect path in
   `presence-seeds/new`), publish it.
4. **Invite** the owner to claim (`/directory/claim/:token`, Claim Path B).
5. **Upsell on the pain**: "your audit shows customers can't check stock — WhatsApp is the
   highest-converting channel for your customer base. We'll build you a site with WhatsApp built in."

The close is the **live demo**: the prospect messages the platform's WhatsApp number and the bot
answers immediately. That requires the loop in this spec to exist before the upsell call.
Everything else in the funnel (audit → seed → claim → upgrade preview) already ships.

> **Demo-critical:** the demo's most likely question is a stock/availability question, which hits
> the **product-search skill** — a card-based response the widget renders client-side. WhatsApp is
> text-only, so §8.4 (text rendering) is a demo requirement, not a nicety.

## 3. Existing infrastructure (what we reuse — this is NOT greenfield)

| Need | Already exists (verified) | Reuse |
|---|---|---|
| Conversation + message store | `bot_conversations` / `bot_messages` via `BotConversationService` | Conversations already carry `source` (free `varchar(20)`, default `'widget'`) and `customer_phone`. WhatsApp is `source: 'whatsapp'` + phone identity for free. |
| Bot brain | FAQ matching, `BotSkillService`, `BotDynamicResponseService` (GPT, multi-turn via `getContextWindow`), `BotGuardrailService` | Called unchanged. The WhatsApp route is a new *transport*, not a new brain. |
| Meta webhook verify | `apps/api/src/routes/meta-webhooks.ts` — GET `hub.challenge` verification + `X-Hub-Signature-256` HMAC check | Same Meta app → same app secret + verify token. WhatsApp messages arrive on the same webhook endpoint; add a handler for the `messages` field. **But see §4.1 — raw-body capture is a prerequisite fix.** |
| Graph API client pattern | `MetaCatalogSyncService.ts` (`https://graph.facebook.com/v21.0`, error logging) | Reuse the base-URL constant and error-logging style for `POST /{phone_number_id}/messages`. Note: that service sends `access_token` in the JSON **body**, not a Bearer header; WhatsApp Cloud API uses `Authorization: Bearer`, which is what we'll do. |
| Secret storage | `apps/api/src/lib/meta/oauth.ts` `encryptToken`/`decryptToken` | WhatsApp uses a **permanent system-user token** — store encrypted with the same helper; no refresh flow needed. **Prerequisite: `OAUTH_ENCRYPTION_KEY` must be set in both Doppler configs (§4.3).** |
| Config surface | `unifiedConfig` env getters (`metaAppSecret`, `metaWebhookVerifyToken`), Doppler | No WhatsApp-specific webhook secret. Channel tokens are stored encrypted per row; no global token fallback is supported. |
| Route registration | `routeRegistry.ts` + `bootstrap.ts` pre-middleware block | Mount the Meta webhook pre-middleware in `bootstrap.ts` (§4.1). |
| Admin bot surface | `/api/admin/bot/*` (`routes/admin/bot-platform.ts`, mounted at `admin.routes.ts` under `authenticateToken + requireAdmin`) + `(platform)/settings/admin/bot/*` UI + `BotPlatformAdminService` | Extend this surface with a Channels page (§9). This replaces the draft's incorrect "admin integration settings page" reference. |

**Net-new surface for this sprint:** one table (+1 dedupe column on `bot_messages`), two services,
one shared bot-turn module, one webhook field branch, one admin API route file, one admin UI page,
one text-rendering module. The draft's "one table, one service, one helper" count was an
underestimate (see §16 sizing).

## 4. Prerequisite fixes (P0 — land before any WhatsApp work)

These are not optional; the WhatsApp loop cannot be verified without them.

### 4.1 Meta webhook raw-body capture (fixes B1)

`verifyWebhookSignature` must compute HMAC over `(req as any).rawBody` only.
Today `req.rawBody` is **never populated**: the only body parser is `express.json({ limit: '50mb' })`
with no `verify` callback (`middleware/bootstrap.ts`), and `meta-webhooks` is registered in
`routeRegistry.ts` as a normal (post-body-parser) route — `mountFromRegistry` runs *after*
`bootstrapMiddleware`. So the HMAC is computed over re-serialized JSON, not the bytes Meta signed.

**Fix (mirrors the existing Stripe Connect pattern):** mount the Meta webhook in the
`bootstrap.ts` pre-middleware block, before the global `express.json`:

```ts
// bootstrap.ts — §6 pre-middleware block, alongside stripe-connect
import metaWebhookRoutes from '../routes/meta-webhooks';

const metaWebhookJson = express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { (req as any).rawBody = buf; },
});

app.use(
  '/api',
  // Scope the raw-body parser to the webhook path only. Mounting it at '/api'
  // unconditionally would apply the 1 MB limit to every /api request (the global
  // parser allows 50 MB) and capture raw bodies for all traffic.
  (req, res, next) => (req.path === '/meta/webhooks' ? metaWebhookJson(req, res, next) : next()),
  metaWebhookRoutes,
);
```

- Remove the `meta-webhooks` entry from `routeRegistry.ts` (avoids a shadowed duplicate mount).
- `verifyWebhookSignature` must require `req.rawBody`; it may not fall back to re-serialized JSON
  for POST verification. A missing raw body is a configuration/programming error and fails closed.
- Add `meta-webhooks` to the pre-middleware inventory in `bootstrap.ts` comments.
- **Scope the parser to the webhook path.** Do not mount a 1 MB `express.json` at `/api`
  unconditionally: it would apply the 1 MB limit to every `/api` request (the global parser allows
  50 MB) and capture raw bodies for all traffic. The path-scoped guard above keeps the limit local
  to `/meta/webhooks`. If the guard's path check ever misses (e.g. a trailing slash), the request
  fails closed with `401` — never fall back to re-serialized JSON.
- **Fail-closed:** change `verifyWebhookSignature` to return `false` (and log an error) when
  `META_APP_SECRET` is unset, instead of the current fail-open `return true`. A misconfigured env
  must not accept unsigned WhatsApp payloads.
- Bonus: this also fixes the same latent bug in `tiktok-webhooks.ts`, which shares the pattern.
  (Out of scope to fix TikTok now, but note it.)

### 4.2 Verify-token decision (fixes B2)

The draft was self-contradictory: it introduced a new `WHATSAPP_WEBHOOK_VERIFY_TOKEN` for the
subscription while instructing us to keep the GET handshake as-is — but the handshake only accepts
`META_WEBHOOK_VERIFY_TOKEN`.

**Decision: reuse `META_WEBHOOK_VERIFY_TOKEN` for the WhatsApp subscription.** Same Meta app, same
webhook endpoint, one verify token. This deletes `WHATSAPP_WEBHOOK_VERIFY_TOKEN` from the config
surface entirely and needs no handshake change. (If a future sprint requires a distinct token, the
handshake must be widened to accept a set — do not add a second token without that change.)

### 4.3 Encryption key assertion (fixes H7)

`encryptToken`/`decryptToken` read `process.env.OAUTH_ENCRYPTION_KEY` at module load with a
`crypto.randomBytes` fallback. If the var is absent in an environment, WhatsApp's long-lived token
becomes **undecryptable across restarts** (silent). Add a startup assertion that
`OAUTH_ENCRYPTION_KEY` is present and 64 hex chars in both `local` and `prd`, and fail fast
otherwise. Confirm the key is identical in both configs (or accept that tokens are per-env).

### 4.4 Widget-pipeline regression tests (fixes M1)

The shared-pipeline extraction (§8.2) touches the live widget path. There are **no existing tests**
covering it. Before the refactor, add characterization tests that pin the widget path's behavior
(guardrail block, lazy creation, skill response, handshake, dynamic vs static, escalation). These
become the safety net for "no behavior change."

## 5. Architecture

```
Shopper (WhatsApp)
   │  text message
   ▼
Meta Cloud API ──POST /api/meta/webhooks   (existing endpoint, new field, now raw-body verified)
   │  1. verify X-Hub-Signature-256 (raw bytes — §4.1)
   │  2. object === 'whatsapp_business_account', field === 'messages'
   ▼
WhatsAppInboundService
   │  a. resolve channel: value.metadata.phone_number_id → whatsapp_channels → tenant_id
   │  b. ignore status-only payloads (value.statuses, no value.messages) → 200
   │  c. for each value.messages[] (loop; batches are possible):
   │       - if type !== 'text' → canned text-only reply, skip pipeline
   │       - find-or-create conversation (session lifecycle §8.5)
   │       - dedupe on wa_message_id (persisted; §7 dedupe column)
   │       - preprocessTurn(): guardrail + persist user message  ← SYNCHRONOUS
   ▼  return HTTP 200  ──────────────────────────────────────────────► Meta (no retry storm)
   │  (async, detached — no queue this sprint; §8.3)
   │  d. completeTurn(): intent → FAQ → skills → dynamic GPT → guardrails
   │  e. renderTextReply(): serialize skill/card results to WhatsApp text (§8.4)
   │  f. persist assistant turn
   ▼
WhatsAppOutboundService
   │  POST /{phone_number_id}/messages   (Authorization: Bearer <channel token>)
   │  { messaging_product: 'whatsapp', to: wa_id, type: 'text', text: { body } }
   ▼
Shopper receives bot reply
```

Key decisions:

- **Tenant routing key = `phone_number_id`.** Sprint scope: a single platform-owned WABA number,
  one row in `whatsapp_channels`. Per-tenant numbers (each merchant gets their own number) is the
  post-revenue model and only needs more rows in the same table — no schema change.
- **Inbound-reply only.** Free-form replies are allowed inside the 24-hour customer-service
  window, which is always open when we're replying to an inbound message. Business-initiated
  **template messages are explicitly out of scope** (Meta template approval + per-conversation
  pricing decisions).
- **Fast acknowledgement after durable intake.** Meta retries on non-2xx. Verify signature →
  validate → resolve → dedupe/persist → return `200` immediately once the inbound user message is
  durable. Guardrail + user-message persistence happen synchronously before the 200; the expensive
  GPT/skill work runs detached. A transient failure before durable persistence may return `500` so
  Meta can retry. Failures after persistence are logged and produce a fallback outbound reply, not
  a Meta retry.
- **One brain, two transports.** The pipeline is extracted into a shared module (§8.2); the widget
  route and the WhatsApp transport both call it.

## 6. Meta-side prerequisites (operator checklist, start early)

1. Meta app (the existing one) → **add product: WhatsApp**.
2. Business verification — likely already satisfied (Commerce integration runs in production);
   confirm in Business Settings.
3. WhatsApp Business Account (WABA) + platform phone number. For the sprint, Meta's **test number
   + up to 5 verified test recipients** is sufficient for the demo and removes provisioning risk.
4. Create a **system user** with `whatsapp_business_messaging` + `whatsapp_business_management`
   permissions → permanent access token → store encrypted (same helper as Meta OAuth tokens).
5. Webhook subscription on the app: callback URL = existing `/api/meta/webhooks`, verify token =
   **the existing `META_WEBHOOK_VERIFY_TOKEN`** (§4.2), subscribe to the `messages` field on the WABA.

### 6.1 Tenant prerequisites (fixes H6)

The channel row maps one platform number → one `tenant_id`. For the live demo to answer anything,
the mapped tenant must have:

- an **active** `bot_configurations` row (`configService.getOrCreate` + `status === 'active'`;
  otherwise the widget path returns `bot_disabled`), and
- the **`chatbot.enabled`** capability (`resolveEffectiveCapabilities`; otherwise `403
  capability_disabled`), and
- FAQ/knowledge content that answers the demo questions (the product-search skill is gated on
  `chatbot.skills_enabled` and the skill type allow-list).

Decide and record the **demo tenant id** in the channel row. The WhatsApp transport must define
behavior for disabled tenants: **log + send a single generic "assistant is unavailable" reply**
(never silently drop, never 403-loop). Add a startup/admin validation that the mapped tenant is
demo-ready.

## 7. Data model

One migration: `database/migrations/275_whatsapp_channels.sql` (next free number after `274`).

```sql
-- 275_whatsapp_channels.sql
CREATE TABLE IF NOT EXISTS whatsapp_channels (
  id                    varchar(255) PRIMARY KEY,        -- 'wac-...' via id-generator
  tenant_id             varchar(255) NOT NULL,           -- matches tenants.id / bot_conversations.tenant_id
  phone_number_id       varchar(64)  NOT NULL,           -- Meta WABA phone number id (routing key)
  display_phone_number  varchar(32),
  access_token_encrypted text        NOT NULL,           -- permanent system-user token, encrypted
  status                varchar(20)  NOT NULL DEFAULT 'active',
  created_by            varchar(255),
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_whatsapp_channels_phone_number_id
  ON whatsapp_channels (phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_tenant_id
  ON whatsapp_channels (tenant_id);

ALTER TABLE whatsapp_channels
  ADD CONSTRAINT chk_whatsapp_channels_status
  CHECK (status IN ('active', 'inactive'));

-- Dedupe: a first-class column instead of a JSON-metadata scan (fixes M2 dedupe race + no-index).
ALTER TABLE bot_messages ADD COLUMN IF NOT EXISTS wa_message_id varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS ux_bot_messages_wa_message_id
  ON bot_messages (wa_message_id) WHERE wa_message_id IS NOT NULL;
```

Notes:

- **`id varchar(255)`** (not `varchar(40)`) matches the repo's current migration convention
  (e.g. `274_mkt_outreach_anchors.sql`).
- **`tenant_id varchar(255)`** matches `tenants.id` (Prisma `String` → varchar(255)) and
  `bot_conversations.tenant_id`. A `varchar(40)` column would break a FK and is inconsistent.
- `created_by` + `audit()` on channel writes (operator-table convention).
- The dedupe column is **nullable**, so all existing/widget rows are unaffected; a partial unique
  index allows many NULLs while preventing duplicate WhatsApp message ids globally.
- **RLS:** `bot_*` tables carry RLS per the Prisma schema comments. `whatsapp_channels` must match
  the posture the app role actually runs under (the app accesses `bot_*` directly today, so no
  blocking policy is added). Verify against the deployed role; do not add a policy that breaks the
  service.

Discipline:

- Apply manually against **local + prd**: `psql $DATABASE_URL -f database/migrations/275_whatsapp_channels.sql`.
- Then `pnpm prisma db pull && pnpm prisma generate` (per `AGENTS.md`).
- Add `generateWhatsAppChannelId` to `apps/api/src/lib/id-generator.ts` (prefix `wac-`, nanoid,
  matching existing helpers).
- Extend `BotConversationService.appendMessage` with an optional `waMessageId` param and add it to
  `toMessage`/the `BotMessage` interface. Handle the unique-violation as a **duplicate signal**
  (return the existing row) rather than an error.

## 8. Backend changes

### 8.1 Webhook extension — `apps/api/src/routes/meta-webhooks.ts`

- Add a branch **before** the Commerce field `switch`:
  `object === 'whatsapp_business_account'` → for each `entry[].changes[]` where
  `field === 'messages'` → hand `value` to `WhatsAppInboundService`.
- Loop `value.messages[]` (batches are possible); ignore payloads that only contain
  `value.statuses` (read/delivered receipts) with a 200.
- Signature verification is now over raw bytes (§4.1) and fail-closed.
- Keep the GET `hub.challenge` verify as-is (single token — §4.2).
- The existing `switch` already routes unknown fields to a log, so Commerce is unaffected even
  before the `object` check; the `object` check makes intent explicit and prevents future field
  name collisions.

### 8.2 Shared bot-turn module (fixes B3) — `apps/api/src/services/bot/BotTurnPipeline.ts`

The pipeline is currently inline in `bot-public.ts` (guardrail-before-create, lazy creation,
capability gates, handshake, BERT, dynamic, static+steering, two escalation blocks). Extract it
into a module that **does not write to `res` and does not persist the assistant message**:

```ts
// Decision-only. No Express, no res, no assistant persistence.
export async function preprocessTurn(
  conversation: BotConversation,
  rawText: string,
): Promise<TurnPre>; // { guardrail, userText, blocked?: { reply: string } }

export async function completeTurn(
  conversation: BotConversation,
  pre: TurnPre,
  config: BotConfig,
): Promise<TurnResult>; // { reply, responseType, intent?, confidence?, matchedFaqId?, skillName?,
                         //   skillCard?, skillData?, channels?, escalated?, assistantMetadata? }
```

- `preprocessTurn` owns the **user-message append** (guardrail-modified text). The WhatsApp inbound
  path must **not** append the user message separately — the draft's architecture step (d) is
  removed. This closes B3.
- `completeTurn` returns a structured `TurnResult` instead of writing `res`; both transports then
  call a shared `persistAssistantTurn(conversationId, result, content)`.
- **Widget route** (`bot-public.ts`): calls `preprocessTurn` → `completeTurn` → `persistAssistantTurn`
  with `content = result.reply`, then shapes `res.json` exactly as today. Behavior must be
  unchanged (guarded by §4.4 tests).
- **WhatsApp transport**: calls `preprocessTurn` → persist (done, synchronous) → 200 →
  `completeTurn` → `renderTextReply(result)` → `persistAssistantTurn(content = rendered text)` →
  outbound send.
- **Capability handling:** `completeTurn` returns a `capability_disabled` outcome instead of a 403;
  the WhatsApp transport maps it to the §6.1 generic unavailable reply.

### 8.3 Async processing decision (fixes H1)

There is **no job queue** in the API (no BullMQ/pg-boss). Decision for this sprint:

- **Synchronous (before the 200):** signature verify, payload validation, channel resolve, dedupe,
  conversation find-or-create, and `preprocessTurn` (guardrail + user-message persist).
- **Detached (after the 200):** `completeTurn` (GPT/skills), rendering, assistant persist, and
  outbound. The detached path is wrapped in a try/catch that logs with a correlation id and sends
  the configured fallback reply on completion failure.
- **Per-sender intake mutex (synchronous):** conversation selection, archive/create, dedupe claim,
  and the durable user-message persist run under a single per-sender mutex keyed by
  `channel_id + wa_id`. The mutex is held only for that fast DB critical section, then released
  before the `200`. This is what prevents two concurrent deliveries for the same sender from
  creating two active rows (see §8.5); it does not cover the detached work below.
- **Per-sender completion chain (detached):** `completeTurn`, rendering, assistant persist, and
  outbound are chained FIFO by `channel_id + wa_id` within the process, so a later reply for the
  same sender is delivered after the prior one. Different senders run concurrently.
- Both mechanisms are in-process and best-effort across replicas; durable ordering and delivery are
  required before production scale (see §18).
- **Synchronous failure policy:** invalid signatures return `401`. Validly signed but malformed
  payloads return `200` after logging. Unknown channels, duplicates, status-only events, and
  unsupported message entries return `200`. A transient failure before durable dedupe/persistence
  returns `500` so Meta may retry; after the inbound message is durably persisted, processing
  failures must not cause a Meta retry.
- **Trade-off accepted:** a process restart between the 200 and outbound can drop a reply. This is
  acceptable for a demo-thin sprint. A durable queue with retry, ordering, and dead-letter handling
  is explicitly post-sprint and listed in §18.

### 8.4 Text rendering for card-based responses (fixes B4) — `apps/api/src/services/whatsapp/WhatsAppTextRenderer.ts`

WhatsApp is text-only; the widget renders `skillCard`/`skillData` and `channels` client-side.
Without rendering, a stock/availability question returns the literal `"Here's what I found:"` and
nothing else — the exact demo failure mode.

`renderTextReply(result: TurnResult): string`:

- `responseType === 'skill'`: map `skillName` + `skillData` to a compact text summary
  (e.g. product search → up to 5 lines `Name — price — stock status`, plus a "reply with a product
  name for details" line). Maintain a small per-skill formatter registry; the **product/availability
  skill is required for the demo**.
- If no formatter exists for a skill → **fall through to the dynamic/static reply** (never emit a
  bare "Here's what I found:").
- `channels` (channel steering) → append "You can also reach us via: …".
- **Markdown:** convert the bot's markdown to WhatsApp syntax (`**bold**` → `*bold*`,
  `_italic_` stays, lists → `•`). Add a `toWhatsAppMarkdown()` helper.
- **Length:** WhatsApp text bodies cap at **4096 chars** — truncate with an ellipsis at a word
  boundary.

### 8.5 Session lifecycle (fixes H2)

`session_id = 'wa-{phone_number_id}-{wa_id}'` (deterministic). Rules:

- On inbound, load the latest conversation by `session_id`. **Reuse** it iff `status === 'active'`
  and the conversation is within the application session TTL. The TTL is measured from the latest
  inbound user message (`updated_at` after the durable user append), not only from `created_at`.
  This is deliberately an application context-window policy; it must not be described as identical
  to Meta's customer-service window. Otherwise **archive the old row and create a new conversation**
  with the same `session_id`.
- Conversation selection and archive/create must run under the per-sender intake mutex defined in
  §8.3, so two concurrent webhook deliveries cannot create two active rows for the same sender.
- Add a helper `getReusableConversationBySession(sessionId)` implementing this, rather than relying
  on `getConversationBySession` (which has no status filter).
- **Greeting:** `createConversation` currently always inserts a greeting assistant message, which
  would be a phantom (never-delivered) transcript row on WhatsApp. Add an option
  `skipGreeting?: boolean` (default `false` to preserve widget behavior). WhatsApp passes `true`.
  (Alternative — send the greeting as the first outbound — is rejected: it costs an extra send and
  the pipeline reply is the meaningful response.)
- `bot_conversations` has an index on `session_id` but **no unique constraint**; multiple rows per
  session across 24h windows are expected and `findFirst … orderBy created_at desc` resolves to the
  newest. Document this so it isn't "fixed" into a unique index later.

### 8.6 `WhatsAppInboundService` — `apps/api/src/services/whatsapp/WhatsAppInboundService.ts`

- Validate the webhook envelope and the required message subset with Zod before business logic.
  Unknown Meta fields are allowed, but required identifiers, message type, sender, and text body
  must be bounded and well-formed. A malformed individual message is logged and skipped without
  poisoning the rest of a valid batch.
- `resolveChannel(phoneNumberId)` → active channel row or ignore (log + 200).
- Ignore status-only payloads; loop `messages[]` sequentially for synchronous dedupe/persistence.
- **Non-text messages** (`image`, `audio`, `interactive`, `location`, …): send one canned
  "I can only read text right now" reply and skip the pipeline. (Media is out of scope, but it must
  not throw.)
- Dedupe via `bot_messages.wa_message_id` (unique index); duplicate → log + 200, no second reply.
- Find-or-create per §8.5; store `wa_profile_name` (from `value.contacts[].profile.name`) in the
  user message metadata; set `source = 'whatsapp'`, `customer_phone = from`.
- `preprocessTurn` → 200 → detached `completeTurn` + render + persist + outbound.
- **Per-`wa_id` soft guard:** lightweight in-memory counter to blunt abuse (the widget's per-session
  limiter doesn't apply here). Meta throttles, but we should too. This is best-effort only: it is
  process-local, resets on restart, must evict expired sender keys, and does not replace a shared
  rate limiter before production scale.
- Bound inbound text to the same 1,000-character limit as the widget before guardrail/LLM work.
- Do not log raw message text, phone numbers, profile names, access tokens, or full provider payloads.
  Use redacted identifiers and correlation ids; profile name is stored only in message metadata when
  supplied and is not forwarded to the LLM unless an explicit future decision allows it.
- **Failure handling:** if `completeTurn` throws, log with a correlation id and send the configured
  fallback message; never surface an error to Meta. If fallback delivery fails, record a dead-letter
  log entry with the Graph error code and do not retry indefinitely.

### 8.7 `WhatsAppOutboundService` — `apps/api/src/services/whatsapp/WhatsAppOutboundService.ts`

- `sendText(channel, to, body)` → `POST /{phone_number_id}/messages` with
  `Authorization: Bearer <decrypted channel token>`, body
  `{ messaging_product: 'whatsapp', to, type: 'text', text: { body } }`.
- Graph error envelope: parse `error.message` / `error.code` / `error.error_subcode` and log with
  the same style as `MetaCatalogSyncService`.
- **429:** honor `Retry-After` with a **single** retry; on second failure log + drop (dead-letter
  log line). Do not retry more (detached path lifetime).
- Log the outbound `wa_message_id` for correlation with the inbound id.
- Truncate body to 4096 chars (belt-and-braces with §8.4).
- Mark `resolved_by` / status transitions only per existing bot semantics — no new states.

### 8.8 Config and secret handling

There is no global `WHATSAPP_ACCESS_TOKEN` fallback. The channel row's encrypted token is the only
send credential. This keeps channel ownership explicit and prevents a development credential from
being accidentally used for the wrong tenant or number.

- The admin create/rotate API accepts a token write-only, encrypts it immediately, and never returns
  it. A token fingerprint or last-four indicator may be returned for operator verification.
- `OAUTH_ENCRYPTION_KEY` must be supplied through the configuration layer, must be exactly 64 hex
  characters, and must not have a random/default fallback. Initialization fails closed before channel
  operations are enabled when it is missing or invalid.
- Key rotation is an explicit operational procedure: re-encrypt all stored OAuth/channel tokens under
  the new key before switching application instances, or accept that all channel tokens must be
  re-entered. The chosen procedure must be documented in the runbook.
- **Removed from the draft:** `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (reuse `META_WEBHOOK_VERIFY_TOKEN`,
  §4.2), `whatsappAppSecret` (same app → use existing `metaAppSecret`), and
  `WHATSAPP_ACCESS_TOKEN`. This eliminates the redundant/ambiguous config surface.

### 8.9 Guardrails

Unchanged. WhatsApp inherits the same guardrail service; no channel-specific rules this sprint.

## 9. Admin surface (fixes H4, H5)

### 9.1 Corrected target

The draft's "admin integration settings page" does not exist. The real platform-admin bot surface is:

- **API:** `/api/admin/bot/*` — `routes/admin/bot-platform.ts`, mounted in `admin.routes.ts` under
  `authenticateToken + requireAdmin`.
- **UI:** `apps/web/src/app/(platform)/settings/admin/bot/*`, served by
  `apps/web/src/services/bot/BotPlatformAdminService.ts`.

Add the WhatsApp channel card here, **not** to the merchant-scoped
`/t/[tenantId]/settings/integrations/*` pages (which §10 keeps out of scope).

### 9.2 Admin API (new — absent from the draft)

`apps/api/src/routes/admin/bot-channels.ts`, mounted at `/api/admin/bot/channels`
(`authenticateToken + requireAdmin`):

- `GET /` — list channels (id, tenant_id, phone_number_id, display_phone_number, status,
  created_at, updated_at). **Token never returned.**
- `POST /` — create channel (validates `phone_number_id` uniqueness, tenant exists). Encrypts the
  token. Calls `audit(..., { actorType: 'user' })`.
- `PUT /:id` — update display name / status / rotate token (write-only). Audited.
- `DELETE /:id` — deactivate (soft) — prefer status flip over hard delete. Audited.

### 9.3 Admin UI

- New page `(platform)/settings/admin/bot/channels/page.tsx` + `BotPlatformAdminService` methods.
- Form: paste `phone_number_id`, `display_phone_number`, token (password field, never re-rendered),
  tenant selector, status. Mirrors the Meta OAuth token handling (write-only).
- Link from the existing bot dashboard (`(platform)/settings/admin/bot/page.tsx`).

### 9.4 Conversation visibility (corrects H5)

- There is **no platform-admin conversation list**; the only list is the tenant-scoped
  `GET /api/tenants/:tenantId/bot/conversations` → `BotConversationService.listConversations`,
  which filters **only** by `status`.
- **Fix:** add a `source?: string` option to `listConversations` (and the route query param), so
  WhatsApp conversations can be filtered. The conversations appear automatically because they share
  the `bot_conversations` table.
- UI source filter is a stretch item; the API filter is in scope so operators can query
  `source=whatsapp`.

## 10. Sprint scope

**In:**

- P0 prerequisites: raw-body capture (§4.1), verify-token decision (§4.2), encryption-key assertion
  (§4.3), widget-pipeline characterization tests (§4.4).
- Migration `275` (channels table + `bot_messages.wa_message_id` dedupe column) + id-generator prefix.
- WhatsApp branch in the existing Meta webhook (raw-body verify + `messages` field, batched loop,
  status-only ignore).
- Shared `BotTurnPipeline` extraction (`preprocessTurn` / `completeTurn`) with the widget path
  refactored onto it (behavior unchanged).
- Inbound → existing bot pipeline → **text-rendered** outbound reply (single platform number).
- `WhatsAppTextRenderer` (skill/product → text, markdown conversion, 4096-char truncation).
- Encrypted per-channel token storage (the channel row is the only send credential; no global
  token getter).
- Admin channel CRUD API + admin Channels page.
- `source` filter on `listConversations`.
- Idempotent webhook processing (200-always, durable dedupe by `wa_message_id`, non-text handling,
  status-only handling, per-`wa_id` soft guard).
- Directory-surface WhatsApp presence (`directory_entry_whatsapp_on`, flavor A) and the bot-channel
  entitlement registered as a capability (flavor B) — both independently keyed (§15).
- Tests (§17).

**Out (explicitly):**

- Business-initiated template messages + template management UI.
- Media, location, interactive buttons/messages (inbound media gets a canned text-only reply).
- Per-tenant WABA numbers (schema already supports it — rows, not columns).
- Usage billing / pass-through of Meta per-conversation pricing.
- Human handoff / shared inbox UI (conversations visible in the tenant list; replying is a later
  sprint).
- Durable job queue / retry / dead-letter for outbound (see §8.3 trade-off).
- Multi-number load balancing; read receipts beyond ignore.
- Platform-admin conversation list (only the tenant list + `source` filter this sprint).
- Merchant-facing channel UI (the only channel UI this sprint is the platform-admin Channels page,
  §9); the tenant `settings/integrations/*` pages are untouched.
- Public click-to-chat to a Meta **test** number (verified recipients only); flavor B's public
  presence waits for a real approved number (§15).

## 11. Privacy, retention, and customer disclosure

WhatsApp introduces phone numbers, WhatsApp IDs, and optional profile names into the bot data path.
For this sprint:

- The user must be told that they are interacting with an automated assistant and that messages may
  be stored to provide continuity and support escalation.
- Phone numbers and WhatsApp IDs are operational identifiers, not log content. Logs use redacted
  values and correlation ids. Raw message bodies, profile names, tokens, and full Meta payloads are
  not logged.
- `customer_phone` and `wa_profile_name` remain covered by the existing customer-data erasure path.
  Add a test proving that WhatsApp conversations and message metadata are removed or anonymized by
  the existing erasure operation.
- Profile names are stored for operator context but are not sent to the LLM prompt in this sprint.
- Retention follows the existing bot conversation retention policy. If no policy exists for the
  tenant, the implementation must not invent indefinite retention; document the default and the
  deletion job before production launch.
- No outbound message is initiated outside the customer-service response to an inbound message.
  Template messaging, marketing consent, and business-initiated messaging remain out of scope.

## 12. Marketing strategy and GTM integration

WhatsApp is a conversion and proof channel in this sprint, not a standalone messaging product.
The primary strategy is to use the live demo to convert a documented visibility pain into a paid
platform engagement.

### Funnel role

1. **Diagnose:** Business Audit V2 identifies a customer-availability gap, especially
   `website.has_availability_inquiry = false/null`.
2. **Establish presence:** Create and publish the prospect's directory seed, then invite the owner
   to claim it using the existing directory claim flow.
3. **Demonstrate:** Route the prospect to the platform-owned WhatsApp number and show a real FAQ,
   availability, or product-search response from the demo tenant.
4. **Translate value:** Position the result as a working customer-access channel, not as an AI demo:
   fewer “is this in stock?” calls, faster answers, and a measurable path from local discovery to
   conversation.
5. **Convert:** Offer the next paid step—tenant-owned bot deployment, website integration, catalog
   and FAQ configuration, or a broader marketing-ops engagement. The exact package and pricing are
   commercial decisions and must not be implied by this transport sprint.
6. **Prove:** Capture demo events and downstream conversion attribution so the team can distinguish
   “message received,” “answer delivered,” “owner engaged,” “claim completed,” and “purchase created.”

### Audience and message discipline

- The live demo is for prospects and sales operators; it is not a public promise that every tenant
  already has WhatsApp support.
- The demo number must identify the business context and avoid implying that the platform number is
  the merchant's own number.
- Stock and availability responses must be grounded in the demo tenant's configured catalog. The bot
  must not claim real-time inventory freshness unless the underlying catalog sync supports it.
- Marketing copy must not claim a conversion lift until the platform has measured one. Initial claims
  should be capability-based: “customers can ask,” “the assistant can answer,” and “the interaction
  is recorded for follow-up.”
- No unsolicited WhatsApp outreach is part of this sprint. Owner invitations continue through the
  existing email/web claim and marketing-ops flows unless a future consented WhatsApp campaign is
  separately approved.

### Attribution requirements

Add or reserve analytics events for:

- `whatsapp_inbound_received`
- `whatsapp_reply_sent`
- `whatsapp_reply_failed`
- `whatsapp_demo_question_answered`
- `whatsapp_demo_escalated`
- `whatsapp_claim_or_purchase_assisted`

Events should carry tenant/channel/campaign context and redacted conversation identifiers, never raw
phone numbers or message text. Attribution must remain compatible with the existing marketing-ops
campaign and business-prospect grouping model.

## 13. Platform capability architecture integration

WhatsApp is a channel capability layered onto the existing bot capability model. It must not create a
parallel enablement system or bypass tenant gates.

### Capability evaluation

The inbound path evaluates, in order:

1. The channel row exists and is `active`.
2. The mapped tenant exists and is demo-ready.
3. The tenant's `chatbot.enabled` capability is effective.
4. The tenant has an active `bot_configurations` row.
5. Required skill gates are effective—for example, `chatbot.skills_enabled` and the product-search
   allow-list for availability questions.
6. The current bot configuration and knowledge/catalog data are available.

`resolveEffectiveCapabilities` remains the source of truth. Do not add a `whatsapp_enabled` boolean
that can disagree with the existing capability hierarchy during this sprint. If channel-specific
entitlements are needed later, add them as a registered capability with tier, tenant override, and
platform override semantics rather than a hard-coded service check.

### Disabled and degraded states

- A disabled channel is ignored with `200` and an operator-visible log/metric.
- A valid channel mapped to a tenant whose bot is disabled receives one generic unavailable reply,
  persisted as a fallback outcome; it must not return a `403` to Meta or enter a retry loop.
- A required skill that is disabled falls through to the existing static/dynamic behavior or a
  grounded fallback. It must not expose the widget's card-only payload over WhatsApp.
- A missing or stale catalog must not be represented as confirmed availability. The renderer should
  state when the answer is not available or direct the shopper to an approved support channel.

### Architecture boundaries

- `meta-webhooks.ts` is transport routing and signature verification only.
- `WhatsAppInboundService` owns payload normalization, channel resolution, dedupe, session selection,
  and dispatch.
- `BotTurnPipeline` owns shared bot decisions and capability gates.
- `WhatsAppTextRenderer` owns channel-specific presentation conversion.
- `WhatsAppOutboundService` owns Graph API delivery and provider errors.
- Admin channel CRUD owns credentials and channel lifecycle; tenant bot configuration remains in the
  existing bot admin/tenant surfaces.

This preserves the platform's “one brain, multiple transports” model and keeps future channels,
including SMS or other social messaging transports, from duplicating bot business logic.

## 14. Future roadmap: multilingual customer assistance

The platform is currently English-first. Prospects whose customer base primarily communicates in
another language may represent both a product opportunity and a diagnosable accessibility gap.
WhatsApp is a natural entry point because it is often a preferred customer channel in multilingual
communities.

Multilingual support is **not part of this sprint**. It is a future roadmap item that should evolve
through the shared bot pipeline rather than through a WhatsApp-only translation wrapper.

### Opportunity and GTM use

- Use audit, prospect, and campaign signals to identify businesses with a majority foreign-language
  customer base or a language-access gap.
- Demonstrate the opportunity through customer-language demand and unanswered-question metrics before
  promising language coverage.
- Position the future offer as localized customer assistance—product questions, availability, hours,
  policies, and escalation—not as a generic machine-translation feature.
- Potential future commercial components include language setup, approved knowledge localization,
  multilingual channel configuration, quality monitoring, and language-specific analytics.

### Future architecture direction

- Detect probable language and retain a bounded `language_code` plus confidence, not unnecessary raw
  message content.
- Add capability/configuration controls through the existing platform capability model, such as
  `chatbot.multilingual_enabled`, `chatbot.default_language`, `chatbot.supported_languages`, and
  `chatbot.language_detection_enabled`.
- Keep language detection, localization, and response rendering in shared bot services so WhatsApp,
  the widget, and future channels use the same behavior.
- Keep structured facts such as prices, inventory, hours, and policies language-neutral; localize the
  presentation layer and require approved translations for sensitive or legal content.
- Preserve the original customer message alongside any translation when human escalation occurs,
  subject to the platform's privacy and retention rules.
- Measure `language_detected`, `language_unsupported`, `multilingual_answered`, and
  `multilingual_escalated` outcomes by tenant and campaign.

### Decisions deferred to that roadmap item

- Which languages and locales are commercially prioritized.
- Automatic detection versus user-selected language, or both.
- Direct generation in the target language versus translation from a canonical response.
- Human approval requirements for business, policy, legal, price, and availability content.
- Quality thresholds, provider costs, tenant tiering, and multilingual escalation workflows.

The current WhatsApp implementation must avoid adding English-only assumptions to new transport code
and must keep `BotTurnPipeline` capable of accepting a future localized `TurnResult`.

## 15. Directory surface WhatsApp presence (two independently-keyed flavors)

WhatsApp can appear on the **directory surfaces** (the public listing/entry pages and the owner-facing
seed report) as well as on the bot channel. These are **two separate capabilities** that may be
enabled independently, together, or neither:

| Flavor | Capability | What it does | Requires Cloud API? |
|---|---|---|---|
| **A — surface presence** | `directory_entry_whatsapp_on` (display capability in the `directory_entry_*` family) | Renders a `wa.me/<E.164>` click-to-chat action on the listing surface | No — pure deep link |
| **B — bot channel** | channel entitlement, registered as a capability (NOT a `whatsapp_enabled` boolean — see §13) | The destination is a bot-backed WABA number; the assistant answers | Yes (this sprint) |

Independence rules:

- A does not imply B, and B does not imply A.
- **A only** → the CTA targets the merchant's verified WhatsApp number; no bot.
- **B only** → the channel is reachable via other surfaces; no directory CTA.
- **A + B** → the CTA targets the channel number and the bot answers.

### Wiring (reuses the existing directory-entry capability chain)

1. **Register the key** `directory_entry_whatsapp_on` (+ legacy `_enabled` alias) in the capability
   registry that feeds `rawCaps.capabilities.directory_entry.features`
   (`EffectiveCapabilityResolver.ts` → `resolveDirectoryEntryOptions`). These keys are data-driven,
   not code-only — confirm the registry/tier-mapping source before assuming a code edit is enough.
2. **Resolver** — add `whatsapp_enabled` + `can_show_whatsapp` to `DirectoryEntryOptionsResolver`
   using the exact `contact_enabled` shape: `mainOn && (flexible || feature) && merchantPref !== false`.
3. **Types** — add both fields to `EffectiveDirectoryEntryOptions` (`services/resolvers/types.ts`).
4. **Frontend** — add to `DirectoryEntryOptionsState` (`CapabilityResolutionService.ts`) and
   `mapDirectoryEntry` (`UnifiedCapabilityService.ts`).
5. **UI** — add the action to the four `directory/[slug]/layouts/*` sidebars (alongside the existing
   contact/social blocks) and to `ContactInformationCollapsible`; decide the `place/[slug]` unclaimed
   seed surface separately.
6. **Merchant pref** — `whatsapp_display` in `directory-entry-options-settings.ts` (claimed listings
   only; the unclaimed seed path has no merchant prefs).
7. **Tier mirror + display** — `TIER_FEATURES` / `FEATURE_DISPLAY_NAMES` (`tier-features.ts`) and the
   `directory_entry_options` entry in `capability-display.ts`.
8. **Owner-facing surface** — `SeedReportPreview` (on `/place/[slug]`) is a separate, high-leverage
   surface for the GTM proof point; treat it as its own decision, not an automatic consequence of A.

### Number provenance (mandatory rules)

- A `wa.me` link requires an **explicit, verified** WhatsApp number in E.164 without `+`. **Never
  derive one from the seeded NAP phone** — landlines and unregistered numbers fail silently.
- Claimed listings: merchant-provided number, or the channel number when B is enabled.
- Unclaimed seeds: `merchantPrefs` is null, so only tier features apply. Default: do **not** render a
  merchant WhatsApp CTA on an unclaimed seed.
- **Never point a public CTA at a Meta test number.** Test numbers only message verified recipients,
  so flavor B's *public* presence must wait for a real approved number; flavor A is unaffected.

### Capability semantics

- `directory_entry_flexible` implicitly grants A today (it grants every section flag) — decide whether
  that is intended for a channel-facing action before shipping.
- Keep A (display) and B (entitlement) as separate keys; do not collapse them into one boolean.

## 16. Implementation plan (suggested order)

1. **P0:** raw-body capture + fail-closed signature check (§4.1); verify-token decision (§4.2);
   encryption-key assertion (§4.3).
2. **P0:** widget-pipeline characterization tests (§4.4) — `pnpm test` green.
3. Migration `275` + Prisma `db pull` + `pnpm prisma:generate`; id-generator prefix.
4. Extract `BotTurnPipeline` (`preprocessTurn`/`completeTurn`); refactor widget route onto it;
   `pnpm checkapi` green and §4.4 tests still green (no behavior change).
5. `WhatsAppInboundService` + webhook `messages` branch + dedupe column wiring + session lifecycle.
6. `WhatsAppTextRenderer` (§8.4) — product/availability formatter first.
7. `WhatsAppOutboundService` + Graph call + error envelope + 429 single retry.
8. Admin channel CRUD API + admin Channels page + `source` filter on `listConversations`.
9. Tests (§17) + Meta test-number end-to-end pass.

**Sizing correction:** the draft framed this as "one table, one service, one helper, one webhook
branch, one admin view." It is actually two services + a shared turn module + a text renderer +
a webhook branch + an admin API + an admin page + a migration with two schema objects + tests.
Plan accordingly.

## 17. Verification

```bash
pnpm checkapi
pnpm checkweb
cd apps/api && pnpm test            # vitest run
```

Automated tests (locations follow repo convention — `apps/api/src/services/__tests__/` for unit,
`apps/api/src/tests/` for route/supertest):

- `BotTurnPipeline.test.ts` — characterization of the extracted pipeline (block, lazy create,
  skill, handshake, dynamic vs static, escalation) — **also serves as the widget regression net**.
- `WhatsAppInboundService.test.ts` — Zod payload validation; parse → dedupe → conversation
  find-or-create → pipeline dispatch; status-only ignore; malformed-entry isolation; non-text canned
  reply; unknown-channel ignore; session reuse vs new-window creation; same-sender serialization;
  transient pre-persistence failure versus post-persistence failure response policy.
- `WhatsAppOutboundService.test.ts` — outbound payload shape; Graph error envelope; 429 single
  retry; 4096 truncation; redacted logging; invalid/revoked token handling.
- `WhatsAppPrivacy.test.ts` or equivalent service coverage — WhatsApp phone/profile metadata is
  covered by erasure and raw body/text/token values do not enter logs or LLM prompts.
- Capability integration coverage — disabled channel, disabled tenant capability, inactive bot
  configuration, disabled skill, and stale/missing catalog each produce the specified outcome.
- Marketing attribution coverage — inbound, sent, failed, escalated, and campaign-associated events
  contain tenant/campaign context without raw phone numbers or message text.
- Directory presence coverage — `directory_entry_whatsapp_on` resolves `whatsapp_enabled` /
  `can_show_whatsapp`; flavors A and B enable independently (A-only, B-only, both, neither); no CTA on
  unclaimed seeds unless explicitly enabled; no `wa.me` link derived from a NAP phone.
- `WhatsAppTextRenderer.test.ts` — product/availability formatting; markdown conversion; skill
  fall-through.
- `meta-webhooks.whatsapp.test.ts` — signature verify over **raw bytes** (supertest with a raw
  body); `object` routing; batched messages.
- Register new routes in `routeRegistry.ts`/`admin.routes.ts` or `pnpm test:routes`
  (`route-coverage.test.ts`) may fail.

Manual E2E (test number):

- GET handshake: Meta "Verify and save" succeeds against `/api/meta/webhooks` with the existing
  `META_WEBHOOK_VERIFY_TOKEN`.
- Send "What are your hours?" from a verified test recipient → bot replies from the existing
  FAQ/config path; `bot_conversations` row has `source='whatsapp'`, `customer_phone` set.
- Send a stock/availability question → **text-rendered product list** (not "Here's what I found:").
- Send a guardrail-triggering message → guardrail result recorded, no crash.
- Send an image → canned text-only reply, no crash.
- Duplicate webhook delivery (same `wa_message_id`) → no duplicate `bot_messages` row, no second reply.
- Message from an unknown `phone_number_id` → ignored with 200.
- Status-only webhook (read receipt) → 200, no reply.
- Returning shopper after >24h → new conversation in a new window; no append to an archived row.

## 18. Risks, accepted tradeoffs, and launch decisions

### External risks and accepted demo tradeoffs

- **Meta verification timing** — if business verification lapsed or the WABA needs review,
  provisioning stalls; the test-number path exists to keep the sprint unblocked. Start §6 on day 1.
- **Test number limit** — 5 recipients is fine for demos, not for a paying merchant; production
  requires a real number + display-name approval (post-close work).
- **Per-conversation pricing** — service conversations have Meta-side costs; pass-through vs.
  bundled pricing is a business decision, deferred. No billing code this sprint.
- **Shared Meta app blast radius** — WhatsApp messages arrive on the same webhook endpoint as
  Commerce events; the `object` switch must be added before any WhatsApp subscription is enabled.
  Ship the branch first, subscribe second.
- **Async drop window (§8.3)** — a restart between the 200 and outbound loses the reply. Accepted
  for the sprint; a durable queue is the first post-sprint hardening item.
- **Rate limits** — Cloud API tier limits are per-phone-number; demo volume is far below them. The
  outbound service honors 429 with a single retry, then drops + logs. The application soft guard is
  process-local and is not a production abuse-control boundary.
- **`OAUTH_ENCRYPTION_KEY` coupling** — the WhatsApp token's at-rest security depends on this key
  being stable and present; §4.3/§8.8 fail closed when it is absent. Rotation requires the documented
  re-encryption procedure or token re-entry.
- **Directory CTA number provenance** — a public `wa.me` CTA must target a verified WhatsApp number.
  Never derive one from the seeded NAP phone, and never point a public CTA at a Meta test number
  (verified recipients only). See §15.

### Decisions required before production launch

1. **Webhook failure policy:** retain the documented distinction between retryable failures before
   durable dedupe and non-retryable failures after persistence; confirm this with the operations owner.
2. **Ordering and scale:** replace the process-local per-sender chain with durable queue semantics
   before running multiple API replicas or promising ordered conversational replies.
3. **Retention and disclosure:** approve the WhatsApp privacy notice, retention duration, erasure
   behavior, and whether any future provider/LLM may receive phone/profile metadata.
4. **Commercial model:** decide whether Meta conversation costs are bundled, passed through, or
   absorbed before enabling tenant-owned production numbers.
5. **Number and channel ownership:** define who owns the WABA/number, who can rotate credentials,
   and how a revoked token or disconnected number is surfaced and remediated.
6. **Production launch gate:** require a real approved number, verified business/WABA status,
   delivery/error observability, durable outbound processing, capability tests, and attribution
   checks before moving beyond the demo tenant.

These are intentionally separate from implementation risks: each decision needs an owner and a
recorded outcome before the channel becomes a customer-facing production commitment.

## 19. Gap-closure ledger

| ID | Gap | Resolution |
|---|---|---|
| B1 | `req.rawBody` never populated → HMAC over re-serialized JSON; fail-open when secret unset | §4.1: mount Meta webhook pre-middleware with `express.json({ verify })`; fail-closed; remove duplicate routeRegistry mount |
| B2 | New verify token contradicts unchanged GET handshake | §4.2: reuse `META_WEBHOOK_VERIFY_TOKEN`; drop `WHATSAPP_WEBHOOK_VERIFY_TOKEN` |
| B3 | Architecture double-appends the user message | §8.2: `preprocessTurn` owns the user append; removed step (d) |
| B4 | Text-only transport can't render skill/product cards | §8.4: `WhatsAppTextRenderer` with required product/availability formatter + skill fall-through |
| H1 | "Enqueue" with no queue | §8.3: explicit sync-preprocess / detached-complete split; queue deferred |
| H2 | Session lifecycle/expiry undefined; phantom greeting; concurrent window creation | §8.5: reuse based on latest inbound activity; serialize archive/create per sender; `skipGreeting`; documented multi-row semantics |
| H3 | Status-only / batched / non-text payloads unhandled; 4096 limit | §8.1, §8.6, §8.7: loop, ignore statuses, canned non-text reply, truncation |
| H4 | Admin page misidentified; no admin API | §9.1–9.3: `/settings/admin/bot/channels` + `/api/admin/bot/channels` CRUD |
| H5 | "Filterable by source" false | §9.4: add `source` filter to `listConversations` + route; corrected visibility claim |
| H6 | Tenant/capability prerequisites missing | §6.1: demo tenant must be bot-active + chatbot-enabled + content-populated; disabled-tenant behavior defined |
| H7 | Token redundancy; encryption-key fallback; rotation ambiguity | §8.8 uses channel-only credentials, removes fallback, fails closed on key errors, and documents rotation |
| M1 | Refactor under-scoped/unguarded | §4.4 characterization tests before refactor; §16 sizing corrected |
| M2 | `varchar(40)` ids; missing indexes/constraints; JSON dedupe | §7: `varchar(255)`, tenant index, status CHECK, `created_by`, `bot_messages.wa_message_id` unique index; migration pinned to 275 |
| M3 | Silent failures; no abuse guard; PII leakage risk | §8.6 bounded input, redacted logs, fallback reply, per-`wa_id` soft guard, and dead-letter behavior |
| M4 | Tests only checkapi/checkweb; no locations; route coverage | §17: vitest suites + locations + route registration note |
| L1 | Net-new surface undercount | §16 sizing correction |
| L2 | Graph "reuse" claim loose (body token vs Bearer) | §3 + §8.7: Bearer header, explicit |
| L3 | "Behind the verify-token check" wording | §18: branch behind the `object`/signature check, subscribe second |
| L4 | WhatsApp markdown / 4096 limit | §8.4 `toWhatsAppMarkdown()` + truncation |
| L5 | 429 retry lifetime; no dead-letter | §8.7 single retry + dead-letter log |
| L6 | `display_phone_number` unused | §7 stores it; §9.2 returns it in admin list |
| H8 | Raw-body mount path could produce `/api/meta/webhooks/meta/webhooks` | §4.1 pins the `/api` mount prefix to the router's existing `/meta/webhooks` paths |
| H9 | Valid webhook failure semantics undefined | §8.3 defines retryable pre-persistence failures versus 200-after-persistence behavior |
| H10 | Same-sender detached work can complete out of order | §8.3 requires a per-channel/sender processing chain; durable ordering is a production gate |
| H11 | Webhook payload and batch-entry validation underspecified | §8.6 requires bounded Zod validation and per-entry isolation |
| H12 | WhatsApp PII retention/logging and LLM boundary undefined | §11 defines disclosure, redaction, erasure coverage, retention, and profile-name handling |
| H13 | Marketing and capability architecture disconnected from transport | §12–§13 define funnel attribution, capability gates, and layer boundaries |
| V1 | §4.1's raw-body parser mounted at `/api` would 1 MB-cap every `/api` body and capture raw bodies for all traffic | §4.1: parser scoped to the `/meta/webhooks` path guard |
| V2 | §10 "In" still listed a removed `unifiedConfig` token getter | §10: channel-only credential wording |
| V3 | §9.1 cited a §10 merchant-UI exclusion that was absent | §10 Out: added merchant-facing channel UI exclusion |
| V4 | Per-sender ordering covered only detached work; concurrent synchronous intake could create two active rows | §8.3: per-sender intake mutex (sync) + FIFO completion chain (detached); §8.5 references the mutex |
| D1 | Directory surfaces had no WhatsApp presence model | §15 defines flavor A (`directory_entry_whatsapp_on`) and flavor B (registered channel capability), independently keyed |
| D2 | A new directory-entry section flag needs an end-to-end capability-key wiring path | §15 enumerates registry → resolver → types → frontend map → UI → settings → tier mirror |
| D3 | No WhatsApp number exists anywhere; a NAP phone is not a WhatsApp number | §15 number-provenance rules: explicit verified E.164 only, never derived from NAP |
| D4 | A Meta test number cannot back a public CTA (verified recipients only) | §15 + §10 Out: flavor B public presence deferred to a real approved number |
| V10 | Privacy/marketing/capability/multilingual/directory sections were mis-nested as "Sprint scope" subsections | Promoted to top-level §11–§15; §11–§14 shifted to §16–§19 and every cross-reference + ledger anchor renumbered |

### 19.1 Verification items — status after sprint planning (2026-09-15)

Resolved during sprint planning; retained here for traceability:

- **V5 — RESOLVED (verified).** `BotConversationService.archiveExpiredConversations` has **no live
  caller** — only `archiveOldConversations` / `deleteOldConversations` are invoked, from the
  bot-merchant maintenance route (`bot-merchant.ts`). Nothing archives active conversations by
  `created_at`, so §8.5's `updated_at`-based reuse rule is safe as written.
- **V6 — RESOLVED (verified).** `/api/public/bot/products/search` gates on `chatbot.enabled` only;
  `skills_enabled` + `allowed_skill_types` are enforced in the skill-execution path. §13 wording is
  aligned to the actual gate during implementation — no behavior change.
- **V7 — DECIDED: defer linkage.** `whatsapp_*` events emit tenant + channel + redacted
  conversation id only. Prospect/campaign attribution is a post-demo decision; event names are
  reserved per §12 so downstream wiring can be added without renaming.
- **V8 — RESOLVED (design correction).** Dedupe on `wa_message_id` applies to **all** message
  types, before the non-text canned reply. Implementation order: validate → resolve channel →
  dedupe → branch on type.
- **V9 — DECIDED: reject.** Inbound text over 1,000 chars gets a canned "message too long" reply
  and skips the pipeline — matches the widget's Zod bound.
- **V11 — DECIDED: WhatsApp-scoped assertion.** The `OAUTH_ENCRYPTION_KEY` presence/format check
  (64 hex chars) runs lazily when the WhatsApp channel service initializes or handles a channel
  credential — it fails closed for WhatsApp only. Meta Commerce and Google OAuth keep the existing
  module-load fallback; removing that fallback globally is a separate hardening item.
- **D5 — DECIDED: explicit key only.** `directory_entry_flexible` does **not** implicitly grant
  `can_show_whatsapp`; the CTA requires `directory_entry_whatsapp_on` (or `_enabled` alias)
  explicitly. Open sub-item: which tiers receive the grant — default proposal is the tiers that
  already carry `directory_entry_contact_on`; confirm at seed time.
- **D6 — RESOLVED (verified) + DECIDED.** `capabilities.directory_entry.features` is data-driven
  (`features_list` + `capability_features_list` + `tier_features_list` in
  `EffectiveCapabilityResolver`) — the new key needs DB seed rows, not just a code edit. Unclaimed
  seeds render **no** WhatsApp CTA this sprint (`merchantPrefs` is null; spec default confirmed).
