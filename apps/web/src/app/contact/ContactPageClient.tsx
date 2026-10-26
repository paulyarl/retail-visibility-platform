"use client";

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import directoryEnrichmentPublicService from '@/services/DirectoryEnrichmentPublicService';
import { Input, Alert } from '@/components/ui';
import { Card, Button } from '@mantine/core';
import PageHeader, { Icons } from '@/components/PageHeader';
import { motion } from 'framer-motion';


export default function ContactPage() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    name: '',
    businessName: '',
    email: '',
    phone: '',
    posSystem: '',
    subject: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const utmCampaign = searchParams?.get('utm_campaign');
    const utmSource = searchParams?.get('utm_source');
    const noteLines = [
      `Subject: ${formData.subject}`,
      '',
      formData.message,
      utmSource ? `Source: ${utmSource}${utmCampaign ? ` / ${utmCampaign}` : ''}` : '',
    ].filter(Boolean);

    try {
      const result = await directoryEnrichmentPublicService.submitLeadGen({
        businessName: formData.businessName,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        posSystem: formData.posSystem || undefined,
        note: noteLines.join('\n'),
      });
      if (!result.success) {
        setError('Failed to send message. Please try again.');
        return;
      }
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'lead_form_submitted', {
          event_category: 'lead_intake',
          utm_campaign: utmCampaign || undefined,
        });
      }
      setSuccess(true);
      setFormData({ name: '', businessName: '', email: '', phone: '', posSystem: '', subject: '', message: '' });
    } catch (err) {
      setError('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Contact Support"
        description="Get in touch with our team"
        icon={Icons.Settings}
        backLink={{ href: '/', label: 'Back to Home' }}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card withBorder padding="lg" radius="md">
              <div className="space-y-4">
                {/* Email */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">Email</p>
                    <a href="mailto:support@visibleshelf.com" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
                      support@visibleshelf.com
                    </a>
                  </div>
                </div>

                {/* Documentation */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-secondary-100 dark:bg-secondary-900/30 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-secondary-600 dark:text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">Documentation</p>
                    <a href="/features" className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
                      View features & guides
                    </a>
                  </div>
                </div>

                {/* Response Time */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-success-100 dark:bg-success-900/30 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-success-600 dark:text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">Response Time</p>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      We typically respond within 24 hours
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card withBorder padding="lg" radius="md">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                  <div className="flex-1">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Send us a Message</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Fill out the form below</p>
                  </div>
                </div>
                </div>
                {success && (
                  <Alert variant="success" title="Message Sent!" className="mb-4">
                    <p>We've received your message and will get back to you within one business day.</p>
                    <p className="mt-2">
                      <Link href="/customerlogin?mode=register" className="font-medium underline">
                        Create a free account
                      </Link>{' '}
                      to track your listing and claim it when it's ready.
                    </p>
                  </Alert>
                )}

                {error && (
                  <Alert variant="error" title="Error" className="mb-4" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                {!success && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="Name"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />

                  <Input
                    label="Business name"
                    placeholder="Your store's name"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    required
                  />

                  <Input
                    label="Email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />

                  <Input
                    label="Phone"
                    type="tel"
                    placeholder="(optional)"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      POS system
                    </label>
                    <select
                      value={formData.posSystem}
                      onChange={(e) => setFormData({ ...formData, posSystem: e.target.value })}
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select (optional)</option>
                      <option value="clover">Clover</option>
                      <option value="square">Square</option>
                      <option value="other">Other</option>
                      <option value="none">No POS yet</option>
                    </select>
                  </div>

                  <Input
                    label="Subject"
                    placeholder="What's this about?"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Message
                    </label>
                    <textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tell us how we can help..."
                      rows={5}
                      required
                      className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <Button variant='gradient' style={{ color: 'white' }}
                  type="submit" disabled={submitting} loading={submitting} className="w-full">
                    {submitting ? 'Sending...' : 'Send Message'}
                  </Button>
                </form>
                )}
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
