'use client';

import { useState } from 'react';
import { Sparkles, X, Send, AlertCircle, Lock } from 'lucide-react';
import marketingCustomerService, {
  GbpReview,
  AiDraft,
} from '@/services/MarketingCustomerService';

interface AiDraftPickerProps {
  review: GbpReview;
  onClose: () => void;
  onDraftsGenerated: () => void;
  onReplyPublished: () => void;
}

const angleLabels: Record<string, string> = {
  warm_direct: 'Warm / Direct',
  professional_concise: 'Professional / Concise',
  empathetic_detailed: 'Empathetic / Detailed',
  preview: 'Preview',
};

export function AiDraftPicker({ review, onClose, onDraftsGenerated, onReplyPublished }: AiDraftPickerProps) {
  const [drafts, setDrafts] = useState<AiDraft[] | null>(
    review.ai_drafts && Array.isArray(review.ai_drafts) && review.ai_drafts.length > 0
      ? review.ai_drafts as AiDraft[]
      : null
  );
  const [previewMode, setPreviewMode] = useState(false);
  const [upgradeCta, setUpgradeCta] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<AiDraft | null>(null);
  const [editedText, setEditedText] = useState('');
  const [publishing, setPublishing] = useState(false);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await marketingCustomerService.generateAiDraft(review.id);
      setDrafts(result.drafts);
      setPreviewMode(result.previewMode);
      setUpgradeCta(result.upgradeCta);
      if (!result.previewMode) {
        await onDraftsGenerated();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate AI drafts');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDraft = (draft: AiDraft) => {
    setSelectedDraft(draft);
    setEditedText(draft.text);
  };

  const handlePublish = async () => {
    if (!editedText.trim()) return;
    try {
      setPublishing(true);
      setError(null);
      await marketingCustomerService.replyToReview(review.id, editedText.trim());
      await onReplyPublished();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to publish reply');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Draft Responses</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Review context */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
          <p className="text-xs text-gray-500 mb-1">Review from {review.reviewer_name || 'Anonymous'}</p>
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{review.comment || '(no comment)'}</p>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Generate button (if no drafts yet) */}
          {!drafts && !loading && (
            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 text-blue-300 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Generate AI-powered draft responses tailored to this review and your business voice.
              </p>
              <button
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Generate Drafts
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          {/* Preview mode (unentitled) */}
          {drafts && previewMode && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Preview Mode</p>
                  <p className="text-sm text-blue-600 dark:text-blue-500 mt-1">{upgradeCta}</p>
                </div>
              </div>
              {drafts.map((draft, i) => (
                <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">{angleLabels[draft.angle] || draft.angle}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{draft.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Full 3-draft mode (entitled) */}
          {drafts && !previewMode && !selectedDraft && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">Select a draft to edit and publish:</p>
              {drafts.map((draft, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectDraft(draft)}
                  className="w-full text-left border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">{angleLabels[draft.angle] || draft.angle}</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-4">{draft.text}</p>
                </button>
              ))}
            </div>
          )}

          {/* Edit + publish selected draft */}
          {selectedDraft && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {angleLabels[selectedDraft.angle] || selectedDraft.angle}
                </p>
                <button
                  onClick={() => { setSelectedDraft(null); setEditedText(''); }}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  ← Back to drafts
                </button>
              </div>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={6}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md p-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Edit your reply..."
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">{editedText.length} / 4096</p>
                <button
                  onClick={handlePublish}
                  disabled={!editedText.trim() || publishing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {publishing ? 'Publishing...' : 'Publish Reply'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
