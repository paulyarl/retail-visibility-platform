'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import {
  Plus,
  X,
  Loader2,
  Save,
  HelpCircle,
  Store,
  Package,
} from 'lucide-react';
import { faqService, FaqCategory, FaqItem } from '@/services/FaqService';

interface FaqDialogProps {
  tenantId: string;
  categories: FaqCategory[];
  faq?: FaqItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultScope?: 'storefront' | 'product';
}

export default function FaqDialog({
  tenantId,
  categories,
  faq,
  open,
  onClose,
  onSuccess,
  defaultScope = 'storefront',
}: FaqDialogProps) {
  const isEdit = !!faq;
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [scope, setScope] = useState<'storefront' | 'product'>(defaultScope);
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft');
  const [categoryId, setCategoryId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (faq) {
        setQuestion(faq.question);
        setAnswer(faq.answer);
        setScope(faq.scope);
        setStatus(faq.status);
        setCategoryId(faq.category_id ?? '');
        setTags(faq.tags || []);
      } else {
        setQuestion('');
        setAnswer('');
        setScope(defaultScope);
        setStatus('draft');
        setCategoryId('');
        setTags([]);
      }
      setError(null);
      setTagInput('');
    }
  }, [open, faq, defaultScope]);

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      setError('Question and answer are required');
      return;
    }
    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        category_id: categoryId,
        question: question.trim(),
        answer: answer.trim(),
        scope,
        status,
        tags,
      };

      if (isEdit && faq) {
        await faqService.updateFAQ(tenantId, faq.id, payload);
      } else {
        await faqService.createFAQ(tenantId, payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || `Failed to ${isEdit ? 'update' : 'create'} FAQ`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-600" />
            {isEdit ? 'Edit FAQ' : 'Create FAQ'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Question <span className="text-red-500">*</span>
            </label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., What are your store hours?"
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Answer <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Provide a clear, helpful answer..."
              rows={5}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-9 px-3 rounded-md border border-neutral-200 bg-white text-sm w-full"
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
              <div className="flex gap-2">
                {(['draft', 'active', 'archived'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors capitalize ${
                      status === s
                        ? 'bg-blue-50 border-blue-200 text-blue-700'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Scope</label>
            <div className="flex gap-2">
              {(['storefront', 'product'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                    scope === s
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  {s === 'storefront' ? <Store className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                  {s === 'storefront' ? 'Storefront' : 'Product'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Tags</label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Press Enter to add a tag"
                className="max-w-xs"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-neutral-200 bg-white text-neutral-700 cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                  >
                    {tag}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : isEdit ? 'Update FAQ' : 'Create FAQ'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
