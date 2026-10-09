'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Flag, Eye, Loader2 } from 'lucide-react';

import directoryPresenceAdminService, {
  type SeedOwnerRequest,
  type SeedOwnerRequestTriageAction,
} from '@/services/DirectoryPresenceAdminService';

interface OwnerRequestsPanelProps {
  seedId: string;
}

const INTENT_STYLES: Record<string, string> = {
  remove: 'bg-red-100 text-red-700',
  claim: 'bg-blue-100 text-blue-700',
  question: 'bg-gray-100 text-gray-600',
};

const INTENT_LABELS: Record<string, string> = {
  remove: 'Takedown',
  claim: 'Claim',
  question: 'Question',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  actioned: 'Actioned',
  dismissed_spam: 'Dismissed — spam',
  dismissed_not_credible: 'Dismissed — not credible',
};

function formatHours(ms: number): string {
  const h = Math.floor(Math.abs(ms) / 3600_000);
  const m = Math.floor((Math.abs(ms) % 3600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

/** SLA chip — only rendered for unresolved requests carrying sla_due_at. */
function SlaBadge({ dueAt, now }: { dueAt: string; now: number }) {
  const remaining = new Date(dueAt).getTime() - now;
  if (remaining >= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">
        <ShieldAlert className="w-3 h-3" />
        SLA active — {formatHours(remaining)} left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[10px] font-semibold">
      <ShieldAlert className="w-3 h-3" />
      SLA expired — {formatHours(remaining)} over
    </span>
  );
}

/**
 * OwnerRequestsPanel — triageable record of anonymous claim/takedown
 * requests resolved to this seed (migration 322). Each row shows the
 * asserted intent/role plus the server-computed credibility summary; a
 * takedown request carries a 48h SLA chip (active/expired). Terminal
 * verdicts resolve the linked CRM inquiry and log an outreach touch.
 */
export default function OwnerRequestsPanel({ seedId }: OwnerRequestsPanelProps) {
  const [requests, setRequests] = useState<SeedOwnerRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const { requests: list } = await directoryPresenceAdminService.listOwnerRequests(seedId);
    setRequests(list);
    setLoaded(true);
  }, [seedId]);

  useEffect(() => { load(); }, [load]);

  const anyActiveSla = requests.some(
    (r) => r.sla_due_at && (r.status === 'open' || r.status === 'acknowledged'),
  );
  useEffect(() => {
    if (!anyActiveSla) return;
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, [anyActiveSla]);

  async function triage(requestId: string, action: SeedOwnerRequestTriageAction) {
    setError(null);
    setBusy(`${requestId}:${action}`);
    try {
      const ok = await directoryPresenceAdminService.triageOwnerRequest(
        seedId,
        requestId,
        action,
        notes[requestId]?.trim() || undefined,
      );
      if (!ok) setError('Triage failed — the request may already be resolved.');
      await load();
    } finally {
      setBusy(null);
    }
  }

  const unresolved = (r: SeedOwnerRequest) => r.status === 'open' || r.status === 'acknowledged';

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Owner Requests</h2>
        <p className="text-xs text-gray-500 mt-1">
          Anonymous claim / takedown requests from the listing and preview
          storefront. Credibility is a triage signal, not verification —
          action nothing automatically.
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {loaded && requests.length === 0 && (
        <p className="text-xs text-gray-400">No owner requests yet.</p>
      )}

      <div className="space-y-3">
        {requests.map((r) => (
          <div key={r.id} className="rounded-lg border border-gray-200 p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${INTENT_STYLES[r.intent] || INTENT_STYLES.question}`}>
                {INTENT_LABELS[r.intent] || r.intent}
              </span>
              {r.requester_role && (
                <span className="text-[10px] text-gray-500">says {r.requester_role}</span>
              )}
              {r.sla_due_at && unresolved(r) && <SlaBadge dueAt={r.sla_due_at} now={now} />}
              <span className={`ml-auto text-[10px] font-medium ${unresolved(r) ? 'text-amber-700' : 'text-gray-500'}`}>
                {STATUS_LABELS[r.status] || r.status}
              </span>
              <span className="text-[10px] text-gray-400">{formatTime(r.created_at)}</span>
            </div>

            {r.subject && <p className="text-xs font-medium text-gray-800">&ldquo;{r.subject}&rdquo;</p>}

            <p className="text-[11px] text-gray-500">
              {r.sender_name || 'Anonymous'}
              {r.sender_email ? ` · ${r.sender_email}` : ''}
              {r.sender_phone ? ` · ${r.sender_phone}` : ''}
              {r.sender_social ? ` · social ${r.sender_social}` : ''}
            </p>

            {r.credibility && (
              <p className="text-[11px] text-gray-600 italic">Credibility: {r.credibility}</p>
            )}

            {unresolved(r) ? (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  value={notes[r.id] || ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                  placeholder="Triage note (optional — recorded with the verdict)"
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  {r.status === 'open' && (
                    <button
                      onClick={() => triage(r.id, 'acknowledge')}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Eye className="w-3 h-3" /> Acknowledge
                    </button>
                  )}
                  <button
                    onClick={() => triage(r.id, 'actioned')}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {busy === `${r.id}:actioned` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    Mark actioned
                  </button>
                  <button
                    onClick={() => triage(r.id, 'dismiss_spam')}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Flag className="w-3 h-3" /> Dismiss — spam
                  </button>
                  <button
                    onClick={() => triage(r.id, 'dismiss_not_credible')}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1 rounded-lg border border-orange-200 px-2.5 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                  >
                    <XCircle className="w-3 h-3" /> Dismiss — not credible
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-500">
                Triaged {formatTime(r.triaged_at)}{r.triaged_by ? ` by ${r.triaged_by}` : ''}
                {r.triage_note ? ` — ${r.triage_note}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
