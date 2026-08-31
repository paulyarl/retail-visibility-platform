/**
 * PostalMailerService — campaign-first, triage-aware postcard generator.
 *
 * Reuses the existing opener intelligence stack:
 *   - resolveCampaignArchetype (operator-accepted triage or fallback)
 *   - OutreachOpenerService.resolveOpener (signal extraction + prompt)
 *   - aiProviderFactory (AI-generated, credible copy)
 *
 * Generates a 4x6" postcard payload with a scannable QR destination chosen
 * by campaign stage: diagnostic gallery for seek/preview/shown, claim link
 * for paid/unclaimed, customer portal for claimed.
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { unifiedConfig } from '../../config/unifiedConfig';
import { OutreachOpenerService } from '../OutreachOpenerService';
import aiProviderFactory from '../ai-providers';
import MarketingCustomerService from '../MarketingCustomerService';
import MarketingDeliverableService from '../MarketingDeliverableService';

export interface PostalMailerPayload {
  campaignId: string;
  businessName: string;
  addressLines: string[];
  headline: string;
  body: string;
  ctaLabel: string;
  qrUrl: string;
  qrDestination: 'diagnostic_gallery' | 'claim' | 'portal' | 'none';
  archetype: string;
  token: string | null;
  filename: string;
}

class PostalMailerService {
  private static instance: PostalMailerService;

  private constructor() {}

  static getInstance(): PostalMailerService {
    if (!PostalMailerService.instance) {
      PostalMailerService.instance = new PostalMailerService();
    }
    return PostalMailerService.instance;
  }

  /**
   * Build a signal-aware postcard payload for a campaign.
   */
  async generate(campaignId: string, ctx?: RequestCtx): Promise<PostalMailerPayload> {
    const campaign = await prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        business_name: true,
        address_line1: true,
        address_line2: true,
        address_city: true,
        address_state: true,
        address_zip: true,
        address_country: true,
        email: true,
        stage: true,
        date_paid: true,
        customer_id: true,
      },
    });

    if (!campaign) {
      throw Object.assign(new Error('Campaign not found'), { code: 'not_found' });
    }

    if (!this.hasMailingAddress(campaign)) {
      throw Object.assign(new Error('Campaign has no mailing address'), { code: 'no_address' });
    }

    // Resolve archetype + extracted fields using the same pipeline as openers.
    const { resolvedPrompt, selection } = await OutreachOpenerService.getInstance().resolveOpener(
      campaignId,
      'direct_paid',
      ctx,
    );

    // Generate postcard copy with a short AI pass.
    const { headline, body } = await this.generateCopy(resolvedPrompt, ctx);

    // Pick the QR destination and mint the right token.
    const { qrUrl, qrDestination, token } = await this.resolveQrDestination(campaign, ctx);

    const addressLines = this.formatAddressLines(campaign);

    logger.info('PostalMailerService.generate', ctx, {
      campaignId,
      archetype: selection.archetype,
      qrDestination,
    });

    return {
      campaignId: campaign.id,
      businessName: campaign.business_name ?? 'Your Business',
      addressLines,
      headline,
      body,
      ctaLabel: this.ctaLabelForDestination(qrDestination),
      qrUrl,
      qrDestination,
      archetype: selection.archetype,
      token,
      filename: `postcard-${campaign.id}-${selection.archetype.toLowerCase()}.pdf`,
    };
  }

  private hasMailingAddress(campaign: any): boolean {
    return !!(campaign.address_line1 && campaign.address_city && campaign.address_state);
  }

  private formatAddressLines(campaign: any): string[] {
    const lines: string[] = [campaign.business_name ?? 'Business Owner'];
    if (campaign.address_line1) lines.push(campaign.address_line1);
    if (campaign.address_line2) lines.push(campaign.address_line2);
    const cityStateZip = [campaign.address_city, campaign.address_state, campaign.address_zip]
      .filter(Boolean)
      .join(', ');
    if (cityStateZip) lines.push(cityStateZip);
    if (campaign.address_country && campaign.address_country !== 'US') {
      lines.push(campaign.address_country);
    }
    return lines;
  }

  /**
   * Run a short AI pass over the resolved opener prompt to produce a
   * headline + body that fit on a 4x6" postcard.
   */
  private async generateCopy(resolvedPrompt: string, ctx?: RequestCtx): Promise<{ headline: string; body: string }> {
    const systemPrompt = `You are writing the front of a 4x6 inch postcard for a local business owner. The user prompt contains the research and signal context. Output ONLY a valid JSON object with two keys: "headline" (5-10 words) and "body" (25-45 words). No markdown, no URLs, no pricing, no text outside the JSON. The tone is quiet, specific, and useful — prove you did the homework.`;

    const result = await aiProviderFactory.generateChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: resolvedPrompt },
      ],
      maxTokens: 400,
      temperature: 0.7,
    });

    const raw = result.content.trim();
    const parsed = this.parsePostcardJson(raw);
    return {
      headline: parsed.headline || 'We found a visibility gap for your business',
      body: parsed.body || 'Local customers are searching, but your public profile is missing key details. Scan the code to see what we found and how to fix it.',
    };
  }

  private parsePostcardJson(raw: string): { headline: string; body: string } {
    try {
      const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        headline: String(parsed.headline ?? '').trim(),
        body: String(parsed.body ?? '').trim(),
      };
    } catch {
      // Fallback: if the model ignored instructions, split the text by line breaks.
      const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
      return {
        headline: lines[0] ?? '',
        body: lines.slice(1).join(' '),
      };
    }
  }

  /**
   * Pick the QR destination based on campaign stage and mint a token when needed.
   */
  private async resolveQrDestination(
    campaign: any,
    ctx?: RequestCtx,
  ): Promise<{ qrUrl: string; qrDestination: PostalMailerPayload['qrDestination']; token: string | null }> {
    const baseUrl = unifiedConfig.frontendUrl || unifiedConfig.webUrl || 'https://app.visibleshelf.com';

    // Claim path: paid but not yet linked to a customer.
    if (campaign.date_paid && !campaign.customer_id && campaign.email) {
      const issued = await MarketingCustomerService.issueClaimToken(campaign.email);
      if (issued) {
        return {
          qrUrl: `${baseUrl}/marketing/claim/${issued.token}`,
          qrDestination: 'claim',
          token: issued.token,
        };
      }
    }

    // Portal path: already claimed.
    if (campaign.customer_id) {
      return {
        qrUrl: `${baseUrl}/account/marketing`,
        qrDestination: 'portal',
        token: null,
      };
    }

    // Diagnostic gallery: the cold-outreach default.
    const galleryStages = ['seek', 'preview_built', 'shown'];
    if (galleryStages.includes(campaign.stage)) {
      const tokenRow = await MarketingDeliverableService.generateCampaignToken(
        campaign.id,
        'diagnostic_gallery',
        undefined,
        30,
        ctx,
      );
      return {
        qrUrl: `${baseUrl}/preview/${tokenRow.token}`,
        qrDestination: 'diagnostic_gallery',
        token: tokenRow.token,
      };
    }

    return {
      qrUrl: `${baseUrl}/`,
      qrDestination: 'none',
      token: null,
    };
  }

  private ctaLabelForDestination(destination: PostalMailerPayload['qrDestination']): string {
    switch (destination) {
      case 'diagnostic_gallery':
        return 'Scan to see your free diagnostic';
      case 'claim':
        return 'Scan to claim your account';
      case 'portal':
        return 'Scan to view your account';
      default:
        return 'Scan to learn more';
    }
  }
}

export default PostalMailerService;
