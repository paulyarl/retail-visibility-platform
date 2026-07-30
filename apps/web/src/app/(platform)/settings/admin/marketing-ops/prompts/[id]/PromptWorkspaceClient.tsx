'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Play, Copy, FileSearch } from 'lucide-react';
import Link from 'next/link';
import marketingOpsService, { PromptTemplate, PromptExecution, Campaign } from '@/services/MarketingOpsService';

export default function PromptWorkspaceClient({ templateId }: { templateId: string }) {
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [executions, setExecutions] = useState<PromptExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});

  const selectedCampaign = useMemo(() =>
    campaigns.find((c) => c.id === selectedCampaignId) || null,
  [campaigns, selectedCampaignId]);
  const [executing, setExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [serverRendered, setServerRendered] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const fetchTemplate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const templates = await marketingOpsService.listPromptTemplates();
      const t = templates.find((t) => t.id === templateId);
      if (!t) throw new Error('Template not found');
      setTemplate(t);
      const [campResult, execs] = await Promise.all([
        marketingOpsService.listCampaigns({ limit: 100 }),
        marketingOpsService.listExecutions(),
      ]);
      setCampaigns(campResult.items);
      setExecutions(execs.filter((e) => e.template_id === templateId));
    } catch (err: any) {
      setError(err.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const extractedVariables = useMemo(() => {
    if (!template?.body) return [];
    const matches = template.body.matchAll(/\{\{(\w+)\}\}/g);
    const vars = new Set<string>();
    for (const m of matches) vars.add(m[1]);
    return Array.from(vars);
  }, [template]);

  useEffect(() => {
    if (!selectedCampaign) return;
    setVariables((prev) => ({
      ...prev,
      business_name: selectedCampaign.business_name,
      category: selectedCampaign.category,
      city: selectedCampaign.city,
      tone: selectedCampaign.tone || '',
      attributes: (selectedCampaign.attributes || []).join(', '),
    }));
    setServerRendered(null);
  }, [selectedCampaign]);

  const renderedPrompt = useMemo(() => {
    if (serverRendered !== null) return serverRendered;
    if (!template?.body) return '';
    let result = template.body;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
    }
    return result;
  }, [template, variables, serverRendered]);

  const handleRenderFromServer = async () => {
    if (!selectedCampaignId) return;
    setRendering(true);
    setRenderError(null);
    try {
      const rendered = await marketingOpsService.renderPrompt(templateId, selectedCampaignId, variables);
      setServerRendered(rendered);
    } catch (err: any) {
      setRenderError(err.message || 'Failed to render prompt from server');
    } finally {
      setRendering(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedCampaignId) return;
    setExecuting(true);
    setError(null);
    try {
      await marketingOpsService.createExecution({
        campaign_id: selectedCampaignId,
        template_id: templateId,
        variables_used: variables,
      });
      await fetchTemplate();
    } catch (err: any) {
      setError(err.message || 'Failed to execute prompt');
    } finally {
      setExecuting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(renderedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([renderedPrompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template?.name?.replace(/\s+/g, '_') ?? 'prompt'}_resolved.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center">
        <p className="text-gray-400">Template not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/settings/admin/marketing-ops/prompts"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Prompt Library
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{template.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Type: {template.prompt_type}{template.tone ? ` · Tone: ${template.tone}` : ''} · v{template.version}
            </p>
          </div>
          <button
            onClick={fetchTemplate}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Template + Variables */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Template Body</h2>
              <pre className="text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                {template.body}
              </pre>
            </div>

            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Variables</h2>
              {extractedVariables.length === 0 ? (
                <p className="text-sm text-gray-400">No variables detected in template.</p>
              ) : (
                <div className="space-y-3">
                  {extractedVariables.map((v) => (
                    <div key={v}>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{`{{${v}}}`}</label>
                      <input
                        type="text"
                        value={variables[v] ?? ''}
                        onChange={(e) => setVariables((prev) => ({ ...prev, [v]: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Execute</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Select Campaign</label>
                  <select
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-neutral-900 dark:border-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select a campaign —</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.business_name} ({c.category}, {c.tone || '—'}, {c.city})</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExecute}
                    disabled={executing || !selectedCampaignId}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    {executing ? 'Executing...' : 'Execute Prompt'}
                  </button>
                  <button
                    onClick={handleRenderFromServer}
                    disabled={rendering || !selectedCampaignId}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-700 dark:hover:bg-neutral-700 disabled:opacity-50"
                  >
                    <FileSearch className="w-4 h-4" />
                    {rendering ? 'Resolving...' : 'Get Resolved Prompt'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Rendered Output + Executions */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Rendered Output</h2>
                <div className="flex items-center gap-3">
                  {serverRendered !== null && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Server-resolved</span>
                  )}
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Download
                  </button>
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              {renderError && (
                <div className="mb-3 text-xs text-red-600 dark:text-red-400">{renderError}</div>
              )}
              <pre className="text-sm text-gray-600 dark:text-gray-400 font-mono whitespace-pre-wrap bg-gray-50 dark:bg-neutral-900/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                {renderedPrompt}
              </pre>
            </div>

            <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Executions</h2>
              {executions.length === 0 ? (
                <p className="text-sm text-gray-400">No executions yet.</p>
              ) : (
                <div className="space-y-2">
                  {executions.slice(0, 10).map((e) => (
                    <div key={e.id} className="border border-gray-200 dark:border-neutral-700 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {campaigns.find((c) => c.id === e.campaign_id)?.business_name ?? e.campaign_id}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(e.executed_at).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>Status: {e.status}</span>
                        {e.pass_rate != null && <span>Pass rate: {e.pass_rate}%</span>}
                        {e.flagged_count != null && <span>Flagged: {e.flagged_count}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
