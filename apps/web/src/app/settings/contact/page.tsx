'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import { getAdminEmail, type EmailCategory } from '@/lib/admin-emails';

interface ContactCategory {
  id: EmailCategory;
  name: string;
  description: string;
  icon: string;
  color: string;
  placeholder: string;
  purposeBlurb: string;
}

const CONTACT_CATEGORIES: ContactCategory[] = [
  {
    id: 'subscription',
    name: 'Subscription & Billing',
    description: 'Questions about your plan, billing, or subscription changes',
    icon: '💳',
    color: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
    placeholder: 'I have a question about my subscription...',
    purposeBlurb: 'Use this category for questions about your subscription plan, billing issues, payment methods, plan upgrades or downgrades, invoices, or cancellation requests. Our billing team will respond within 24 hours.',
  },
  {
    id: 'support',
    name: 'Technical Support',
    description: 'Need help with features, bugs, or technical issues',
    icon: '🛟',
    color: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
    placeholder: 'I\'m having trouble with...',
    purposeBlurb: 'Contact our technical support team for help with platform features, troubleshooting errors, bug reports, login issues, or questions about how to use specific functionality. Include screenshots or error messages when possible.',
  },
  {
    id: 'managed_services',
    name: 'Managed Services',
    description: 'Inquire about data entry and catalog management services',
    icon: '🤝',
    color: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
    placeholder: 'I\'m interested in managed services for...',
    purposeBlurb: 'Interested in having our team manage your inventory for you? This category is for inquiries about our managed services including data entry, catalog setup, product descriptions, photo optimization, and ongoing catalog maintenance. We\'ll provide pricing and timeline estimates.',
  },
  {
    id: 'sales',
    name: 'Sales & Demos',
    description: 'Request a demo or learn more about our platform',
    icon: '💼',
    color: 'bg-green-100 text-green-800 hover:bg-green-200',
    placeholder: 'I\'d like to learn more about...',
    purposeBlurb: 'Interested in learning more about our platform? Request a personalized demo, ask about pricing for your specific needs, inquire about enterprise solutions, or discuss how our platform can help your business. Our sales team will schedule a call at your convenience.',
  },
  {
    id: 'partnerships',
    name: 'Partnerships',
    description: 'Partnership opportunities and integration requests',
    icon: '🤝',
    color: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
    placeholder: 'I\'d like to discuss a partnership regarding...',
    purposeBlurb: 'Reach out to discuss partnership opportunities, integration requests, API access, white-label solutions, reseller programs, or strategic collaborations. Our partnerships team will evaluate your proposal and respond with next steps.',
  },
  {
    id: 'general',
    name: 'General Inquiry',
    description: 'Other questions or feedback',
    icon: '📧',
    color: 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200',
    placeholder: 'I wanted to reach out about...',
    purposeBlurb: 'Have a question that doesn\'t fit the other categories? Use this for general inquiries, feedback about the platform, feature suggestions, media inquiries, or any other topics. We\'ll route your message to the appropriate team.',
  },
];

export default function ContactPage() {
  const [selectedCategory, setSelectedCategory] = useState<EmailCategory | null>(null);
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');

  const handleSendMessage = () => {
    if (!selectedCategory || !message.trim()) {
      alert('Please select a category and enter a message');
      return;
    }

    const category = CONTACT_CATEGORIES.find(c => c.id === selectedCategory);
    const adminEmail = getAdminEmail(selectedCategory);
    
    // Use custom subject or default
    const emailSubject = encodeURIComponent(
      subject.trim() || `Contact Form: ${category?.name || 'Inquiry'}`
    );
    
    const body = encodeURIComponent(
      `Category: ${category?.name}\n\n` +
      `From: ${name || 'Not provided'}\n` +
      `Email: ${email || 'Not provided'}\n` +
      `Phone: ${phone || 'Not provided'}\n\n` +
      `Message:\n${message}\n\n` +
      `---\n` +
      `Sent via Contact Form`
    );

    window.location.href = `mailto:${adminEmail}?subject=${emailSubject}&body=${body}`;
  };

  const handleCategorySelect = (categoryId: EmailCategory) => {
    setSelectedCategory(categoryId);
    const category = CONTACT_CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      setMessage(''); // Reset message when changing category
      setSubject(`Contact Form: ${category.name}`); // Set default subject
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="Contact Us"
        description="Get in touch with our team"
        icon={Icons.Settings}
        backLink={{
          href: '/settings',
          label: 'Back to Settings'
        }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Category Selection */}
        <div>
          <h2 className="text-xl font-bold text-neutral-900 mb-4">What can we help you with?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONTACT_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategorySelect(category.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedCategory === category.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-neutral-200 bg-white hover:border-primary-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{category.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-900 mb-1">{category.name}</h3>
                    <p className="text-sm text-neutral-600">{category.description}</p>
                  </div>
                  {selectedCategory === category.id && (
                    <span className="text-primary-500 text-xl">✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Contact Form */}
        {selectedCategory && (
          <Card className="border-2 border-primary-500">
            <CardHeader>
              <CardTitle>
                {CONTACT_CATEGORIES.find(c => c.id === selectedCategory)?.name}
              </CardTitle>
              
              {/* Purpose Blurb */}
              <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong className="block mb-1">About this category:</strong>
                  {CONTACT_CATEGORIES.find(c => c.id === selectedCategory)?.purposeBlurb}
                </p>
              </div>
              
              <p className="text-sm text-neutral-600 mt-3">
                Your message will be sent to our {CONTACT_CATEGORIES.find(c => c.id === selectedCategory)?.name.toLowerCase()} team
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="John Doe"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Your Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="john@example.com"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Provide your email if you'd like a response
                  </p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Your Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="(555) 123-4567"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Provide your phone number for callback
                  </p>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Contact Form: Inquiry"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Customize the email subject line
                  </p>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                    placeholder={CONTACT_CATEGORIES.find(c => c.id === selectedCategory)?.placeholder}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    onClick={handleSendMessage}
                    disabled={!message.trim()}
                    className="flex-1"
                  >
                    Send Message
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedCategory(null);
                      setMessage('');
                      setName('');
                      setEmail('');
                      setPhone('');
                      setSubject('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>

                {/* Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 text-xl">ℹ️</span>
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold mb-1">How it works:</p>
                      <p>
                        Clicking "Send Message" will open your email client with a pre-filled message 
                        to our {CONTACT_CATEGORIES.find(c => c.id === selectedCategory)?.name.toLowerCase()} team. 
                        You can review and edit before sending.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        {!selectedCategory && (
          <Card className="bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <span className="text-4xl mb-4 block">💬</span>
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  We're Here to Help!
                </h3>
                <p className="text-neutral-700 mb-4">
                  Select a category above to get started. Your message will be routed to the right team 
                  for the fastest response.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-4">
                    <div className="font-semibold text-neutral-900 mb-1">📧 Email</div>
                    <div className="text-neutral-600">Routed to the right team</div>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <div className="font-semibold text-neutral-900 mb-1">⚡ Fast Response</div>
                    <div className="text-neutral-600">Usually within 24 hours</div>
                  </div>
                  <div className="bg-white rounded-lg p-4">
                    <div className="font-semibold text-neutral-900 mb-1">🎯 Targeted</div>
                    <div className="text-neutral-600">Reaches the right experts</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
