'use client';

import { useState } from 'react';
import { X, Calendar, MessageSquare } from 'lucide-react';
import marketingOpsService, { ReviewResponseType } from '@/services/MarketingOpsService';

const RESPONSE_TYPES: { value: ReviewResponseType; label: string }[] = [
  { value: 'first_response', label: 'First Response' },
  { value: 'follow_up', label: 'Follow-Up' },
  { value: 'public_reply', label: 'Public Reply' },
  { value: 'private_message', label: 'Private Message' },
];

const QUICK_SCHEDULE_OPTIONS = [
  { label: '48 hours', hours: 48 },
  { label: '3 days', hours: 72 },
  { label: '1 week', hours: 168 },
  { label: '2 weeks', hours: 336 },
];

interface ReviewResponseLogModalProps {
  pipelineId: string;
  mode: 'log' | 'schedule';
  onSubmit: () => void;
  onClose: () => void;
}

export default function ReviewResponseLogModal({ pipelineId, mode, onSubmit, onClose }: ReviewResponseLogModalProps) {
  const [responseType, setResponseType] = useState<ReviewResponseType>('first_response');
  const [responseText, setResponseText] = useState('');
  const [platformReviewId, setPlatformReviewId] = useState('');
  const [notes, setNotes] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'log') {
        await marketingOpsService.logReviewResponse(pipelineId, {
          response_type: responseType,
          response_text: responseText || undefined,
          platform_review_id: platformReviewId || undefined,
          notes: notes || undefined,
        });
      } else {
        if (!scheduledFor) {
          setError('Please select a date/time for the follow-up');
          setSubmitting(false);
          return;
        }
        await marketingOpsService.scheduleReviewFollowUp(pipelineId, {
          scheduledFor: new Date(scheduledFor).toISOString(),
          notes: notes || undefined,
        });
      }
      onSubmit();
    } catch (e: any) {
      setError(e.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const setQuickSchedule = (hours: number) => {
    const d = new Date(Date.now() + hours * 60 * 60 * 1000);
    setScheduledFor(d.toISOString().slice(0, 16));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'log' ? 'Log Review Response' : 'Schedule Follow-Up'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'log' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Response type</label>
                <select
                  value={responseType}
                  onChange={(e) => setResponseType(e.target.value as ReviewResponseType)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                >
                  {RESPONSE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Platform review ID (optional)</label>
                <input
                  type="text"
                  value={platformReviewId}
                  onChange={(e) => setPlatformReviewId(e.target.value)}
                  placeholder="e.g., google-review-123"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Response text (optional)</label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={3}
                  placeholder="The response sent to the reviewer…"
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </>
          )}

          {mode === 'schedule' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Scheduled for</label>
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {QUICK_SCHEDULE_OPTIONS.map((opt) => (
                    <button
                      key={opt.hours}
                      type="button"
                      onClick={() => setQuickSchedule(opt.hours)}
                      className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Internal notes…"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {mode === 'log' ? <MessageSquare className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
              {submitting ? 'Saving…' : mode === 'log' ? 'Log response' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
