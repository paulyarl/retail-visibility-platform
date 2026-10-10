import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ExternalPromptLane from './ExternalPromptLane';
import OwnerVoiceCard from './OwnerVoiceCard';
import DeliverableSectionCard from './DeliverableSectionCard';
import type { DeliverableSection } from '@/services/MarketingOpsService';

describe('ExternalPromptLane', () => {
  it('renders the collapsed external-lane trigger', () => {
    const html = renderToStaticMarkup(
      createElement(ExternalPromptLane, {
        fetchPrompt: vi.fn().mockResolvedValue('prompt'),
        onApply: vi.fn().mockResolvedValue(undefined),
      }),
    );
    expect(html).toContain('Use external LLM');
    // Collapsed — the expanded lane's Step 2 affordance is not mounted
    expect(html).not.toContain('Step 2');
  });
});

describe('OwnerVoiceCard', () => {
  it('renders the external lane trigger alongside internal inference', () => {
    const html = renderToStaticMarkup(
      createElement(OwnerVoiceCard, {
        campaignId: 'mcamp-1',
        profile: null,
        onSaved: vi.fn().mockResolvedValue(undefined),
        onInfer: vi.fn().mockResolvedValue({ profile: null, inferredFromCount: 0 }),
        onChanged: vi.fn().mockResolvedValue(undefined),
      }),
    );
    expect(html).toContain('Use external LLM');
    expect(html).toContain('Infer from existing responses');
  });
});

describe('DeliverableSectionCard', () => {
  it('renders the external lane trigger alongside edit/approve actions', () => {
    const section = {
      id: 'sec-1',
      campaign_id: 'mcamp-1',
      section_type: 'recovery_playbook',
      sectionType: 'recovery_playbook',
      title: 'Recovery Playbook',
      content: 'Draft content',
      status: 'draft',
      sort_order: 1,
    } as unknown as DeliverableSection;
    const html = renderToStaticMarkup(
      createElement(DeliverableSectionCard, {
        campaignId: 'mcamp-1',
        section,
        onChanged: vi.fn().mockResolvedValue(undefined),
      }),
    );
    expect(html).toContain('Use external LLM');
    expect(html).toContain('Approve');
  });
});
