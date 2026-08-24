'use client';

import { useState } from 'react';
import { X, Send, Calendar, AlertCircle } from 'lucide-react';
import marketingCustomerService, { CreatePostPayload } from '@/services/MarketingCustomerService';
import { OfferPostBuilder } from './OfferPostBuilder';

interface PostComposerProps {
  onClose: () => void;
  onCreated: () => void;
}

type PostType = 'STANDARD' | 'EVENT' | 'OFFER';

export function PostComposer({ onClose, onCreated }: PostComposerProps) {
  const [postType, setPostType] = useState<PostType>('STANDARD');
  const [summary, setSummary] = useState('');
  const [callToActionType, setCallToActionType] = useState<string>('LEARN_MORE');
  const [callToActionUrl, setCallToActionUrl] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [offerCouponCode, setOfferCouponCode] = useState('');
  const [offerRedeemUrl, setOfferRedeemUrl] = useState('');
  const [offerTerms, setOfferTerms] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedulingError, setSchedulingError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!summary.trim()) {
      setError('Summary is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSchedulingError(null);

      const payload: CreatePostPayload = {
        summary: summary.trim(),
        topicType: postType,
        callToActionType: callToActionType as any,
        callToActionUrl: callToActionUrl || undefined,
        mediaUrl: mediaUrl || undefined,
        scheduledFor: scheduledFor || undefined,
      };

      if (postType === 'EVENT') {
        payload.eventTitle = eventTitle || undefined;
        payload.eventStartDate = eventStartDate ? new Date(eventStartDate).toISOString() : undefined;
        payload.eventEndDate = eventEndDate ? new Date(eventEndDate).toISOString() : undefined;
      }

      if (postType === 'OFFER') {
        payload.offerCouponCode = offerCouponCode || undefined;
        payload.offerRedeemUrl = offerRedeemUrl || undefined;
        payload.offerTerms = offerTerms || undefined;
      }

      await marketingCustomerService.createPost(payload);
      onCreated();
    } catch (err: any) {
      const msg = err.message || 'Failed to create post';
      if (msg.includes('scheduling') || msg.includes('Scheduler')) {
        setSchedulingError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">New Post</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          {schedulingError && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-orange-700 flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {schedulingError}
            </div>
          )}

          {/* Post Type Selector */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Post Type</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'STANDARD', label: "What's New" },
                { value: 'EVENT', label: 'Event' },
                { value: 'OFFER', label: 'Offer' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPostType(opt.value as PostType)}
                  className={`text-sm px-3 py-2 rounded-md border transition-colors ${
                    postType === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Summary</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Write your post summary..."
            />
            <p className="text-xs text-gray-400 mt-1">{summary.length} / 1000</p>
          </div>

          {/* Event fields */}
          {postType === 'EVENT' && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Event Title</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Event title"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={eventStartDate}
                    onChange={(e) => setEventStartDate(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={eventEndDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
            </>
          )}

          {/* Offer fields */}
          {postType === 'OFFER' && (
            <OfferPostBuilder
              couponCode={offerCouponCode}
              setCouponCode={setOfferCouponCode}
              redeemUrl={offerRedeemUrl}
              setRedeemUrl={setOfferRedeemUrl}
              terms={offerTerms}
              setTerms={setOfferTerms}
            />
          )}

          {/* CTA */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Call to Action</label>
              <select
                value={callToActionType}
                onChange={(e) => setCallToActionType(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="LEARN_MORE">Learn more</option>
                <option value="BOOK">Book</option>
                <option value="ORDER">Order</option>
                <option value="SHOP">Shop</option>
                <option value="SIGN_UP">Sign up</option>
                <option value="CALL">Call</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">CTA URL</label>
              <input
                type="url"
                value={callToActionUrl}
                onChange={(e) => setCallToActionUrl(e.target.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Media URL */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">Media URL (optional)</label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="https://example.com/photo.jpg"
            />
          </div>

          {/* Scheduling */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Schedule for Later (optional)
            </label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <p className="text-xs text-gray-400 mt-1">Leave empty to publish immediately. Scheduling requires the GBP Posts Scheduler capability.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !summary.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm transition-colors"
          >
            <Send className="w-4 h-4" />
            {loading ? 'Publishing...' : scheduledFor ? 'Schedule Post' : 'Publish Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
