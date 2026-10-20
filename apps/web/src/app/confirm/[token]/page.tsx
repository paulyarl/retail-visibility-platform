'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import {
  confirmPagePublicService,
  type ConfirmPageData,
} from '@/services/ConfirmPagePublicService';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, MapPin } from 'lucide-react';

type PainOutcome = 'confirmed' | 'disputed' | 'not_asked';
type Permission = 'yes' | 'no' | 'not_asked';

function factText(data: ConfirmPageData): string | null {
  if (!data.fact) return null;
  if (data.fact.label) return data.fact.label;
  const parts = [data.fact.expected, data.fact.actual].filter(Boolean);
  return parts.length > 0 ? parts.join(' — currently ') : null;
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
        active
          ? 'border-blue-600 bg-blue-50 text-blue-700'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

export default function ConfirmPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [data, setData] = useState<ConfirmPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [operational, setOperational] = useState<boolean | undefined>(undefined);
  const [painOutcome, setPainOutcome] = useState<PainOutcome>('not_asked');
  const [permission, setPermission] = useState<Permission>('not_asked');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const result = await confirmPagePublicService.get(token);
      if (!result) {
        setError('This confirm link is not valid.');
      } else {
        setData(result);
      }
    } catch {
      setError('This confirm link is not valid.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async () => {
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await confirmPagePublicService.submit(token, {
        operational,
        painOutcome,
        followUpPermission: permission,
        notes: notes.trim() || undefined,
      });
      if (!ok) {
        setError('We could not save your confirmation. Please try again.');
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('We could not save your confirmation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold text-gray-900">Link not available</h1>
          <p className="mt-2 text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (data.expired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <h1 className="mt-3 text-lg font-semibold text-gray-900">This link has expired</h1>
          <p className="mt-2 text-sm text-gray-600">
            Please reply to the message you received and we will send a fresh link.
          </p>
        </div>
      </div>
    );
  }

  const fact = factText(data);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-xl space-y-5">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Local retail directory
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">
            {data.businessName || 'Your business'}
          </h1>
          {data.city && (
            <p className="mt-1 flex items-center justify-center gap-1 text-sm text-gray-500">
              <MapPin className="h-3.5 w-3.5" />
              {data.city}{data.state ? `, ${data.state}` : ''}
            </p>
          )}
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h2 className="mt-3 text-lg font-semibold text-gray-900">Thank you — we have your confirmation.</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your listing record is updated. You can see the current listing or claim it below.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              {data.galleryUrl && (
                <a
                  href={data.galleryUrl}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  See your diagnostic
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {data.claimUrl && (
                <a
                  href={data.claimUrl}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Claim your listing
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {fact && !data.disputed ? (
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Our records show
                </p>
                <p className="mt-1 text-sm text-gray-800">{fact}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Choice active={painOutcome === 'confirmed'} onClick={() => setPainOutcome('confirmed')}>
                    That&apos;s accurate
                  </Choice>
                  <Choice active={painOutcome === 'disputed'} onClick={() => setPainOutcome('disputed')}>
                    That&apos;s changed
                  </Choice>
                </div>
              </div>
            ) : data.disputed ? (
              <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                We have updated our records. Please confirm the current details below.
              </div>
            ) : null}

            <div className="mt-5">
              <p className="text-sm font-medium text-gray-900">Is the business still open?</p>
              <div className="mt-2 flex gap-2">
                <Choice active={operational === true} onClick={() => setOperational(true)}>
                  Yes, still open
                </Choice>
                <Choice active={operational === false} onClick={() => setOperational(false)}>
                  No, closed
                </Choice>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm font-medium text-gray-900">Can we send you a short follow-up?</p>
              <div className="mt-2 flex gap-2">
                <Choice active={permission === 'yes'} onClick={() => setPermission('yes')}>
                  Yes
                </Choice>
                <Choice active={permission === 'no'} onClick={() => setPermission('no')}>
                  No
                </Choice>
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-medium text-gray-900">Anything we should correct?</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Phone, address, hours, or anything else…"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </label>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {submitting ? 'Sending…' : 'Confirm'}
            </button>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-4 text-sm">
          {data.placeUrl && (
            <a href={data.placeUrl} className="text-blue-600 hover:underline">
              View your listing
            </a>
          )}
          {data.galleryUrl && !submitted && (
            <a href={data.galleryUrl} className="text-blue-600 hover:underline">
              See your diagnostic
            </a>
          )}
          {data.claimUrl && !submitted && (
            <a href={data.claimUrl} className="text-blue-600 hover:underline">
              Claim your listing
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
