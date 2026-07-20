'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/hooks/use-toast';
import { useChatbotOptionsCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { botService } from '@/services/BotService';
import PlanSummaryWidget from '@/components/dashboard/PlanSummaryWidget';
import { Zap, ArrowRight, Settings, MessageSquare, BarChart3, BookOpen } from 'lucide-react';

interface BotOptionsPageProps {
  tenantId: string;
}

interface ChatbotOptionsSettings {
  chatbot_enabled: boolean;
  chatbot_static_enabled: boolean;
  chatbot_dynamic_enabled: boolean;
  chatbot_skills_enabled: boolean;
  chatbot_kb_enabled: boolean;
  chatbot_widget_enabled: boolean;
  chatbot_widget_custom_theme: boolean;
  chatbot_widget_skill_cards: boolean;
  chatbot_widget_after_hours: boolean;
}

const DEFAULT_SETTINGS: ChatbotOptionsSettings = {
  chatbot_enabled: true,
  chatbot_static_enabled: true,
  chatbot_dynamic_enabled: false,
  chatbot_skills_enabled: false,
  chatbot_kb_enabled: false,
  chatbot_widget_enabled: true,
  chatbot_widget_custom_theme: false,
  chatbot_widget_skill_cards: false,
  chatbot_widget_after_hours: false,
};

type FeatureGroup = {
  title: string;
  description: string;
  icon: string;
  features: { key: keyof ChatbotOptionsSettings; label: string; description: string; tierGate?: boolean }[];
};

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: 'Core',
    description: 'Enable and configure the base chatbot',
    icon: '🤖',
    features: [
      { key: 'chatbot_enabled', label: 'Chatbot Enabled', description: 'Master switch for the chatbot' },
      { key: 'chatbot_static_enabled', label: 'Static FAQ Mode', description: 'Answer from published FAQs using keyword matching' },
      { key: 'chatbot_dynamic_enabled', label: 'AI Dynamic Mode', description: 'AI-powered responses (requires Phase 3A)', tierGate: true },
    ],
  },
  {
    title: 'Skills & Knowledge',
    description: 'Advanced bot capabilities',
    icon: '⚡',
    features: [
      { key: 'chatbot_skills_enabled', label: 'Bot Skills', description: 'Enable product search, inventory, order tracking skills', tierGate: true },
      { key: 'chatbot_kb_enabled', label: 'Knowledge Base', description: 'Use FAQ as bot knowledge base', tierGate: true },
    ],
  },
  {
    title: 'Widget',
    description: 'Storefront widget configuration',
    icon: '🧩',
    features: [
      { key: 'chatbot_widget_enabled', label: 'Widget Enabled', description: 'Show the chat widget on your storefront' },
      { key: 'chatbot_widget_custom_theme', label: 'Custom Theme', description: 'Custom colors and branding for the widget', tierGate: true },
      { key: 'chatbot_widget_skill_cards', label: 'Skill Cards', description: 'Display interactive skill cards in chat', tierGate: true },
      { key: 'chatbot_widget_after_hours', label: 'After Hours Mode', description: 'Show after-hours message when closed', tierGate: true },
    ],
  },
];

export default function BotOptionsPage({ tenantId }: BotOptionsPageProps) {
  const { data: chatbotCaps } = useChatbotOptionsCapability(tenantId);
  const allCaps = useAllCapabilities(tenantId);
  const [settings, setSettings] = useState<ChatbotOptionsSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await botService.getChatbotOptions(tenantId);
      setSettings({ ...DEFAULT_SETTINGS, ...settings });
    } catch (err) {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = (key: keyof ChatbotOptionsSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await botService.updateChatbotOptions(tenantId, settings as unknown as Record<string, boolean>);
      toast({ title: 'Settings saved' });
      setSettings({ ...DEFAULT_SETTINGS, ...updated });
    } catch (err) {
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
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
      {/* Plan Summary Widget */}
      <PlanSummaryWidget capabilities={allCaps.data} loading={allCaps.loading} tenantId={tenantId} />

      {/* Tier Status Banner */}
      {chatbotCaps && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <div className="text-sm">
              <span className="font-medium text-indigo-900">Plan: {chatbotCaps.isFlexible ? 'Flexible' : 'Standard'}</span>
              {chatbotCaps.dynamicEnabled && <span className="ml-3 text-indigo-700">AI Dynamic Mode available</span>}
              {chatbotCaps.skillsEnabled && <span className="ml-3 text-indigo-700">Skills available</span>}
            </div>
          </div>
        </div>
      )}

      {/* Feature Groups */}
      {FEATURE_GROUPS.map(group => (
        <Card key={group.title}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-xl">{group.icon}</span>
              <div>
                <CardTitle className="text-base">{group.title}</CardTitle>
                <p className="text-sm text-gray-500">{group.description}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.features.map(feature => {
              const isTierGated = feature.tierGate && chatbotCaps;
              const isAllowed = !isTierGated || (chatbotCaps && (
                chatbotCaps.isFlexible ||
                (feature.key === 'chatbot_dynamic_enabled' && chatbotCaps.allowedResponseEngines.length > 0) ||
                (feature.key === 'chatbot_skills_enabled' && chatbotCaps.allowedSkillTypes.length > 0) ||
                (feature.key === 'chatbot_kb_enabled' && chatbotCaps.allowedKbTypes.length > 0) ||
                (feature.key === 'chatbot_widget_custom_theme' && chatbotCaps.allowedWidgetTypes.includes('chatbot_widget_custom_theme' as any)) ||
                (feature.key === 'chatbot_widget_skill_cards' && chatbotCaps.allowedWidgetTypes.includes('chatbot_widget_skill_cards' as any)) ||
                (feature.key === 'chatbot_widget_after_hours' && chatbotCaps.allowedWidgetTypes.includes('chatbot_widget_after_hours' as any))
              ));
              const isActuallyAllowed = !isTierGated || isAllowed;

              return (
                <div key={feature.key} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{feature.label}</span>
                      {feature.tierGate && (
                        <Badge variant="outline" className="text-xs">Tier gated</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{feature.description}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isTierGated && !isAllowed && (
                      <span className="text-xs text-amber-600 font-medium">Not in your plan</span>
                    )}
                    <Switch
                      checked={settings[feature.key]}
                      onCheckedChange={(v) => handleToggle(feature.key, v)}
                      disabled={!isActuallyAllowed}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* What's Next */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-600" />
            What's Next
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Continue setup for the chatbot features you just enabled
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {settings.chatbot_enabled && (
              <Link
                href={`/t/${tenantId}/bot/config`}
                className="flex items-center gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 hover:border-blue-300 text-blue-900 transition-colors"
              >
                <Settings className="h-5 w-5 shrink-0 text-blue-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Bot Configuration</p>
                  <p className="text-xs opacity-80 truncate">Set bot name, avatar, greeting, and personality</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
            )}
            {settings.chatbot_kb_enabled && (
              <Link
                href={`/t/${tenantId}/bot/knowledge`}
                className="flex items-center gap-3 p-4 rounded-lg border border-purple-200 bg-purple-50 hover:border-purple-300 text-purple-900 transition-colors"
              >
                <BookOpen className="h-5 w-5 shrink-0 text-purple-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Knowledge Base</p>
                  <p className="text-xs opacity-80 truncate">Refresh FAQ and policy embeddings for RAG</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
            )}
            {settings.chatbot_widget_enabled && (
              <Link
                href={`/t/${tenantId}/bot/widget`}
                className="flex items-center gap-3 p-4 rounded-lg border border-green-200 bg-green-50 hover:border-green-300 text-green-900 transition-colors"
              >
                <MessageSquare className="h-5 w-5 shrink-0 text-green-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Widget Setup</p>
                  <p className="text-xs opacity-80 truncate">Customize widget appearance and embed code</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
            )}
            {settings.chatbot_enabled && (
              <Link
                href={`/t/${tenantId}/bot/analytics`}
                className="flex items-center gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 hover:border-amber-300 text-amber-900 transition-colors"
              >
                <BarChart3 className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">Bot Analytics</p>
                  <p className="text-xs opacity-80 truncate">View conversation metrics and performance</p>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
