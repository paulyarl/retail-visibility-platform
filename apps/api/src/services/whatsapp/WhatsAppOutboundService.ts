/**
 * WhatsApp Outbound Service (WHATSAPP_CHANNEL_INTEGRATION_SPEC §8.7)
 *
 * Sends text replies through the Meta Graph API:
 *   POST /{phone_number_id}/messages   Authorization: Bearer <channel token>
 *   { messaging_product: 'whatsapp', to, type: 'text', text: { body } }
 *
 * The channel row's encrypted token is the only send credential (§8.8).
 * Error handling: parses the Graph error envelope, honors Retry-After with a
 * SINGLE retry on 429, then logs a dead-letter line and drops — the detached
 * path must not retry indefinitely.
 */

import { logger } from '../../logger';
import { WhatsAppChannel, WhatsAppChannelService } from './WhatsAppChannelService';
import { truncateForWhatsApp } from './WhatsAppTextRenderer';

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';
const MAX_RETRY_AFTER_MS = 10_000;

export interface WhatsAppSendResult {
  success: boolean;
  /** Provider message id (wamid.*) for correlation with the inbound id. */
  providerMessageId?: string;
  errorCode?: number;
  errorSubcode?: number;
  errorMessage?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Redact a phone number for logs — keep last 4 digits only. */
export function redactPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `***${digits.slice(-4)}`;
}

export class WhatsAppOutboundService {
  private static instance: WhatsAppOutboundService;
  private channelService = WhatsAppChannelService.getInstance();

  static getInstance(): WhatsAppOutboundService {
    if (!this.instance) this.instance = new WhatsAppOutboundService();
    return this.instance;
  }

  async sendText(
    channel: WhatsAppChannel,
    to: string,
    body: string,
  ): Promise<WhatsAppSendResult> {
    let token: string;
    try {
      token = this.channelService.getAccessToken(channel);
    } catch (error) {
      logger.error('[WhatsAppOutbound] Channel token unavailable — dead-letter', undefined, {
        channelId: channel.id,
        to: redactPhone(to),
        error: { message: (error as any)?.message || String(error) },
      });
      return { success: false, errorMessage: 'channel_token_unavailable' };
    }

    const text = truncateForWhatsApp(body);
    const result = await this.postMessage(channel, token, to, text);

    // Single retry honoring Retry-After on 429 (spec §8.7 — never more)
    if (!result.success && result.httpStatus === 429) {
      const waitMs = Math.min(result.retryAfterMs ?? 1000, MAX_RETRY_AFTER_MS);
      logger.warn('[WhatsAppOutbound] Rate limited — single retry after Retry-After', undefined, {
        channelId: channel.id,
        to: redactPhone(to),
        retryAfterMs: waitMs,
      });
      await sleep(waitMs);
      const retry = await this.postMessage(channel, token, to, text);
      if (!retry.success) {
        this.deadLetter(channel, to, retry);
      }
      return retry;
    }

    if (!result.success) {
      this.deadLetter(channel, to, result);
    }
    return result;
  }

  private async postMessage(
    channel: WhatsAppChannel,
    token: string,
    to: string,
    body: string,
  ): Promise<WhatsAppSendResult & { httpStatus?: number; retryAfterMs?: number }> {
    try {
      const response = await fetch(`${META_GRAPH_URL}/${channel.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        }),
      });

      const payload: any = await response.json().catch(() => null);

      if (response.ok) {
        const providerMessageId = payload?.messages?.[0]?.id;
        logger.info('[WhatsAppOutbound] Sent', undefined, {
          channelId: channel.id,
          to: redactPhone(to),
          providerMessageId,
        });
        return { success: true, providerMessageId };
      }

      const graphError = payload?.error;
      return {
        success: false,
        httpStatus: response.status,
        retryAfterMs: this.parseRetryAfter(response.headers.get('retry-after')),
        errorCode: graphError?.code,
        errorSubcode: graphError?.error_subcode,
        errorMessage: graphError?.message || `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: (error as any)?.message || String(error),
      };
    }
  }

  private parseRetryAfter(header: string | null): number | undefined {
    if (!header) return undefined;
    const seconds = Number(header);
    return Number.isFinite(seconds) ? seconds * 1000 : undefined;
  }

  /** Dead-letter log line — terminal failure, no further retries. */
  private deadLetter(
    channel: WhatsAppChannel,
    to: string,
    result: WhatsAppSendResult & { httpStatus?: number },
  ): void {
    logger.error('[WhatsAppOutbound] Dead-letter — outbound delivery dropped', undefined, {
      channelId: channel.id,
      to: redactPhone(to),
      httpStatus: (result as any).httpStatus,
      errorCode: result.errorCode,
      errorSubcode: result.errorSubcode,
      errorMessage: result.errorMessage,
    });
  }
}

export default WhatsAppOutboundService;
