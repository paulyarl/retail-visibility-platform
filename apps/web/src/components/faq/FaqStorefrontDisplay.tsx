'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/Accordion';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Search, MessageSquare, ThumbsUp, ThumbsDown, FileEdit, Loader2, CheckCircle2, Ticket } from 'lucide-react';
import { publicFaqService, PublicFaq, PublicFaqCategory } from '@/services/PublicFaqService';
import Link from 'next/link';

interface FeedbackState {
  [faqId: string]: 'up' | 'down' | null;
}

interface FaqStorefrontDisplayProps {
  tenantId: string;
  askBotCta?: boolean;
  /** If provided, FAQ section is hidden when not enabled */
  enabled?: boolean;
  /** If provided, feedback buttons are hidden when not enabled */
  feedbackEnabled?: boolean;
  /** If false, all accordion categories start collapsed (default: true) */
  defaultExpanded?: boolean;
}

export default function FaqStorefrontDisplay({ tenantId, askBotCta = true, enabled = true, feedbackEnabled = true, defaultExpanded = true }: FaqStorefrontDisplayProps) {
  const [faqs, setFaqs] = useState<PublicFaq[]>([]);
  const [categories, setCategories] = useState<PublicFaqCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const [feedback, setFeedback] = useState<FeedbackState>({});
  const [showCreateTicket, setShowCreateTicket] = useState<Record<string, boolean>>({});
  const [createTicketLoading, setCreateTicketLoading] = useState<Record<string, boolean>>({});
  const [createTicketSuccess, setCreateTicketSuccess] = useState<Record<string, boolean>>({});
  const [editDialog, setEditDialog] = useState<{ faqId: string; question: string } | null>(null);
  const [editComment, setEditComment] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  useEffect(() => {
    async function fetchPublicData() {
      try {
        const [faqData, catData] = await Promise.all([
          publicFaqService.getStorefrontFAQs(tenantId),
          publicFaqService.getCategories(tenantId),
        ]);
        setFaqs(faqData);
        setCategories(catData);
      } catch (err) {
        console.error('Failed to load public FAQs:', err);
      } finally {
        setLoading(false);
      }
    }
    if (tenantId && enabled) fetchPublicData();
  }, [tenantId, enabled]);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.display_order - b.display_order),
    [categories]
  );

  const faqsByCategory = useMemo(() => {
    const map = new Map<string, PublicFaq[]>();
    for (const faq of faqs) {
      const catId = faq.category_id || 'uncategorized';
      if (!map.has(catId)) map.set(catId, []);
      map.get(catId)!.push(faq);
    }
    // Sort FAQs within each category by display_order
    for (const [, list] of map) {
      list.sort((a, b) => a.display_order - b.display_order);
    }
    return map;
  }, [faqs]);

  const filteredFaqs = useMemo(() => {
    if (!debouncedQuery.trim()) return faqsByCategory;
    const q = debouncedQuery.toLowerCase();
    const filtered = new Map<string, PublicFaq[]>();
    for (const [catId, list] of faqsByCategory) {
      const matches = list.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q) ||
          f.tags?.some((t) => t.toLowerCase().includes(q))
      );
      if (matches.length > 0) filtered.set(catId, matches);
    }
    return filtered;
  }, [faqsByCategory, debouncedQuery]);

  const handleFeedback = async (faqId: string, type: 'up' | 'down') => {
    setFeedback((prev) => ({ ...prev, [faqId]: type }));
    await publicFaqService.submitFeedback(tenantId, faqId, type);
    if (type === 'down') {
      setShowCreateTicket((prev) => ({ ...prev, [faqId]: true }));
    }
  };

  const handleCreateTicketFromFeedback = async (faq: PublicFaq) => {
    setCreateTicketLoading((prev) => ({ ...prev, [faq.id]: true }));
    try {
      const ticket = await publicFaqService.createTicketFromFeedback(tenantId, faq.id, {
        title: `Question about: ${faq.question}`,
        description: `Customer needs more help after viewing FAQ: "${faq.question}"`,
        source: 'faq_feedback',
      });
      if (ticket) {
        setCreateTicketSuccess((prev) => ({ ...prev, [faq.id]: true }));
      }
    } catch {
      // Non-critical
    } finally {
      setCreateTicketLoading((prev) => ({ ...prev, [faq.id]: false }));
    }
  };

  const handleSuggestEdit = async () => {
    if (!editDialog || !editComment.trim()) return;
    setEditSubmitting(true);
    try {
      const ok = await publicFaqService.suggestEdit(tenantId, editDialog.faqId, editComment.trim(), editEmail.trim() || undefined);
      if (ok) setEditSuccess(true);
    } catch {
      // Non-critical
    } finally {
      setEditSubmitting(false);
    }
  };

  const openEditDialog = (faqId: string, question: string) => {
    setEditDialog({ faqId, question });
    setEditComment('');
    setEditEmail('');
    setEditSuccess(false);
  };

  const closeEditDialog = () => {
    setEditDialog(null);
    setEditComment('');
    setEditEmail('');
    setEditSuccess(false);
  };

  if (!enabled) return null;

  if (loading) {
    return (
      <div className="py-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-neutral-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (faqs.length === 0) return null;

  const isTwoColumn = sortedCategories.length > 6;
  const halfIndex = Math.ceil(sortedCategories.length / 2);
  const leftCats = isTwoColumn ? sortedCategories.slice(0, halfIndex) : sortedCategories;
  const rightCats = isTwoColumn ? sortedCategories.slice(halfIndex) : [];

  const renderCategoryAccordion = (cats: PublicFaqCategory[]) => (
    <Accordion type="multiple" defaultValue={defaultExpanded ? cats.map((c) => `faq-${c.slug}`) : undefined} className="w-full">
      {cats.map((cat) => {
        const catFaqs = filteredFaqs.get(cat.id);
        if (!catFaqs || catFaqs.length === 0) return null;
        const hashId = `faq-${cat.slug}`;
        return (
          <AccordionItem key={cat.id} value={hashId} id={hashId}>
            <AccordionTrigger className="text-base font-semibold text-neutral-900 hover:no-underline">
              {cat.name}
              <span className="ml-2 text-xs font-normal text-neutral-400">({catFaqs.length})</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {catFaqs.map((faq) => (
                  <div key={faq.id} className="group">
                    <h4 className="text-sm font-medium text-neutral-800 mb-1">{faq.question}</h4>
                    <p className="text-sm text-neutral-600 whitespace-pre-line">{faq.answer}</p>
                    {feedbackEnabled && (
                    <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleFeedback(faq.id, 'up')}
                        className={`p-1 rounded hover:bg-green-50 transition-colors ${
                          feedback[faq.id] === 'up' ? 'text-green-600' : 'text-neutral-400'
                        }`}
                        aria-label="Helpful"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(faq.id, 'down')}
                        className={`p-1 rounded hover:bg-red-50 transition-colors ${
                          feedback[faq.id] === 'down' ? 'text-red-500' : 'text-neutral-400'
                        }`}
                        aria-label="Not helpful"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditDialog(faq.id, faq.question)}
                        className="p-1 rounded hover:bg-blue-50 text-neutral-400 hover:text-blue-500 transition-colors"
                        aria-label="Suggest edit"
                      >
                        <FileEdit className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    )}
                    {/* Create ticket from negative feedback */}
                    {showCreateTicket[faq.id] && !createTicketSuccess[faq.id] && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-neutral-500">Still need help?</span>
                        <button
                          onClick={() => handleCreateTicketFromFeedback(faq)}
                          disabled={createTicketLoading[faq.id]}
                          className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium disabled:opacity-50"
                        >
                          <Ticket className="w-3 h-3" />
                          {createTicketLoading[faq.id] ? 'Creating...' : 'Create support ticket'}
                        </button>
                      </div>
                    )}
                    {createTicketSuccess[faq.id] && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Support ticket created!</span>
                        <Link href="/account/support" className="underline ml-1 hover:text-green-700">
                          View tickets
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );

  return (
    <section id="faq-section" className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-neutral-900">Frequently Asked Questions</h2>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search FAQs..."
          className="pl-9"
        />
      </div>

      {/* Accordion Grid */}
      {filteredFaqs.size === 0 ? (
        <p className="text-center text-neutral-500 py-8">No FAQs match your search.</p>
      ) : isTwoColumn ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>{renderCategoryAccordion(leftCats)}</div>
          <div>{renderCategoryAccordion(rightCats)}</div>
        </div>
      ) : (
        renderCategoryAccordion(sortedCategories)
      )}

      {/* Create Support Ticket CTA (replaces chatbot since chatbot is blocked) */}
      {askBotCta && (
        <div className="mt-8 text-center space-y-2">
          <p className="text-xs text-neutral-500">
            Are you a customer and need help? Open a support ticket here and we will get back to you.
          </p>
          <Link href="/account/support/new">
            <Button variant="outline" className="gap-2">
              <Ticket className="w-4 h-4" />
              Create support ticket
            </Button>
          </Link>
        </div>
      )}

      {/* Suggest Edit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suggest an Edit</DialogTitle>
          </DialogHeader>
          {editSuccess ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <p className="text-sm text-green-700 font-medium">Thank you for your suggestion!</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-neutral-600 mb-1">
                Suggesting an edit for: <strong>{editDialog?.question}</strong>
              </p>
              <textarea
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                placeholder="Describe your suggested change..."
                rows={4}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-md resize-none"
              />
              <Input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Email (optional)"
                type="email"
                className="mt-2"
              />
            </>
          )}
          <DialogFooter>
            {editSuccess ? (
              <Button size="sm" onClick={closeEditDialog}>Done</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={closeEditDialog}>Cancel</Button>
                <Button size="sm" onClick={handleSuggestEdit} disabled={!editComment.trim() || editSubmitting}>
                  {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
