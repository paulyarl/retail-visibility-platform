'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, Select, Button } from '@/components/ui';
import { Switch } from '@/components/ui/Switch';
import { botPlatformAdminService, type BotPlatformSettings, type BotSyncEstimate, type BotSyncResult, type AiProviderType } from '@/services/bot/BotPlatformAdminService';
import { clientLogger } from '@/lib/client-logger';

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'mistral', label: 'Mistral' },
];

const PROVIDER_MODELS: Record<AiProviderType, { chat: { value: string; label: string }[]; embedding: { value: string; label: string }[] }> = {
  openai: {
    chat: [
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini ($0.15/1M in, $0.60/1M out)' },
      { value: 'gpt-4o', label: 'gpt-4o ($2.50/1M in, $10/1M out)' },
      { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini ($0.40/1M in, $1.60/1M out)' },
      { value: 'gpt-4.1-nano', label: 'gpt-4.1-nano ($0.10/1M in, $0.40/1M out)' },
    ],
    embedding: [
      { value: 'text-embedding-3-small', label: 'text-embedding-3-small ($0.02/1M tokens)' },
      { value: 'text-embedding-3-large', label: 'text-embedding-3-large ($0.13/1M tokens)' },
      { value: 'text-embedding-ada-002', label: 'text-embedding-ada-002 ($0.10/1M tokens)' },
    ],
  },
  anthropic: {
    chat: [
      { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku ($0.80/1M in, $4/1M out)' },
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet ($3/1M in, $15/1M out)' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus ($15/1M in, $75/1M out)' },
    ],
    embedding: [
      { value: 'voyage-3', label: 'Voyage-3 ($0.06/1M tokens) — via Voyage AI' },
      { value: 'voyage-3-lite', label: 'Voyage-3-Lite ($0.02/1M tokens) — via Voyage AI' },
    ],
  },
  google: {
    chat: [
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash ($0.10/1M in, $0.40/1M out)' },
      { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite ($0.075/1M in, $0.30/1M out)' },
      { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash ($0.075/1M in, $0.30/1M out)' },
      { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro ($1.25/1M in, $5/1M out)' },
    ],
    embedding: [
      { value: 'text-embedding-004', label: 'text-embedding-004 (free tier available)' },
    ],
  },
  mistral: {
    chat: [
      { value: 'mistral-small-latest', label: 'Mistral Small ($0.20/1M in, $0.60/1M out)' },
      { value: 'mistral-large-latest', label: 'Mistral Large ($2/1M in, $6/1M out)' },
      { value: 'open-mistral-nemo', label: 'Mistral Nemo ($0.15/1M in, $0.15/1M out)' },
    ],
    embedding: [
      { value: 'mistral-embed', label: 'mistral-embed ($0.10/1M tokens)' },
    ],
  },
};

const SYNC_INTERVAL_OPTIONS = [
  { value: '0', label: 'Manual only (no auto-sync)' },
  { value: '6', label: 'Every 6 hours' },
  { value: '12', label: 'Every 12 hours (default)' },
  { value: '24', label: 'Every 24 hours' },
  { value: '48', label: 'Every 48 hours' },
  { value: '168', label: 'Every 7 days' },
];

export default function BotAiControls() {
  const [settings, setSettings] = useState<BotPlatformSettings | null>(null);
  const [estimate, setEstimate] = useState<BotSyncEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<BotSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEstimate = useCallback(async () => {
    try {
      const est = await botPlatformAdminService.getSyncEstimate();
      setEstimate(est);
    } catch (err) {
      clientLogger.error('[BotAiControls] Estimate error:', { detail: err });
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const data = await botPlatformAdminService.getBotSettings();
        setSettings(data);
        await loadEstimate();
      } catch (err) {
        clientLogger.error('[BotAiControls] Load error:', { detail: err });
        setError('Failed to load AI controls');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [loadEstimate]);

  async function handleUpdate(updated: BotPlatformSettings) {
    setSettings(updated);
    setSaving(true);
    setError(null);
    try {
      const result = await botPlatformAdminService.updateBotSettings(updated);
      setSettings(result);
      await loadEstimate();
    } catch (err) {
      clientLogger.error('[BotAiControls] Update error:', { detail: err });
      setError('Failed to update setting');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(field: keyof BotPlatformSettings, value: boolean) {
    if (!settings) return;
    await handleUpdate({ ...settings, [field]: value });
  }

  async function handleSelect(field: keyof BotPlatformSettings, value: string | number) {
    if (!settings) return;
    await handleUpdate({ ...settings, [field]: value });
  }

  async function handleSyncNow() {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const result = await botPlatformAdminService.triggerSyncNow();
      setSyncResult(result);
      await loadEstimate();
    } catch (err) {
      clientLogger.error('[BotAiControls] Sync error:', { detail: err });
      setError('Failed to trigger sync');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner size="md" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>AI Controls</CardTitle>
          {saving && <Spinner size="sm" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {/* Toggles row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Bot AI Enabled */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Bot AI Engine</span>
                {settings?.botAiEnabled ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Active</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Disabled</Badge>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Enables OpenAI dynamic responses for all tenant bots. When off, bots use static FAQ mode.
              </p>
            </div>
            <Switch
              checked={settings?.botAiEnabled ?? true}
              onCheckedChange={(v) => handleToggle('botAiEnabled', v)}
              disabled={saving}
            />
          </div>

          {/* Embedding Sync Enabled */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Embedding Sync</span>
                {settings?.botEmbeddingSyncEnabled ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Running</Badge>
                ) : (
                  <Badge className="bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">Paused</Badge>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-1">
                Controls the scheduled embedding refresh job. Disable to stop all OpenAI embedding API usage.
              </p>
            </div>
            <Switch
              checked={settings?.botEmbeddingSyncEnabled ?? true}
              onCheckedChange={(v) => handleToggle('botEmbeddingSyncEnabled', v)}
              disabled={saving}
            />
          </div>
        </div>

        {/* Provider + Model configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Chat provider + model */}
          <div className="space-y-3">
            <Select
              label="Chat Provider"
              options={PROVIDER_OPTIONS}
              value={settings?.botChatProvider ?? 'openai'}
              onChange={(e) => {
                const provider = e.target.value as AiProviderType;
                const defaultModel = PROVIDER_MODELS[provider].chat[0]?.value ?? 'gpt-4o-mini';
                if (!settings) return;
                handleUpdate({ ...settings, botChatProvider: provider, botChatModel: defaultModel });
              }}
              disabled={saving}
            />
            <Select
              label="Chat Model"
              options={PROVIDER_MODELS[settings?.botChatProvider ?? 'openai']?.chat ?? []}
              value={settings?.botChatModel ?? 'gpt-4o-mini'}
              onChange={(e) => handleSelect('botChatModel', e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Embedding provider + model */}
          <div className="space-y-3">
            <Select
              label="Embedding Provider"
              options={PROVIDER_OPTIONS}
              value={settings?.botEmbeddingProvider ?? 'openai'}
              onChange={(e) => {
                const provider = e.target.value as AiProviderType;
                const defaultModel = PROVIDER_MODELS[provider].embedding[0]?.value ?? 'text-embedding-3-small';
                if (!settings) return;
                handleUpdate({ ...settings, botEmbeddingProvider: provider, botEmbeddingModel: defaultModel });
              }}
              disabled={saving}
            />
            <Select
              label="Embedding Model"
              options={PROVIDER_MODELS[settings?.botEmbeddingProvider ?? 'openai']?.embedding ?? []}
              value={settings?.botEmbeddingModel ?? 'text-embedding-3-small'}
              onChange={(e) => handleSelect('botEmbeddingModel', e.target.value)}
              disabled={saving}
            />
          </div>
        </div>

        {/* Sync frequency */}
        <Select
          label="Sync Frequency"
          options={SYNC_INTERVAL_OPTIONS}
          value={String(settings?.botSyncIntervalHours ?? 12)}
          onChange={(e) => handleSelect('botSyncIntervalHours', parseInt(e.target.value, 10))}
          disabled={saving}
        />

        {/* Cost estimation + Sync Now */}
        <div className="rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Sync Cost Estimate</span>
            <Button
              size="sm"
              onClick={handleSyncNow}
              disabled={syncing || !settings?.botAiEnabled || !settings?.botEmbeddingSyncEnabled}
            >
              {syncing ? <Spinner size="sm" /> : 'Sync Now'}
            </Button>
          </div>
          {estimate ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-neutral-500">Tenants</p>
                <p className="font-medium">{estimate.tenantCount}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Products</p>
                <p className="font-medium">{estimate.totalProducts}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Est. Tokens</p>
                <p className="font-medium">{estimate.estimatedTokens.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Est. Cost</p>
                <p className="font-medium">${estimate.estimatedCostUsd.toFixed(4)}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-500">Loading estimate...</p>
          )}
          {syncResult && (
            <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                ✓ Sync complete: {syncResult.tenants} tenants, {syncResult.products} products, {syncResult.chunks} chunks{syncResult.failed > 0 ? `, ${syncResult.failed} failed` : ''}
              </p>
            </div>
          )}
        </div>

        {/* Warning banner when AI is off */}
        {settings && !settings.botAiEnabled && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              ⚠️ Bot AI is disabled. All tenant bots are operating in static FAQ mode only.
              Dynamic GPT responses and product-aware responses are unavailable.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
