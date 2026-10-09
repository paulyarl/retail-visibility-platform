'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, Loader2, Play, Square } from 'lucide-react';

import directoryPresenceAdminService, {
  type DemoWindow,
  type DemoWindowState,
} from '@/services/DirectoryPresenceAdminService';

const DURATION_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '60 minutes' },
];

interface DemoWindowPanelProps {
  seedId: string;
  canEdit?: boolean;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * DemoWindowPanel — operator-run in-store demo window (migration 317).
 *
 * Start a window for the demo (live seed edit, photos, logo, hours, QR scan).
 * The window is logged as a visit touch. It closes on its own at the chosen
 * duration, or earlier when stopped. Scans recorded inside the window are
 * demo activity, not prospect engagement.
 */
export default function DemoWindowPanel({ seedId, canEdit = true }: DemoWindowPanelProps) {
  const [state, setState] = useState<DemoWindowState>({ active: null, windows: [] });
  const [duration, setDuration] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setState(await directoryPresenceAdminService.getDemoWindow(seedId));
  }, [seedId]);

  useEffect(() => {
    load();
  }, [load]);

  const active = state.active;
  const endsAt = active ? new Date(active.demo_window_expected_end_at).getTime() : null;

  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [active]);

  useEffect(() => {
    if (active && endsAt !== null && now >= endsAt) load();
  }, [active, endsAt, now, load]);

  async function onStart() {
    setError(null);
    setBusy(true);
    try {
      const ok = await directoryPresenceAdminService.startDemoWindow(seedId, Number(duration));
      if (!ok) setError('Could not start the demo window. Another window may already be running.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function onStop() {
    setError(null);
    setBusy(true);
    try {
      const ok = await directoryPresenceAdminService.stopDemoWindow(seedId);
      if (!ok) setError('No demo window is running.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Clock className="w-5 h-5" /> In-store demo window
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Logs the walk-in demo as a visit touch. The window closes on its own at the chosen time, or
          when stopped. Scans inside the window are demo activity, not prospect engagement.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>
      )}

      {active && endsAt !== null ? (
        <div className="flex flex-wrap items-center gap-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div>
            <p className="text-sm font-medium text-green-900">Demo running</p>
            <p className="text-2xl font-semibold text-green-900 tabular-nums">
              {formatRemaining(endsAt - now)} left
            </p>
            <p className="text-xs text-green-800">
              Started {formatTime(active.demo_window_started_at)} · ends {formatTime(active.demo_window_expected_end_at)}
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={onStop}
              disabled={busy}
              className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              Stop demo
            </button>
          )}
        </div>
      ) : (
        canEdit && (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="demo-window-duration" className="block text-sm font-medium text-gray-700 mb-1">
                Expected demo length
              </label>
              <select
                id="demo-window-duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {DURATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={onStart}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Start demo
            </button>
          </div>
        )
      )}

      {state.windows.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Recent demo windows</p>
          <ul className="divide-y divide-gray-100 text-sm">
            {state.windows.map((w: DemoWindow) => (
              <li key={w.id} className="py-2 flex justify-between gap-4">
                <span className="text-gray-900">
                  {new Date(w.demo_window_started_at).toLocaleDateString()} ·{' '}
                  {formatTime(w.demo_window_started_at)}–
                  {formatTime(w.demo_window_ended_at ?? w.demo_window_expected_end_at)}
                </span>
                <span className="text-gray-500">
                  {w.demo_window_ended_at
                    ? 'stopped'
                    : new Date(w.demo_window_expected_end_at).getTime() > now
                      ? 'running'
                      : 'expired'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
