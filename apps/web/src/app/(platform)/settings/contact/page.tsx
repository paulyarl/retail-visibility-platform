'use client';

import { useState } from 'react';
import { Card, Button, Title, Text, TextInput, Textarea, Stack, Group, SimpleGrid, Box } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import PageHeader, { Icons } from '@/components/PageHeader';
import { getAdminEmail, type EmailCategory } from '@/lib/admin-emails';

export const dynamic = 'force-dynamic';


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
      notifications.show({ title: 'Missing Information', message: 'Please select a category and enter a message', color: 'yellow' });
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
          <Title order={2} mb="md">What can we help you with?</Title>
          <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="md">
            {CONTACT_CATEGORIES.map((category) => (
              <Card
                key={category.id}
                withBorder
                p="md"
                onClick={() => handleCategorySelect(category.id)}
                style={{
                  cursor: 'pointer',
                  borderColor: selectedCategory === category.id ? 'var(--mantine-color-primary-5)' : undefined,
                  backgroundColor: selectedCategory === category.id ? 'var(--mantine-color-primary-0)' : undefined,
                }}
              >
                <Group gap="sm" align="flex-start" wrap="nowrap">
                  <Text size="xl">{category.icon}</Text>
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Text fw={600}>{category.name}</Text>
                    <Text size="sm" c="dimmed">{category.description}</Text>
                  </Stack>
                  {selectedCategory === category.id && (
                    <Text c="primary" size="xl">✓</Text>
                  )}
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        </div>

        {/* Contact Form */}
        {selectedCategory && (
          <Card withBorder p="lg">
            <Stack gap="md">
              <Title order={3}>
                {CONTACT_CATEGORIES.find(c => c.id === selectedCategory)?.name}
              </Title>
              
              {/* Purpose Blurb */}
              <Box bg="blue.0" p="md" style={{ border: '1px solid var(--mantine-color-blue-2)', borderRadius: 'var(--mantine-radius-md)' }}>
                <Text size="sm" c="blue.9">
                  <Text fw={600} component="span" display="block" mb={4}>About this category:</Text>
                  {CONTACT_CATEGORIES.find(c => c.id === selectedCategory)?.purposeBlurb}
                </Text>
              </Box>
              
              <Text size="sm" c="dimmed">
                Your message will be sent to our {CONTACT_CATEGORIES.find(c => c.id === selectedCategory)?.name.toLowerCase()} team
              </Text>

              {/* Name */}
              <TextInput
                label="Your Name (Optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />

              {/* Email */}
              <div>
                <TextInput
                  label="Your Email (Optional)"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                />
                <Text size="xs" c="dimmed" mt={4}>
                  Provide your email if you'd like a response
                </Text>
              </div>

              {/* Phone */}
              <div>
                <TextInput
                  label="Your Phone Number (Optional)"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
                <Text size="xs" c="dimmed" mt={4}>
                  Provide your phone number for callback
                </Text>
              </div>

              {/* Subject */}
              <div>
                <TextInput
                  label="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Contact Form: Inquiry"
                />
                <Text size="xs" c="dimmed" mt={4}>
                  Customize the email subject line
                </Text>
              </div>

              {/* Message */}
              <Textarea
                label="Message"
                withAsterisk
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                placeholder={CONTACT_CATEGORIES.find(c => c.id === selectedCategory)?.placeholder}
              />

              {/* Actions */}
              <Group gap="sm">
                <Button
                  onClick={handleSendMessage}
                  disabled={!message.trim()}
                  style={{ flex: 1 }}
                >
                  Send Message
                </Button>
                <Button
                  variant="default"
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
              </Group>

              {/* Info */}
              <Box bg="blue.0" p="md" style={{ border: '1px solid var(--mantine-color-blue-2)', borderRadius: 'var(--mantine-radius-md)' }}>
                <Group gap="sm" align="flex-start" wrap="nowrap">
                  <Text size="xl" c="blue.6">ℹ️</Text>
                  <Stack gap={4}>
                    <Text size="sm" fw={600} c="blue.9">How it works:</Text>
                    <Text size="sm" c="blue.9">
                      Clicking "Send Message" will open your email client with a pre-filled message 
                      to our {CONTACT_CATEGORIES.find(c => c.id === selectedCategory)?.name.toLowerCase()} team. 
                      You can review and edit before sending.
                    </Text>
                  </Stack>
                </Group>
              </Box>
            </Stack>
          </Card>
        )}

        {/* Help Section */}
        {!selectedCategory && (
          <Card p="xl" bg="primary.0" withBorder style={{ borderColor: 'var(--mantine-color-primary-2)' }}>
            <Stack align="center" gap="md">
              <Text size="xl">💬</Text>
              <Title order={3}>
                We're Here to Help!
              </Title>
              <Text c="dimmed" ta="center" maw={500}>
                Select a category above to get started. Your message will be routed to the right team 
                for the fastest response.
              </Text>
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" w="100%">
                <Card withBorder p="md" bg="white">
                  <Text fw={600} mb={4}>📧 Email</Text>
                  <Text size="sm" c="dimmed">Routed to the right team</Text>
                </Card>
                <Card withBorder p="md" bg="white">
                  <Text fw={600} mb={4}>⚡ Fast Response</Text>
                  <Text size="sm" c="dimmed">Usually within 24 hours</Text>
                </Card>
                <Card withBorder p="md" bg="white">
                  <Text fw={600} mb={4}>🎯 Targeted</Text>
                  <Text size="sm" c="dimmed">Reaches the right experts</Text>
                </Card>
              </SimpleGrid>
            </Stack>
          </Card>
        )}

      </div>
    </div>
  );
}
