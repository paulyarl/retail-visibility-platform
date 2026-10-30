'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
  Sparkles,
  Calendar,
  Activity,
  Building2,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { clientLogger } from '@/lib/client-logger';

/**
 * Managed by VisibleShelf — the DFY merchant view.
 *
 * Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §5
 * Shows what the platform does on the merchant's behalf: delegated surfaces,
 * the activity feed, what's scheduled, approval mode, and a request-changes
 * form that lands in the ops queue. DIY write endpoints 403 for these
 * tenants — this page is their read + request path.
 *
 * Backed by GET/POST /api/tenants/:tenantId/gbp-managed and PUT /gbp-options.
 */

const SURFACES = [
  { key: 'reviews', label: 'Review responses' },
  { key: 'posts', label: 'Posts & updates' },
  { key: 'media', label: 'Photos & media' },
  { key: 'info', label: 'Business info (NAP)' },
  { key: 'hours', label: 'Hours' },
  { key: 'attributes', label: 'Attributes' },
];

const APPROVAL_MODES = [
  { value: 'auto_publish', label: 'Auto-publish', hint: 'Platform publishes without review' },
  { value: 'approve_posts', label: 'Approve posts', hint: 'Posts wait for your approval' },
  { value: 'approve_all', label: 'Approve everything', hint: 'Posts and replies wait for approval' },
];

interface ManagedView {
  managed: { by: string; grantedVia: string | null; delegatedSurfaces: Record<string, boolean> | null };
  location: { id: string; name: string; verificationState: string | null } | null;
  settings: { approvalMode: string; autopilotEnabled: boolean };
  scheduledPosts: Array<{ id: string; summary: string; scheduled_for: string; topic_type: string | null }>;
  pendingApprovals: number;
  activity: Array<{ id: string; action: string; actor: string; detail: any; created_at: string }>;
}

export default function ManagedGbpPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;

  const { hasAccess, loading: accessLoading } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );

  const [view, setView] = useState<ManagedView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [requestSurface, setRequestSurface] = useState('info');
  const [requestNote, setRequestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = async () => {
    try {
      const res = await apiRequest(`/api/tenants/${tenantId}/gbp-managed`);
      const body = await res.json();
      if (body?.success) setView(body.data);
      else setError(body?.error || 'Failed to load');
    } catch (e: any) {
      clientLogger.error('[ManagedGbp] load failed', { detail: e?.message });
      setError('Failed to load managed view');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId && hasAccess) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, hasAccess]);

  const saveApprovalMode = async (mode: string) => {
    setSavingMode(true);
    try {
      await apiRequest(`/api/tenants/${tenantId}/gbp-options`, {
        method: 'PUT',
        body: JSON.stringify({ gbp_approval_mode: mode }),
      });
      setView((v) => v && { ...v, settings: { ...v.settings, approvalMode: mode } });
    } catch (e: any) {
      clientLogger.error('[ManagedGbp] save approval mode failed', { detail: e?.message });
    } finally {
      setSavingMode(false);
    }
  };

  const submitRequest = async () => {
    if (!requestNote.trim()) return;
    setSubmitting(true);
    setSubmitted(false);
    try {
      const res = await apiRequest(`/api/tenants/${tenantId}/gbp-managed/request-change`, {
        method: 'POST',
        body: JSON.stringify({ surface: requestSurface, note: requestNote.trim() }),
      });
      const body = await res.json();
      if (body?.success) {
        setRequestNote('');
        setSubmitted(true);
        load();
      }
    } catch (e: any) {
      clientLogger.error('[ManagedGbp] request-change failed', { detail: e?.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (accessLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center text-neutral-500">
        <AlertCircle className="mx-auto mb-3 h-8 w-8" />
        You don’t have access to this page.
      </div>
    );
  }

  const delegated = view?.managed.delegatedSurfaces || {};
  const delegatedList = SURFACES.filter((s) => delegated[s.key] !== false);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link
        href={`/t/${tenantId}/settings/integrations/google`}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
      >
        <ArrowLeft className="h-4 w-4" /> Google integrations
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-semibold">Managed by VisibleShelf</h1>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            We run your Google Business Profile — posts, reviews, photos, and business info.
            {view?.managed.grantedVia && (
              <span className="ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                {view.managed.grantedVia === 'platform_claim' ? 'Claimed by us' : 'Access granted'}
              </span>
            )}
          </p>
        </div>
        {view?.location?.verificationState === 'COMPLETED' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            <CheckCircle className="h-3.5 w-3.5" /> Verified
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Delegated surfaces */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <Building2 className="h-4 w-4" /> What we manage
        </h2>
        <div className="flex flex-wrap gap-2">
          {delegatedList.map((s) => (
            <span key={s.key} className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">
              {s.label}
            </span>
          ))}
          {delegatedList.length === 0 && (
            <span className="text-sm text-neutral-400">No delegated surfaces yet.</span>
          )}
        </div>
        {view?.settings.autopilotEnabled === false && view?.managed.by === 'platform' && (
          <p className="mt-3 text-xs text-neutral-400">
            Auto-replies are off — every review response waits for the ops queue.
          </p>
        )}
      </section>

      {/* Approval mode */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <Sparkles className="h-4 w-4" /> Approval mode
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {APPROVAL_MODES.map((m) => (
            <button
              key={m.value}
              disabled={savingMode}
              onClick={() => saveApprovalMode(m.value)}
              className={`rounded-lg border p-3 text-left transition ${
                view?.settings.approvalMode === m.value
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <div className="text-sm font-medium">{m.label}</div>
              <div className="mt-0.5 text-xs text-neutral-500">{m.hint}</div>
            </button>
          ))}
        </div>
        {view !== null && view.pendingApprovals > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-600">
            <Clock className="h-4 w-4" /> {view.pendingApprovals} item(s) waiting for approval
          </p>
        )}
      </section>

      {/* What's scheduled */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <Calendar className="h-4 w-4" /> Scheduled
        </h2>
        {view?.scheduledPosts.length ? (
          <ul className="divide-y divide-neutral-100">
            {view.scheduledPosts.map((p) => (
              <li key={p.id} className="flex items-start justify-between py-2.5">
                <span className="max-w-md truncate text-sm">{p.summary}</span>
                <span className="ml-3 whitespace-nowrap text-xs text-neutral-400">
                  {new Date(p.scheduled_for).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-400">Nothing scheduled right now.</p>
        )}
      </section>

      {/* Activity feed */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          <Activity className="h-4 w-4" /> Recent activity
        </h2>
        {view?.activity.length ? (
          <ul className="space-y-2.5">
            {view.activity.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5 text-sm">
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    e.actor === 'autopilot' ? 'bg-indigo-400' : e.actor === 'admin' ? 'bg-violet-400' : 'bg-neutral-300'
                  }`}
                />
                <div className="flex-1">
                  <span className="text-neutral-700">{e.action.replace(/_/g, ' ')}</span>
                  {e.detail?.summary && <span className="ml-2 text-neutral-400">{String(e.detail.summary)}</span>}
                </div>
                <span className="whitespace-nowrap text-xs text-neutral-400">
                  {new Date(e.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-400">No activity yet — we’ll log everything we do here.</p>
        )}
      </section>

      {/* Request a change */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Request a change
        </h2>
        <div className="space-y-3">
          <select
            value={requestSurface}
            onChange={(e) => setRequestSurface(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          >
            {SURFACES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <textarea
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            placeholder="Tell us what to change — new hours, a post idea, a photo to add…"
            rows={3}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={submitRequest}
              disabled={submitting || !requestNote.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send request
            </button>
            {submitted && <span className="text-sm text-green-600">Received — we’ll pick it up.</span>}
          </div>
        </div>
      </section>
    </div>
  );
}
