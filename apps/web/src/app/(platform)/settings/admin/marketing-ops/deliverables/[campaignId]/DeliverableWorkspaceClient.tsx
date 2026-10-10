'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import marketingOpsService, {
  OwnerVoiceProfile, OwnerVoiceInput, ReviewSlot, DeliverableSection, AssemblyStatus,
} from '@/services/MarketingOpsService';
import OwnerVoiceCard from '@/components/deliverable/OwnerVoiceCard';
import ReviewSlotList from '@/components/deliverable/ReviewSlotList';
import DeliverableSectionCard from '@/components/deliverable/DeliverableSectionCard';
import RenderPanel from '@/components/deliverable/RenderPanel';

export default function DeliverableWorkspaceClient() {
  const params = useParams();
  const campaignId = params.campaignId as string;

  const [voiceProfile, setVoiceProfile] = useState<OwnerVoiceProfile | null>(null);
  const [slots, setSlots] = useState<ReviewSlot[]>([]);
  const [sections, setSections] = useState<DeliverableSection[]>([]);
  const [renderStatus, setRenderStatus] = useState<AssemblyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genSectionsBusy, setGenSectionsBusy] = useState(false);
  const [genSectionsNotice, setGenSectionsNotice] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [voice, slotList, sectionList, status] = await Promise.all([
        marketingOpsService.getOwnerVoiceProfile(campaignId),
        marketingOpsService.listReviewSlots(campaignId).catch(() => []),
        marketingOpsService.listDeliverableSections(campaignId).catch(() => []),
        marketingOpsService.getRenderStatus(campaignId).catch(() => null),
      ]);
      setVoiceProfile(voice);
      setSlots(slotList);
      setSections(sectionList);
      setRenderStatus(status);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleVoiceSaved = async (input: OwnerVoiceInput) => {
    const updated = await marketingOpsService.upsertOwnerVoice(campaignId, input);
    setVoiceProfile(updated);
  };

  const handleVoiceInferred = async () => {
    const result = await marketingOpsService.inferOwnerVoice(campaignId);
    // Refetch to get the persisted profile
    await fetchAll();
    return result;
  };

  const handleSlotsChanged = async () => {
    const [slotList, status] = await Promise.all([
      marketingOpsService.listReviewSlots(campaignId),
      marketingOpsService.getRenderStatus(campaignId).catch(() => null),
    ]);
    setSlots(slotList);
    setRenderStatus(status);
  };

  const handleSectionsChanged = async () => {
    const [sectionList, status] = await Promise.all([
      marketingOpsService.listDeliverableSections(campaignId),
      marketingOpsService.getRenderStatus(campaignId).catch(() => null),
    ]);
    setSections(sectionList);
    setRenderStatus(status);
  };

  const handleRendered = async () => {
    await fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading deliverable workspace...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Deliverable Construction
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Post-payment deliverable: owner voice calibration, batch review responses, and render.
          </p>
        </div>
        <Link
          href={`/settings/admin/marketing-ops/campaigns/${campaignId}`}
          className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          ← Back to campaign
        </Link>
      </div>

      {/* Owner Voice */}
      <OwnerVoiceCard
        campaignId={campaignId}
        profile={voiceProfile}
        onSaved={handleVoiceSaved}
        onInfer={handleVoiceInferred}
        onChanged={fetchAll}
      />

      {/* Review Slots */}
      <ReviewSlotList
        campaignId={campaignId}
        slots={slots}
        onChanged={handleSlotsChanged}
      />

      {/* Deliverable Sections */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Deliverable Sections
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Signal-derived narrative sections — draft with the analyst, or use each card's external lane.
            </p>
          </div>
          <button
            onClick={async () => {
              setGenSectionsBusy(true);
              setGenSectionsNotice(null);
              try {
                const r = await marketingOpsService.generateAllSections(campaignId);
                const n = r?.generated?.length ?? 0;
                const errs = r?.errors ?? [];
                setGenSectionsNotice(
                  errs.length
                    ? { text: `Generated ${n} section(s) — ${errs.length} failed: ${errs.join('; ')}`, tone: 'err' }
                    : { text: `Generated ${n} section(s).`, tone: 'ok' },
                );
                await handleSectionsChanged();
              } catch (e) {
                setGenSectionsNotice({ text: (e as Error).message, tone: 'err' });
              } finally {
                setGenSectionsBusy(false);
              }
            }}
            disabled={genSectionsBusy}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {genSectionsBusy ? 'Generating…' : sections.length ? 'Regenerate sections' : 'Generate sections'}
          </button>
        </div>
        {genSectionsNotice && (
          <p className={`mb-3 text-xs ${genSectionsNotice.tone === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {genSectionsNotice.text}
          </p>
        )}
        {sections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-neutral-600 dark:text-gray-400">
            No sections yet — run the analyst to draft the signal-derived sections for this deliverable.
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((section) => (
              <DeliverableSectionCard
                key={section.id}
                campaignId={campaignId}
                section={section}
                onChanged={handleSectionsChanged}
              />
            ))}
          </div>
        )}
      </div>

      {/* Render */}
      <RenderPanel
        campaignId={campaignId}
        status={renderStatus}
        onRendered={handleRendered}
      />
    </div>
  );
}
