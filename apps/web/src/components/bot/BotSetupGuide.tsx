'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { botService, type BotConfig, type BotSkill } from '@/services/BotService';
import { useChatbotOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { toast } from '@/hooks/use-toast';

interface BotSetupGuideProps {
  tenantId: string;
}

interface StepState {
  configureDone: boolean;
  skillsDone: boolean;
  embedDone: boolean;
  activateDone: boolean;
}

export default function BotSetupGuide({ tenantId }: BotSetupGuideProps) {
  const { data: chatbotCaps } = useChatbotOptionsCapability(tenantId, { forTenant: true });
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [skills, setSkills] = useState<BotSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [activating, setActivating] = useState(false);
  const [, forceRerender] = useState(0);

  const embedDismissKey = `bot-setup-guide-dismissed-${tenantId}`;
  const embedDoneKey = `bot-setup-embed-done-${tenantId}`;

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [cfg, skillList] = await Promise.all([
        botService.getConfig(tenantId),
        botService.listSkills(tenantId),
      ]);
      setConfig(cfg);
      setSkills(skillList);
    } catch {
      // ignore — guide just won't show completion states
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(localStorage.getItem(embedDismissKey) === 'true');
    }
    fetchData();
  }, [fetchData, embedDismissKey]);

  const steps: StepState = {
    configureDone: !!config && config.botName !== 'Assistant' && !!config.greeting,
    skillsDone: skills.some(s => s.enabled),
    embedDone: typeof window !== 'undefined' && localStorage.getItem(embedDoneKey) === 'true',
    activateDone: config?.status === 'active',
  };

  const completedCount = Object.values(steps).filter(Boolean).length;
  const totalCount = 4;
  const allDone = completedCount === totalCount;

  if (dismissed || (chatbotCaps && !chatbotCaps.enabled)) {
    return null;
  }

  if (loading) {
    return null;
  }

  const handleActivate = async () => {
    if (!config || !tenantId) return;
    setActivating(true);
    try {
      const updated = await botService.updateConfig(tenantId, { status: 'active' });
      setConfig(updated);
      toast({ title: 'Bot activated', description: 'Your chatbot is now live.' });
    } catch {
      toast({ title: 'Failed to activate bot', variant: 'destructive' });
    } finally {
      setActivating(false);
    }
  };

  const handleMarkEmbedDone = () => {
    localStorage.setItem(embedDoneKey, 'true');
    forceRerender(n => n + 1);
  };

  const handleDismiss = () => {
    localStorage.setItem(embedDismissKey, 'true');
    setDismissed(true);
  };

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚀</span>
          <div>
            <CardTitle className="text-base">Getting Started Guide</CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              {allDone
                ? 'All set! Your bot is ready for customers.'
                : `${completedCount} of ${totalCount} steps completed`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {allDone && (
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Progress bar */}
        <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>

        {/* Step 1: Configure */}
        <GuideStep
          number={1}
          title="Configure your bot"
          description="Set your bot's name, greeting message, tone, and widget color to match your brand."
          done={steps.configureDone}
          href={`/t/${tenantId}/bot/config`}
          actionLabel="Configure →"
        />

        {/* Step 2: Enable skills */}
        <GuideStep
          number={2}
          title="Enable bot skills"
          description="Turn on skills like product search, inventory lookup, order tracking, and store hours to help customers find what they need."
          done={steps.skillsDone}
          href={`/t/${tenantId}/bot/skills`}
          actionLabel="Manage skills →"
          disabled={chatbotCaps ? !chatbotCaps.skillsEnabled : false}
          disabledHint="Skills require a higher tier plan."
        />

        {/* Step 3: Embed widget */}
        <GuideStep
          number={3}
          title="Embed the widget on your storefront"
          description="Copy the embed script and paste it before the closing </body> tag on your website."
          done={steps.embedDone}
          href={`/t/${tenantId}/bot/widget`}
          actionLabel="Get embed code →"
          onMarkDone={handleMarkEmbedDone}
        />

        {/* Step 4: Activate */}
        <GuideStep
          number={4}
          title="Activate your bot"
          description="Turn on your bot so it starts responding to customer conversations."
          done={steps.activateDone}
          actionLabel={activating ? 'Activating...' : 'Activate now'}
          onAction={handleActivate}
          actionDisabled={activating || steps.activateDone}
        />

        {/* All done celebration */}
        {allDone && (
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-2xl">🎉</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-green-900">Your bot is live!</p>
              <p className="text-xs text-green-700">
                Customers can now chat with your bot on your storefront. Check analytics to see how it's doing.
              </p>
            </div>
            <Link href={`/t/${tenantId}/bot/analytics`}>
              <Button variant="outline" size="sm">View analytics →</Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GuideStep({
  number,
  title,
  description,
  done,
  href,
  actionLabel,
  onAction,
  onMarkDone,
  actionDisabled,
  disabled,
  disabledHint,
}: {
  number: number;
  title: string;
  description: string;
  done: boolean;
  href?: string;
  actionLabel: string;
  onAction?: () => void;
  onMarkDone?: () => void;
  actionDisabled?: boolean;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${done ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      {/* Step number / checkmark */}
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${done ? 'bg-green-500 text-white' : 'bg-indigo-100 text-indigo-700'}`}>
        {done ? '✓' : number}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className={`text-sm font-medium ${done ? 'text-green-900 line-through' : 'text-gray-900'}`}>{title}</h4>
          {done && <span className="text-xs text-green-600 font-medium">Done</span>}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>

        {disabled && disabledHint && (
          <p className="text-xs text-amber-600 mt-1">⚠ {disabledHint}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2">
          {href && !disabled && (
            <Link href={href}>
              <Button variant="outline" size="sm" disabled={actionDisabled}>
                {actionLabel}
              </Button>
            </Link>
          )}
          {onAction && !disabled && (
            <Button variant="outline" size="sm" onClick={onAction} disabled={actionDisabled}>
              {actionLabel}
            </Button>
          )}
          {onMarkDone && !done && (
            <button
              onClick={onMarkDone}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              I've done this ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
