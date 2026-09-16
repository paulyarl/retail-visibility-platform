# Messaging Channel Transports — "One Brain, Two Transports"

## Problem

The bot engine (guardrails → intent → FAQ/skills → dynamic/static → escalation → persistence) was embedded inside the widget HTTP route. Adding a second transport (WhatsApp) would have meant forking ~330 lines of bot logic and letting the two copies drift.

## Pattern

`apps/api/src/services/bot/BotTurnPipeline.ts` extracts the engine into three composable functions. A transport owns its protocol concerns; the pipeline owns all bot decisions.

| Stage | Function | Owns |
|---|---|---|
| Preprocess | `preprocessTurn({ tenantId, conversation, rawText, fallbackMessage, waMessageId?, userMetadata? })` | Guardrail check + durable user-message append (incl. provider message id + transport metadata) |
| Decide | `completeTurn(conversation, pre, config, { enforceChatbotEnabled? })` | Intent, FAQ/static, skills, dynamic, steering, escalation. No `res`, no persistence. |
| Persist | `persistAssistantTurn(conversationId, turn, content)` | Assistant row — each transport passes the content IT renders (widget: rich reply; WhatsApp: rendered text) |

Transport-specific inputs flow through `preprocessTurn` (`waMessageId`, `userMetadata`) — the pipeline never imports transport modules.

## Transport contract (WhatsApp as the reference implementation)

- **Two phases per message.** Synchronous intake before HTTP 200 (validate → channel resolve → dedupe claim → session find/create → `preprocessTurn`); detached completion after 200 (`completeTurn` → render → `persistAssistantTurn` → outbound send).
- **Dedupe claim = the persisted user row's provider id.** `bot_messages.wa_message_id` + partial unique index; check on read path, treat `P2002` as duplicate.
- **Per-sender mutex + FIFO chain.** `withIntakeMutex` serializes the critical section (dedupe/session/persist) across concurrent deliveries; a per-sender completion chain keeps outbound replies ordered. **Process-local — replace with a durable queue before multi-replica scale.**
- **Capability gate differs per transport.** `completeTurn({ enforceChatbotEnabled: true })` returns `capability_disabled` for WhatsApp; the widget does NOT pass it (its gate lives on the lazy-creation path). Preserve each transport's gate location.
- **Render before send.** Widget card responses need a transport renderer (`WhatsAppTextRenderer`): per-skill formatter registry → fall through to `result.reply` → markdown conversion → provider truncation (4096). Never emit the `"Here's what I found:"` card stub.
- **Webhook failure policy.** Malformed/unknown-channel/duplicate/status-only → 200. Transient intake failure → propagate → 500 → provider retries (dedupe makes redelivery safe). Completion failure → log + configured fallback → dead-letter on second failure. Never retry indefinitely.

## Adding a third transport (SMS, etc.)

1. Inbound service: validate payload → resolve channel → dedupe → session lifecycle → `preprocessTurn` → enqueue completion.
2. Outbound service: provider send + bounded retry + dead-letter log.
3. Renderer: register skill formatters; keep `TurnResult` as the contract — a future localized result plugs in at `renderTextReply` without pipeline changes.
4. Route: mount under a provider webhook path with its own signature verification (see `api-route-architecture-audit.md` Pitfall 5 for raw-body mounting).
5. Conversation identity: `source = '<transport>'`, transport-specific `session_id` format, `skipGreeting: true`.

## Characterization discipline

Before touching the shared pipeline for a new transport, pin the EXISTING transport's behavior with tests. `src/tests/bot-public-pipeline.test.ts` (13 tests) is the widget contract — including quirks like the BERT-block response lacking `messageId`. New transport changes must keep that suite green.

## Files

- `apps/api/src/services/bot/BotTurnPipeline.ts` — shared engine
- `apps/api/src/services/whatsapp/WhatsAppInboundService.ts` — intake/mutex/FIFO (reference)
- `apps/api/src/services/whatsapp/WhatsAppOutboundService.ts` — provider send + retry
- `apps/api/src/services/whatsapp/WhatsAppTextRenderer.ts` — skill formatter registry
- `apps/api/src/routes/meta-webhooks.ts` — webhook branch (`object === 'whatsapp_business_account'`)
