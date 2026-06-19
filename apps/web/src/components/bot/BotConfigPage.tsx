'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { toast } from '@/hooks/use-toast';
import { botService, type BotConfig, type UpdateBotConfigInput } from '@/services/BotService';
import { useChatbotOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';

interface BotConfigPageProps {
  tenantId: string;
}

export default function BotConfigPage({ tenantId }: BotConfigPageProps) {
  const { data: chatbotCaps } = useChatbotOptionsCapability(tenantId, { forTenant: true });
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UpdateBotConfigInput>({});

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await botService.getConfig(tenantId);
      setConfig(cfg);
      setForm({
        botName: cfg.botName,
        tone: cfg.tone,
        responseLength: cfg.responseLength,
        fallbackMessage: cfg.fallbackMessage,
        greeting: cfg.greeting,
        widgetPosition: cfg.widgetPosition,
        widgetColor: cfg.widgetColor,
        widgetOffsetX: cfg.widgetOffsetX,
        widgetOffsetY: cfg.widgetOffsetY,
        widgetFont: cfg.widgetFont,
        widgetAvatarUrl: cfg.widgetAvatarUrl,
        autoOpen: cfg.autoOpen,
        autoOpenDelay: cfg.autoOpenDelay,
        afterHoursEnabled: cfg.afterHoursEnabled,
        afterHoursMessage: cfg.afterHoursMessage,
        preChatEnabled: cfg.preChatEnabled,
        preChatEmail: cfg.preChatEmail,
        preChatPhone: cfg.preChatPhone,
        preChatOrder: cfg.preChatOrder,
        status: cfg.status,
        escalationEnabled: cfg.escalationEnabled,
        escalationMessage: cfg.escalationMessage,
      });
    } catch (err: any) {
      toast({ title: 'Failed to load config', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await botService.updateConfig(tenantId, form);
      setConfig(updated);
      toast({ title: 'Configuration saved' });
    } catch (err: any) {
      toast({ title: 'Failed to save config', variant: 'destructive' });
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
      <div className="flex items-center justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader><CardTitle>General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="botName">Bot Name</Label>
              <Input id="botName" value={form.botName || ''} onChange={e => setForm({ ...form, botName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="disabled">Disabled</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="tone">Tone</Label>
              <Select id="tone" value={form.tone || 'friendly'} onChange={e => setForm({ ...form, tone: e.target.value })}>
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="responseLength">Response Length</Label>
              <Select id="responseLength" value={form.responseLength || 'medium'} onChange={e => setForm({ ...form, responseLength: e.target.value })}>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="greeting">Greeting Message</Label>
            <Textarea id="greeting" value={form.greeting || ''} onChange={e => setForm({ ...form, greeting: e.target.value })} rows={2} />
          </div>
          <div>
            <Label htmlFor="fallbackMessage">Fallback Message (when no answer found)</Label>
            <Textarea id="fallbackMessage" value={form.fallbackMessage || ''} onChange={e => setForm({ ...form, fallbackMessage: e.target.value })} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Widget Appearance */}
      <Card>
        <CardHeader><CardTitle>Widget Appearance</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="widgetPosition">Position</Label>
              <Select id="widgetPosition" value={form.widgetPosition || 'bottom-right'} onChange={e => setForm({ ...form, widgetPosition: e.target.value })}>
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="widgetColor">Widget Color</Label>
              <div className="flex items-center gap-2">
                <Input type="color" id="widgetColor" value={form.widgetColor || '#4F46E5'} onChange={e => setForm({ ...form, widgetColor: e.target.value })} className="w-16 h-10 p-1" />
                <Input value={form.widgetColor || ''} onChange={e => setForm({ ...form, widgetColor: e.target.value })} className="flex-1" />
              </div>
            </div>
            <div>
              <Label htmlFor="widgetOffsetX">Offset X (px)</Label>
              <Input type="number" id="widgetOffsetX" value={form.widgetOffsetX ?? 20} onChange={e => setForm({ ...form, widgetOffsetX: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label htmlFor="widgetOffsetY">Offset Y (px)</Label>
              <Input type="number" id="widgetOffsetY" value={form.widgetOffsetY ?? 20} onChange={e => setForm({ ...form, widgetOffsetY: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label htmlFor="widgetFont">Font Family</Label>
              <Input id="widgetFont" value={form.widgetFont || ''} onChange={e => setForm({ ...form, widgetFont: e.target.value })} placeholder="system-ui, sans-serif" />
            </div>
            <div>
              <Label htmlFor="widgetAvatarUrl">Avatar URL (optional)</Label>
              <Input id="widgetAvatarUrl" value={form.widgetAvatarUrl || ''} onChange={e => setForm({ ...form, widgetAvatarUrl: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="autoOpen" checked={form.autoOpen || false} onCheckedChange={v => setForm({ ...form, autoOpen: v })} />
              <Label htmlFor="autoOpen">Auto-open widget</Label>
            </div>
            <div>
              <Label htmlFor="autoOpenDelay">Auto-open delay (seconds)</Label>
              <Input type="number" id="autoOpenDelay" value={form.autoOpenDelay ?? 5} onChange={e => setForm({ ...form, autoOpenDelay: parseInt(e.target.value) || 0 })} className="w-24" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pre-Chat Form */}
      <Card>
        <CardHeader><CardTitle>Pre-Chat Form</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch id="preChatEnabled" checked={form.preChatEnabled || false} onCheckedChange={v => setForm({ ...form, preChatEnabled: v })} />
            <Label htmlFor="preChatEnabled">Require pre-chat form before starting conversation</Label>
          </div>
          {form.preChatEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
              <div className="flex items-center gap-2">
                <Switch id="preChatEmail" checked={form.preChatEmail || false} onCheckedChange={v => setForm({ ...form, preChatEmail: v })} />
                <Label htmlFor="preChatEmail">Email</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="preChatPhone" checked={form.preChatPhone || false} onCheckedChange={v => setForm({ ...form, preChatPhone: v })} />
                <Label htmlFor="preChatPhone">Phone</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="preChatOrder" checked={form.preChatOrder || false} onCheckedChange={v => setForm({ ...form, preChatOrder: v })} />
                <Label htmlFor="preChatOrder">Order Number</Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* After Hours & Escalation */}
      <Card>
        <CardHeader><CardTitle>After Hours & Escalation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch id="afterHoursEnabled" checked={form.afterHoursEnabled || false} onCheckedChange={v => setForm({ ...form, afterHoursEnabled: v })} />
            <Label htmlFor="afterHoursEnabled">Enable after-hours mode</Label>
          </div>
          {form.afterHoursEnabled && (
            <div>
              <Label htmlFor="afterHoursMessage">After-Hours Message</Label>
              <Textarea id="afterHoursMessage" value={form.afterHoursMessage || ''} onChange={e => setForm({ ...form, afterHoursMessage: e.target.value })} rows={2} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Switch id="escalationEnabled" checked={form.escalationEnabled || false} onCheckedChange={v => setForm({ ...form, escalationEnabled: v })} />
            <Label htmlFor="escalationEnabled">Enable escalation to human</Label>
          </div>
          {form.escalationEnabled && (
            <div>
              <Label htmlFor="escalationMessage">Escalation Message</Label>
              <Textarea id="escalationMessage" value={form.escalationMessage || ''} onChange={e => setForm({ ...form, escalationMessage: e.target.value })} rows={2} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
