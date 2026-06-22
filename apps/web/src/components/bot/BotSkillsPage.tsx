'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/hooks/use-toast';
import { botService, type BotSkill } from '@/services/BotService';
import { useChatbotOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';

interface BotSkillsPageProps {
  tenantId: string;
}

export default function BotSkillsPage({ tenantId }: BotSkillsPageProps) {
  const { data: chatbotCaps } = useChatbotOptionsCapability(tenantId, { forTenant: true });
  const [skills, setSkills] = useState<BotSkill[]>([]);
  const [loading, setLoading] = useState(true);

  const SKILL_DISPLAY_NAMES: Record<string, string> = {
    platform_guide: 'Platform Guide',
  };

  const getSkillDisplayName = (name: string) => SKILL_DISPLAY_NAMES[name] || name;

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    try {
      const list = await botService.listSkills(tenantId);
      setSkills(list);
    } catch (err: any) {
      toast({ title: 'Failed to load skills', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleToggle = async (skill: BotSkill, enabled: boolean) => {
    try {
      await botService.updateSkillConfig(tenantId, skill.id, { enabled });
      setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, enabled } : s));
      toast({ title: enabled ? 'Skill enabled' : 'Skill disabled' });
    } catch (err: any) {
      toast({ title: 'Failed to update skill', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (chatbotCaps && !chatbotCaps.enabled) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">🤖</div>
        <h3 className="text-lg font-semibold text-gray-900">Chatbot Not Available</h3>
        <p className="text-sm text-gray-500 mt-1">Your current plan does not include the chatbot feature.</p>
        <Link href={`/t/${tenantId}/settings/subscription`} className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          Upgrade your plan →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {chatbotCaps && !chatbotCaps.skillsEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <h3 className="font-medium text-amber-900">Skills Not Available</h3>
            <p className="text-sm text-amber-700">Your current plan does not include bot skills. Upgrade to enable.</p>
          </div>
          <Link href={`/t/${tenantId}/settings/subscription`}>
            <Button size="sm">Upgrade</Button>
          </Link>
        </div>
      )}

      {skills.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-400">
            No skills available.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skills.map(skill => (
            <Card key={skill.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{getSkillDisplayName(skill.name)}</CardTitle>
                  <Switch
                    checked={skill.enabled}
                    onCheckedChange={(v) => handleToggle(skill, v)}
                    disabled={!chatbotCaps?.skillsEnabled}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {skill.description && (
                  <p className="text-sm text-gray-600">{skill.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">v{skill.version}</Badge>
                  <Badge variant={skill.status === 'active' ? 'default' : 'secondary'}>
                    {skill.status}
                  </Badge>
                  {skill.tierGates.length > 0 && (
                    <Badge variant="outline">Tiers: {skill.tierGates.join(', ')}</Badge>
                  )}
                </div>
                {skill.capabilityGates.length > 0 && (
                  <div className="text-xs text-gray-400">
                    Requires: {skill.capabilityGates.join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
