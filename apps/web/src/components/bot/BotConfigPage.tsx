'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { ColorInput as MantineColorInput, Slider as MantineSlider, Select as MantineSelect, Stack, Text } from '@mantine/core';
import { toast } from '@/hooks/use-toast';
import { botService, type BotConfig, type UpdateBotConfigInput } from '@/services/BotService';
import { useChatbotOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { uploadImage, ImageUploadPresets, getAcceptString } from '@/lib/image-upload';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';
import { getContrastColor } from '@/lib/color-utils';

interface BotConfigPageProps {
  tenantId: string;
}

export default function BotConfigPage({ tenantId }: BotConfigPageProps) {
  const { data: chatbotCaps } = useChatbotOptionsCapability(tenantId);
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [form, setForm] = useState<UpdateBotConfigInput>({});
  const [platformLogoUrl, setPlatformLogoUrl] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await platformSettingsService.getPlatformSettings();
        if (!cancelled && settings?.logoUrl) {
          setPlatformLogoUrl(settings.logoUrl);
        }
      } catch {
        // Non-critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
              <MantineColorInput
                id="widgetColor"
                value={form.widgetColor || '#4F46E5'}
                onChange={(value) => setForm({ ...form, widgetColor: value })}
                placeholder="Pick widget color"
                size="sm"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="widgetOffsetX">Offset X (px)</Label>
              <Stack gap={4} className="mt-2">
                <MantineSlider
                  id="widgetOffsetX"
                  value={form.widgetOffsetX ?? 20}
                  onChange={(value) => setForm({ ...form, widgetOffsetX: value })}
                  min={0}
                  max={100}
                  step={1}
                  label={(value) => `${value}px`}
                  size="sm"
                  color="indigo"
                />
                <Text size="xs" c="dimmed">{form.widgetOffsetX ?? 20}px from {(form.widgetPosition || 'bottom-right').includes('right') ? 'right' : 'left'} edge</Text>
              </Stack>
            </div>
            <div>
              <Label htmlFor="widgetOffsetY">Offset Y (px)</Label>
              <Stack gap={4} className="mt-2">
                <MantineSlider
                  id="widgetOffsetY"
                  value={form.widgetOffsetY ?? 20}
                  onChange={(value) => setForm({ ...form, widgetOffsetY: value })}
                  min={0}
                  max={100}
                  step={1}
                  label={(value) => `${value}px`}
                  size="sm"
                  color="indigo"
                />
                <Text size="xs" c="dimmed">{form.widgetOffsetY ?? 20}px from {(form.widgetPosition || 'bottom-right').includes('bottom') ? 'bottom' : 'top'} edge</Text>
              </Stack>
            </div>
            <div>
              <Label htmlFor="widgetFont">Font Family</Label>
              <MantineSelect
                id="widgetFont"
                value={form.widgetFont || 'system-ui, sans-serif'}
                onChange={(value) => setForm({ ...form, widgetFont: value || undefined })}
                placeholder="Select font family"
                size="sm"
                className="mt-1"
                data={[
                  { value: 'system-ui, sans-serif', label: 'System UI (Default)' },
                  { value: "'Inter', sans-serif", label: 'Inter' },
                  { value: "'Roboto', sans-serif", label: 'Roboto' },
                  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
                  { value: "'Lato', sans-serif", label: 'Lato' },
                  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
                  { value: "'Poppins', sans-serif", label: 'Poppins' },
                  { value: "'Nunito', sans-serif", label: 'Nunito' },
                  { value: "'Playfair Display', serif", label: 'Playfair Display (Serif)' },
                  { value: "'Merriweather', serif", label: 'Merriweather (Serif)' },
                  { value: "'Lora', serif", label: 'Lora (Serif)' },
                  { value: "'Source Code Pro', monospace", label: 'Source Code Pro (Mono)' },
                  { value: "'Fira Code', monospace", label: 'Fira Code (Mono)' },
                  { value: 'Georgia, serif', label: 'Georgia (Serif)' },
                  { value: "'Courier New', monospace", label: 'Courier New (Mono)' },
                ]}
              />
            </div>
            <div>
              <Label htmlFor="widgetAvatarUrl">Bot Avatar</Label>
              <div className="mt-2 space-y-3">
                {(form.widgetAvatarUrl || config?.widgetAvatarUrl || platformLogoUrl) && (
                  <div className="flex items-center gap-3">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700 shrink-0">
                      <Image
                        src={form.widgetAvatarUrl || config?.widgetAvatarUrl || platformLogoUrl || ''}
                        alt="Bot avatar"
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                    {(form.widgetAvatarUrl || config?.widgetAvatarUrl) ? (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, widgetAvatarUrl: null })}
                        className="text-sm text-red-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-sm text-neutral-500 dark:text-neutral-400">Default: platform logo</span>
                    )}
                  </div>
                )}
                <input
                  id="widgetAvatarUrl"
                  type="file"
                  accept={getAcceptString(ImageUploadPresets.avatar.allowedTypes!)}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingAvatar(true);
                    try {
                      const result = await uploadImage(file, ImageUploadPresets.avatar);
                      if (result.error) {
                        toast({ title: result.error.message, variant: 'destructive' });
                        return;
                      }
                      const url = await botService.uploadAvatar(tenantId, result.dataUrl, result.contentType);
                      setForm({ ...form, widgetAvatarUrl: url });
                      setConfig(prev => prev ? { ...prev, widgetAvatarUrl: url } : prev);
                      toast({ title: 'Avatar uploaded successfully' });
                    } catch (err: any) {
                      toast({ title: err?.message || 'Failed to upload avatar', variant: 'destructive' });
                    } finally {
                      setUploadingAvatar(false);
                    }
                  }}
                  disabled={uploadingAvatar}
                  className="block w-full text-sm text-neutral-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary-50 file:text-primary-700
                    hover:file:bg-primary-100
                    dark:file:bg-primary-900/20 dark:file:text-primary-400
                    dark:hover:file:bg-primary-900/30
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Recommended: Square image, 200x200px to 400x400px. Max 2MB. If not set, the platform logo is used as default.
                </p>
                {uploadingAvatar && (
                  <p className="text-sm text-primary-600 dark:text-primary-400">Uploading...</p>
                )}
              </div>
            </div>
          </div>

          {/* Font & Greeting Preview */}
          <div className="mt-2 rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 text-sm font-medium shrink-0" style={{ background: form.widgetColor || '#4F46E5', color: getContrastColor(form.widgetColor || '#4F46E5') }}>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-base shrink-0">{form.botName?.charAt(0) || 'A'}</div>
                <span className="truncate">{form.botName || 'Assistant'}</span>
              </div>
              <div className="flex items-center gap-1.5" title={form.status || 'active'}>
                {form.status === 'paused' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M9 5h2v14H9zm4 0h2v14h-2z" /></svg>
                ) : form.status === 'disabled' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" /></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.5 14.5l-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z" /></svg>
                )}
                <span className="text-xs capitalize">{form.status || 'active'}</span>
              </div>
            </div>
            <div className="px-4 py-3 bg-neutral-50 dark:bg-neutral-800" style={{ fontFamily: form.widgetFont || 'system-ui, sans-serif' }}>
              <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm">
                <p className="whitespace-pre-line">{form.greeting || 'Hi! How can I help you today?'}</p>
              </div>
              <div className="flex justify-end mt-2">
                <div
                  className="max-w-[85%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm"
                  style={{
                    background: (form.widgetColor || '#4F46E5') + '1A',
                    border: `1px solid ${(form.widgetColor || '#4F46E5')}40`,
                    color: form.widgetColor || '#4F46E5',
                  }}
                >
                  <p>When do you close?</p>
                </div>
              </div>
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
