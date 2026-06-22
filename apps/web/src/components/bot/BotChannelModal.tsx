'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import PublicInquiryForm from '@/components/crm/PublicInquiryForm';
import HelpDeskForm from '@/components/crm/HelpDeskForm';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { crmCustomerService } from '@/services/crm/CrmCustomerService';
import type { SteeringChannel } from '@/services/PublicBotService';

interface BotChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: SteeringChannel | null;
  tenantId: string;
}

function BotTicketForm({ tenantId, onSuccess }: { tenantId: string; onSuccess: () => void }) {
  const { customer } = useCustomerAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!customer) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4">
          Sign in to create a support ticket and track its status.
        </p>
        <a
          href="/account/support/new"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-colors"
        >
          Sign in and create ticket
        </a>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    setError('');
    try {
      await crmCustomerService.createTicket({
        tenant_id: tenantId,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        priority: 'medium',
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Failed to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="general">General</option>
          <option value="order">Order Issue</option>
          <option value="product">Product Question</option>
          <option value="billing">Billing</option>
          <option value="return">Return / Refund</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Subject <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Brief summary of your issue"
          required
          className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your issue in detail..."
          rows={4}
          className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !title.trim()}
        className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Creating...' : 'Create Ticket'}
      </button>
    </form>
  );
}

export default function BotChannelModal({ isOpen, onClose, channel, tenantId }: BotChannelModalProps) {
  if (!channel) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={channel.label}
      description={channel.description}
      size="md"
    >
      {channel.type === 'anonymous_inquiry' && (
        <PublicInquiryForm
          tenantId={tenantId}
          showFaqs={false}
          sourceLabel="Bot"
          onSuccess={onClose}
        />
      )}
      {channel.type === 'help_desk' && <HelpDeskForm />}
      {channel.type === 'customer_ticket' && (
        <BotTicketForm tenantId={tenantId} onSuccess={onClose} />
      )}
    </Modal>
  );
}
