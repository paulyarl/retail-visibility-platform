'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';
import Protected from '@/components/Protected';

interface EmailCategory {
  id: string;
  name: string;
  description: string;
  defaultEmail: string;
  icon: string;
  color: string;
  examples: string[];
}

const EMAIL_CATEGORIES: EmailCategory[] = [
  {
    id: 'subscription',
    name: 'Subscription Requests',
    description: 'Upgrade, downgrade, and plan change requests from tenants',
    defaultEmail: 'subscriptions@yourplatform.com',
    icon: '💳',
    color: 'bg-blue-100 text-blue-800',
    examples: [
      'Plan upgrade requests',
      'Plan downgrade requests',
      'Subscription cancellations',
      'Billing inquiries',
    ],
  },
  {
    id: 'sales',
    name: 'Sales Inquiries',
    description: 'New customer inquiries and demo requests',
    defaultEmail: 'sales@yourplatform.com',
    icon: '💼',
    color: 'bg-green-100 text-green-800',
    examples: [
      'New customer sign-ups',
      'Demo requests',
      'Pricing questions',
      'Enterprise inquiries',
    ],
  },
  {
    id: 'support',
    name: 'Customer Support',
    description: 'Technical support and customer service requests',
    defaultEmail: 'support@yourplatform.com',
    icon: '🛟',
    color: 'bg-purple-100 text-purple-800',
    examples: [
      'Technical issues',
      'How-to questions',
      'Bug reports',
      'Feature requests',
    ],
  },
  {
    id: 'managed_services',
    name: 'Managed Services',
    description: 'Data entry, catalog management, and white-glove service requests',
    defaultEmail: 'services@yourplatform.com',
    icon: '🤝',
    color: 'bg-amber-100 text-amber-800',
    examples: [
      'Managed service sign-ups',
      'Data entry requests',
      'Catalog updates',
      'Photo optimization',
    ],
  },
  {
    id: 'partnerships',
    name: 'Partnerships & Integrations',
    description: 'Partnership proposals and integration requests',
    defaultEmail: 'partnerships@yourplatform.com',
    icon: '🤝',
    color: 'bg-indigo-100 text-indigo-800',
    examples: [
      'Partnership proposals',
      'Integration requests',
      'API access requests',
      'White-label inquiries',
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing & Media',
    description: 'Press inquiries, marketing campaigns, and promotional requests',
    defaultEmail: 'marketing@yourplatform.com',
    icon: '📢',
    color: 'bg-pink-100 text-pink-800',
    examples: [
      'Press inquiries',
      'Case study requests',
      'Testimonial requests',
      'Marketing campaigns',
    ],
  },
  {
    id: 'compliance',
    name: 'Compliance & Legal',
    description: 'Legal notices, compliance issues, and data requests',
    defaultEmail: 'legal@yourplatform.com',
    icon: '⚖️',
    color: 'bg-red-100 text-red-800',
    examples: [
      'GDPR requests',
      'Data deletion requests',
      'Legal notices',
      'Terms violations',
    ],
  },
  {
    id: 'general',
    name: 'General Inquiries',
    description: 'Catch-all for other types of requests',
    defaultEmail: 'info@yourplatform.com',
    icon: '📧',
    color: 'bg-neutral-100 text-neutral-800',
    examples: [
      'General questions',
      'Feedback',
      'Suggestions',
      'Other inquiries',
    ],
  },
];

export default function AdminEmailsPage() {
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [tempEmail, setTempEmail] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load emails from database via API
    const loadEmails = async () => {
      try {
        const response = await fetch('/api/admin/email-config');
        if (response.ok) {
          const configs = await response.json();
          const emailMap: Record<string, string> = {};
          configs.forEach((config: { category: string; email: string }) => {
            emailMap[config.category] = config.email;
          });
          
          // Fill in defaults for any missing categories
          EMAIL_CATEGORIES.forEach(cat => {
            if (!emailMap[cat.id]) {
              emailMap[cat.id] = cat.defaultEmail;
            }
          });
          
          setEmails(emailMap);
        } else {
          // Initialize with defaults if API fails
          const defaults: Record<string, string> = {};
          EMAIL_CATEGORIES.forEach(cat => {
            defaults[cat.id] = cat.defaultEmail;
          });
          setEmails(defaults);
        }
      } catch (error) {
        console.error('Failed to load email config:', error);
        // Initialize with defaults on error
        const defaults: Record<string, string> = {};
        EMAIL_CATEGORIES.forEach(cat => {
          defaults[cat.id] = cat.defaultEmail;
        });
        setEmails(defaults);
      }
    };
    
    loadEmails();
  }, []);

  const handleEdit = (categoryId: string) => {
    setEditingCategory(categoryId);
    setTempEmail(emails[categoryId] || EMAIL_CATEGORIES.find(c => c.id === categoryId)?.defaultEmail || '');
  };

  const handleSave = async (categoryId: string) => {
    try {
      const newEmails = { ...emails, [categoryId]: tempEmail };
      
      // Save to database via API
      const response = await fetch('/api/admin/email-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configs: [{ category: categoryId, email: tempEmail }]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save email configuration');
      }

      setEmails(newEmails);
      setEditingCategory(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save email:', error);
      alert('Failed to save email configuration. Please try again.');
    }
  };

  const handleCancel = () => {
    setEditingCategory(null);
    setTempEmail('');
  };

  const handleReset = async (categoryId: string) => {
    const category = EMAIL_CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      try {
        const newEmails = { ...emails, [categoryId]: category.defaultEmail };
        
        // Save to database via API
        const response = await fetch('/api/admin/email-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            configs: [{ category: categoryId, email: category.defaultEmail }]
          })
        });

        if (!response.ok) {
          throw new Error('Failed to reset email configuration');
        }

        setEmails(newEmails);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (error) {
        console.error('Failed to reset email:', error);
        alert('Failed to reset email configuration. Please try again.');
      }
    }
  };

  const handleResetAll = async () => {
    if (confirm('Reset all email addresses to defaults?')) {
      try {
        const defaults: Record<string, string> = {};
        const configs = EMAIL_CATEGORIES.map(cat => {
          defaults[cat.id] = cat.defaultEmail;
          return { category: cat.id, email: cat.defaultEmail };
        });

        // Save all to database via API
        const response = await fetch('/api/admin/email-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ configs })
        });

        if (!response.ok) {
          throw new Error('Failed to reset all email configurations');
        }

        setEmails(defaults);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (error) {
        console.error('Failed to reset all emails:', error);
        alert('Failed to reset email configurations. Please try again.');
      }
    }
  };

  return (
    <Protected>
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Email Management"
          description="Configure email addresses for different types of requests"
          icon={Icons.Settings}
          backLink={{
            href: '/settings/admin',
            label: 'Back to Admin Dashboard'
          }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          
          {/* Success Message */}
          {saved && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800">
                <span className="text-xl">✓</span>
                <span className="font-semibold">Email addresses saved successfully!</span>
              </div>
            </div>
          )}

          {/* Info Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">ℹ️</span>
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-2">About Email Management</h3>
                  <p className="text-sm text-neutral-700 mb-2">
                    Configure different email addresses for various types of requests. When tenants or visitors 
                    submit requests through the platform, emails will be sent to the appropriate address based on 
                    the request type.
                  </p>
                  <p className="text-sm text-neutral-700">
                    <strong>Note:</strong> Email configurations are stored in the database and synchronized across 
                    all devices. Changes made here will be immediately available to all administrators.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reset All Button */}
          <div className="flex justify-end">
            <Button variant="secondary" onClick={handleResetAll}>
              Reset All to Defaults
            </Button>
          </div>

          {/* Email Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {EMAIL_CATEGORIES.map((category) => {
              const isEditing = editingCategory === category.id;
              const currentEmail = emails[category.id] || category.defaultEmail;

              return (
                <Card key={category.id} className="border-2 border-neutral-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl">{category.icon}</span>
                        <div>
                          <CardTitle className="text-lg">{category.name}</CardTitle>
                          <p className="text-sm text-neutral-600 mt-1">{category.description}</p>
                        </div>
                      </div>
                      <Badge className={category.color}>{category.id}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Email Input */}
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Email Address
                        </label>
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              type="email"
                              value={tempEmail}
                              onChange={(e) => setTempEmail(e.target.value)}
                              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              placeholder={category.defaultEmail}
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleSave(category.id)}
                              >
                                Save
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleCancel}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between bg-neutral-50 px-3 py-2 rounded-lg border border-neutral-200">
                            <span className="text-sm font-mono text-neutral-900">{currentEmail}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEdit(category.id)}
                                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                              >
                                Edit
                              </button>
                              {currentEmail !== category.defaultEmail && (
                                <button
                                  onClick={() => handleReset(category.id)}
                                  className="text-neutral-600 hover:text-neutral-700 text-sm font-medium"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Examples */}
                      <div>
                        <h4 className="text-sm font-semibold text-neutral-900 mb-2">Request Types:</h4>
                        <ul className="space-y-1">
                          {category.examples.map((example, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-neutral-700">
                              <span className="text-neutral-400 mt-0.5">•</span>
                              <span>{example}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Export/Import Section */}
          <Card>
            <CardHeader>
              <CardTitle>Export / Import Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-neutral-600">
                  Export your email configuration to share across devices or team members, or import a saved configuration.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const config = JSON.stringify(emails, null, 2);
                      const blob = new Blob([config], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'admin-emails-config.json';
                      a.click();
                    }}
                  >
                    Export Configuration
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'application/json';
                      input.onchange = async (e: any) => {
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = async (event: any) => {
                          try {
                            const config = JSON.parse(event.target.result);
                            
                            // Convert to API format
                            const configs = Object.entries(config).map(([category, email]) => ({
                              category,
                              email: email as string
                            }));

                            // Save to database via API
                            const response = await fetch('/api/admin/email-config', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ configs })
                            });

                            if (!response.ok) {
                              throw new Error('Failed to import configuration');
                            }

                            setEmails(config);
                            setSaved(true);
                            setTimeout(() => setSaved(false), 3000);
                          } catch (error) {
                            console.error('Failed to import config:', error);
                            alert('Invalid configuration file or failed to save');
                          }
                        };
                        reader.readAsText(file);
                      };
                      input.click();
                    }}
                  >
                    Import Configuration
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </Protected>
  );
}
