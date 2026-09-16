/**
 * WhatsApp Inbound Service (WHATSAPP_CHANNEL_INTEGRATION_SPEC §8.6)
 *
 * Normalizes `whatsapp_business_account` webhook changes and drives the
 * shared bot pipeline. Two-phase processing (§8.3):
 *
 *   SYNCHRONOUS (before HTTP 200): payload validation → channel resolution →
 *     per-sender intake mutex { dedupe → find-or-create conversation →
 *     preprocessTurn (guardrail + durable user-message persist) }
 *   DETACHED (after HTTP 200): per-sender FIFO chain { completeTurn →
 *     renderTextReply → persistAssistantTurn → outbound send }
 *
 * Failure policy: malformed payloads/messages → log + skip (200). Unknown
 * channel, duplicates, status-only → 200. A transient failure inside the
 * synchronous section propagates → route returns 500 so Meta retries; the
 * durable dedupe on wa_message_id makes redelivery safe. Failures in the
 * detached section are logged with a correlation id and produce a fallback
 * outbound reply — never a Meta retry.
 *
 * Dedupe covers ALL message types (text, non-text, oversized) — the dedupe
 * claim is the persisted user row's wa_message_id.
 */

import { z } from 'zod';
import BotConversationService, { BotConversation } from '../BotConversationService';
import BotConfigurationService, { BotConfig } from '../BotConfigurationService';
import {
  preprocessTurn,
  completeTurn,
  persistAssistantTurn,
  TurnPre,
  AssistantTurn,
} from '../bot/BotTurnPipeline';
import { renderTextReply } from './WhatsAppTextRenderer';
import WhatsAppOutboundService, { redactPhone } from './WhatsAppOutboundService';
import WhatsAppChannelService, { WhatsAppChannel } from './WhatsAppChannelService';
import { logger } from '../../logger';

const conversationService = BotConversationService.getInstance();
const configService = BotConfigurationService.getInstance();
const channelService = WhatsAppChannelService.getInstance();
const outboundService = WhatsAppOutboundService.getInstance();

const NON_TEXT_REPLY = `I can only read text messages right now. Please type your question and I'll do my best to help.`;
const TOO_LONG_REPLY = `That message is a bit too long for me — could you keep it under 1,000 characters?`;
const UNAVAILABLE_REPLY = `Sorry, our chat assistant isn't available right now. Please try again later.`;

const MAX_TEXT_LENGTH = 1000; // same bound as the widget (V9 decision: reject, not truncate)
const STORED_TEXT_MAX = 8000; // bound what we persist for rejected messages

// ─── Payload validation ───────────────────────────────────────────────

const waContactSchema = z.object({
  wa_id: z.string().min(1).max(64),
  profile: z.object({ name: z.string().max(512) }).partial().optional(),
}).passthrough();

const waMessageSchema = z.object({
  id: z.string().min(1).max(255),
  from: z.string().min(1).max(64),
  timestamp: z.string().max(32).optional(),
  type: z.string().min(1).max(32),
  text: z.object({ body: z.string().max(STORED_TEXT_MAX) }).passthrough().optional(),
}).passthrough();

const waValueSchema = z.object({
  metadata: z.object({
    display_phone_number: z.string().max(64).optional(),
    phone_number_id: z.string().min(1).max(64),
  }).passthrough(),
  contacts: z.array(waContactSchema).max(25).optional(),
  messages: z.array(waMessageSchema).max(100).optional(),
  statuses: z.array(z.any()).max(100).optional(),
}).passthrough();

type WaValue = z.infer<typeof waValueSchema>;
type WaMessage = z.infer<typeof waMessageSchema>;

// ─── Per-sender soft guard (best-effort, process-local) ──────────────

const SOFT_GUARD_LIMIT = 30;
const SOFT_GUARD_WINDOW_MS = 60_000;

// ─── Service ──────────────────────────────────────────────────────────

interface IntakeResult {
  duplicate?: boolean;
  conversation?: BotConversation;
  kind: 'turn' | 'non_text' | 'too_long' | 'blocked';
  pre?: TurnPre;
}

export class WhatsAppInboundService {
  private static instance: WhatsAppInboundService;
  private intakeMutexes = new Map<string, Promise<void>>();
  private completionChains = new Map<string, Promise<void>>();
  private senderCounts = new Map<string, { count: number; resetAt: number }>();

  static getInstance(): WhatsAppInboundService {
    if (!this.instance) this.instance = new WhatsAppInboundService();
    return this.instance;
  }

  /**
   * Handle one `field === 'messages'` change value. Synchronous section only —
   * detached completions are enqueued, not awaited. Throws on transient
   * failures so the route can return 500 for a Meta retry; returns normally
   * for everything that should be acked 200.
   */
  async handleChange(rawValue: unknown): Promise<void> {
    const parsed = waValueSchema.safeParse(rawValue);
    if (!parsed.success) {
      logger.warn('[WhatsAppInbound] Malformed webhook value — acked without processing', undefined, {
        issues: parsed.error.issues.slice(0, 5).map(i => i.path.join('.')),
      });
      return;
    }
    const value = parsed.data;

    const channel = await channelService.resolveChannel(value.metadata.phone_number_id);
    if (!channel) {
      logger.info('[WhatsAppInbound] Unknown phone_number_id — ignored', undefined, {
        phoneNumberId: value.metadata.phone_number_id,
      });
      return;
    }

    const messages = value.messages ?? [];
    if (messages.length === 0) {
      // Status-only payload (sent/delivered/read receipts) — nothing to do
      return;
    }

    const profileName = value.contacts?.[0]?.profile?.name;
    const config = await configService.getOrCreate(channel.tenantId);

    // Sequential intake: Meta batches arrive ordered; per-sender mutex
    // additionally serializes across concurrent webhook deliveries.
    for (const message of messages) {
      await this.handleMessage(channel, config, message, profileName);
    }
  }

  private async handleMessage(
    channel: WhatsAppChannel,
    config: BotConfig,
    message: WaMessage,
    profileName: string | undefined,
  ): Promise<void> {
    const senderKey = `${channel.id}:${message.from}`;

    // Per-sender soft guard — blunts abuse; best-effort, process-local
    if (!this.softGuard(senderKey)) {
      logger.warn('[WhatsAppInbound] Soft guard tripped — message dropped', undefined, {
        channelId: channel.id,
        to: redactPhone(message.from),
      });
      return;
    }

    let intake: IntakeResult;
    try {
      intake = await this.withIntakeMutex(senderKey, () =>
        this.intake(channel, config, message, profileName)
      );
    } catch (error: any) {
      // Cross-process dedupe backstop: a second delivery racing our durable
      // claim hits the partial unique index → treat as duplicate, ack 200.
      if (error?.code === 'P2002') {
        logger.info('[WhatsAppInbound] Duplicate delivery (unique index) — ignored', undefined, {
          channelId: channel.id,
          waMessageId: message.id,
        });
        return;
      }
      throw error; // transient → route returns 500 → Meta retries
    }

    if (intake.duplicate) {
      logger.info('[WhatsAppInbound] Duplicate wa_message_id — ignored', undefined, {
        channelId: channel.id,
        waMessageId: message.id,
      });
      return;
    }

    // Detached completion — FIFO per sender; failures logged + fallback sent
    this.enqueueCompletion(senderKey, () =>
      this.complete(channel, config, message.from, intake)
    );
  }

  /** Critical section: dedupe → session lifecycle → durable user persist. */
  private async intake(
    channel: WhatsAppChannel,
    config: BotConfig,
    message: WaMessage,
    profileName: string | undefined,
  ): Promise<IntakeResult> {
    const existing = await conversationService.findMessageByWaMessageId(message.id);
    if (existing) return { duplicate: true, kind: 'non_text' };

    const sessionId = `wa-${channel.phoneNumberId}-${message.from}`;
    let conversation = await conversationService.getReusableConversationBySession(sessionId);
    if (!conversation) {
      const stale = await conversationService.getConversationBySession(sessionId);
      if (stale) {
        await conversationService.updateStatus(stale.id, 'archived');
      }
      const created = await conversationService.createConversation({
        tenantId: channel.tenantId,
        sessionId,
        customerPhone: message.from,
        source: 'whatsapp',
        skipGreeting: true,
      });
      conversation = created.conversation;
    }

    const userMetadata = profileName ? { wa_profile_name: profileName } : undefined;

    // Non-text: dedupe claim + canned reply, skip the pipeline (§8.6)
    if (message.type !== 'text' || !message.text?.body) {
      await conversationService.appendMessage({
        conversationId: conversation.id,
        role: 'user',
        content: `[${message.type} message]`,
        metadata: { wa_type: message.type, ...userMetadata },
        waMessageId: message.id,
      });
      return { conversation, kind: 'non_text' };
    }

    const text = message.text.body;
    if (text.length > MAX_TEXT_LENGTH) {
      // V9 decision: reject oversized text — dedupe claim still persisted
      await conversationService.appendMessage({
        conversationId: conversation.id,
        role: 'user',
        content: text,
        metadata: { rejected: 'too_long', ...userMetadata },
        waMessageId: message.id,
      });
      return { conversation, kind: 'too_long' };
    }

    const pre = await preprocessTurn({
      tenantId: channel.tenantId,
      conversation,
      rawText: text,
      fallbackMessage: config.fallbackMessage,
      waMessageId: message.id,
      userMetadata,
    });

    return {
      conversation,
      kind: pre.blockedReply !== undefined ? 'blocked' : 'turn',
      pre,
    };
  }

  /** Detached completion: decide → render → persist → send. */
  private async complete(
    channel: WhatsAppChannel,
    config: BotConfig,
    waId: string,
    intake: IntakeResult,
  ): Promise<void> {
    const conversation = intake.conversation!;
    try {
      let replyText: string;
      let turn: AssistantTurn;

      if (intake.kind === 'non_text') {
        replyText = NON_TEXT_REPLY;
        turn = { responseType: 'fallback', guardrailResult: 'pass' };
      } else if (intake.kind === 'too_long') {
        replyText = TOO_LONG_REPLY;
        turn = { responseType: 'fallback', guardrailResult: 'pass' };
      } else if (intake.kind === 'blocked') {
        replyText = intake.pre!.blockedReply!;
        turn = { responseType: 'fallback', guardrailResult: 'blocked' };
      } else {
        const result = await completeTurn(conversation, intake.pre!, config, {
          enforceChatbotEnabled: true,
        });
        if (result.kind === 'capability_disabled') {
          // §13: one generic unavailable reply, persisted as a fallback outcome
          replyText = UNAVAILABLE_REPLY;
          turn = { responseType: 'fallback', guardrailResult: result.guardrailResult };
        } else {
          replyText = renderTextReply(result);
          turn = result;
        }
      }

      await persistAssistantTurn(conversation.id, turn, replyText);
      const sent = await outboundService.sendText(channel, waId, replyText);
      if (!sent.success) {
        logger.error('[WhatsAppInbound] Outbound delivery failed', undefined, {
          channelId: channel.id,
          conversationId: conversation.id,
          errorCode: sent.errorCode,
          errorSubcode: sent.errorSubcode,
          errorMessage: sent.errorMessage,
        });
      }
    } catch (error) {
      // Completion failure — log with correlation id, send configured
      // fallback; never surface an error to Meta (spec §8.6).
      logger.error('[WhatsAppInbound] Completion failed — sending fallback', undefined, {
        channelId: channel.id,
        conversationId: conversation.id,
        error: {
          name: (error as any)?.name || 'Error',
          message: (error as any)?.message || String(error),
          stack: (error as any)?.stack,
        },
      });
      try {
        const fallback = config.fallbackMessage || UNAVAILABLE_REPLY;
        await persistAssistantTurn(
          conversation.id,
          { responseType: 'fallback', guardrailResult: 'pass' },
          fallback
        );
        await outboundService.sendText(channel, waId, fallback);
      } catch (fallbackError) {
        logger.error('[WhatsAppInbound] Fallback delivery failed — dead-letter', undefined, {
          channelId: channel.id,
          conversationId: conversation.id,
          error: {
            name: (fallbackError as any)?.name || 'Error',
            message: (fallbackError as any)?.message || String(fallbackError),
          },
        });
      }
    }
  }

  // ─── Per-sender intake mutex (§8.3) ─────────────────────────────────

  private async withIntakeMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const tail = this.intakeMutexes.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const marker = tail.then(() => gate);
    this.intakeMutexes.set(key, marker);
    await tail;
    try {
      return await fn();
    } finally {
      // Evict before releasing: if no one chained behind us the key is free;
      // if they did, map value is their marker and stays.
      if (this.intakeMutexes.get(key) === marker) this.intakeMutexes.delete(key);
      release();
    }
  }

  // ─── Per-sender completion chain — FIFO, detached (§8.3) ────────────

  private enqueueCompletion(key: string, task: () => Promise<void>): void {
    const tail = this.completionChains.get(key) ?? Promise.resolve();
    const next = tail.then(() => task()).catch(error => {
      logger.error('[WhatsAppInbound] Completion chain task failed', undefined, {
        senderKey: redactPhone(key),
        error: {
          name: (error as any)?.name || 'Error',
          message: (error as any)?.message || String(error),
        },
      });
    }).finally(() => {
      if (this.completionChains.get(key) === next) this.completionChains.delete(key);
    });
    this.completionChains.set(key, next);
  }

  // ─── Per-sender soft guard ──────────────────────────────────────────

  private softGuard(key: string): boolean {
    const now = Date.now();
    const entry = this.senderCounts.get(key);
    if (!entry || now > entry.resetAt) {
      this.senderCounts.set(key, { count: 1, resetAt: now + SOFT_GUARD_WINDOW_MS });
      // Opportunistic eviction of expired keys (spec: must evict)
      if (this.senderCounts.size > 10_000) {
        for (const [k, e] of this.senderCounts) {
          if (now > e.resetAt) this.senderCounts.delete(k);
        }
      }
      return true;
    }
    if (entry.count >= SOFT_GUARD_LIMIT) return false;
    entry.count++;
    return true;
  }
}

export default WhatsAppInboundService;
