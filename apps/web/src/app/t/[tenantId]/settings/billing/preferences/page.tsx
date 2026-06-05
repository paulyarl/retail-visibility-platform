'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Group, 
  Text, 
  Switch, 
  Select, 
  NumberInput, 
  TextInput, 
  Divider,
  Alert,
  Loader,
  Stack
} from '@mantine/core';
import { 
  IconCreditCard, 
  IconFileDescription, 
  IconBell, 
  IconAlertTriangle,
  IconCheck
} from '@tabler/icons-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';

interface BillingPreferences {
  payments: {
    autoPayEnabled: boolean;
    defaultPaymentMethod: string;
    retryFailedPayments: boolean;
    maxRetries: number;
  };
  statements: {
    deliveryMethod: 'email' | 'both';
    emailRecipients: string[];
    sendMonthlyStatement: boolean;
  };
  riskManagement: {
    enableRiskAlerts: boolean;
    riskAlertThreshold: number;
    preventiveActions: boolean;
  };
}

export default function BillingPreferencesPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { user } = useAuth();
  const [tenantId, setTenantId] = useState<string>('');
  const [preferences, setPreferences] = useState<BillingPreferences>({
    payments: {
      autoPayEnabled: true,
      defaultPaymentMethod: '',
      retryFailedPayments: true,
      maxRetries: 3
    },
    statements: {
      deliveryMethod: 'email',
      emailRecipients: [],
      sendMonthlyStatement: true
    },
    riskManagement: {
      enableRiskAlerts: true,
      riskAlertThreshold: 70,
      preventiveActions: true
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const paymentMethods = [
    { value: 'pm_card_1234567890', label: 'Visa ending in 4242' },
    { value: 'pm_card_0987654321', label: 'Mastercard ending in 8888' },
  ];

  useEffect(() => {
    const resolveTenantId = async () => {
      const resolvedParams = await params;
      setTenantId(resolvedParams.tenantId);
    };
    resolveTenantId();
  }, [params]);

  useEffect(() => {
    if (tenantId) {
      loadPreferences();
    }
  }, [tenantId]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock preferences data - replace with actual API call
      const mockPreferences: BillingPreferences = {
        payments: {
          autoPayEnabled: true,
          defaultPaymentMethod: 'pm_card_1234567890',
          retryFailedPayments: true,
          maxRetries: 3
        },
        statements: {
          deliveryMethod: 'email',
          emailRecipients: ['billing@company.com', 'finance@company.com'],
          sendMonthlyStatement: true
        },
        riskManagement: {
          enableRiskAlerts: true,
          riskAlertThreshold: 70,
          preventiveActions: true
        }
      };
      
      setPreferences(mockPreferences);
    } catch (err) {
      setError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = (category: keyof BillingPreferences, key: string, value: any) => {
    setPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      // Mock API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const addEmailRecipient = () => {
    const newEmail = prompt('Enter email address:');
    if (newEmail && newEmail.includes('@')) {
      updatePreference('statements', 'emailRecipients', [...preferences.statements.emailRecipients, newEmail]);
    }
  };

  const removeEmailRecipient = (email: string) => {
    updatePreference('statements', 'emailRecipients', preferences.statements.emailRecipients.filter(e => e !== email));
  };

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing Preferences"
        description="Manage your billing and payment preferences"
        icon={Icons.Settings}
        backLink={{
          href: `/t/${tenantId}/settings/billing`,
          label: 'Back to Billing'
        }}
        actions={
          <Button
            onClick={savePreferences}
            loading={saving}
            leftSection={<IconCheck className="w-4 h-4" />}
          >
            Save Preferences
          </Button>
        }
      />

      {error && (
        <Alert color="red" icon={<IconAlertTriangle />}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert color="green" icon={<IconCheck />}>
          Preferences saved successfully!
        </Alert>
      )}

      {/* Payment Preferences */}
      <Card>
        <Group mb="md">
          <IconCreditCard className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Payment Preferences</h3>
        </Group>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Text fw={500}>Automatic Payments</Text>
              <Text size="sm" c="dimmed">Automatically pay invoices on due date</Text>
            </div>
            <Switch
              checked={preferences.payments.autoPayEnabled}
              onChange={(e) => updatePreference('payments', 'autoPayEnabled', e.currentTarget.checked)}
            />
          </div>
          
          {preferences.payments.autoPayEnabled && (
            <div>
              <Text fw={500} mb="sm">Default Payment Method</Text>
              <Select
                value={preferences.payments.defaultPaymentMethod}
                onChange={(value) => updatePreference('payments', 'defaultPaymentMethod', value || '')}
                data={paymentMethods}
                placeholder="Select payment method"
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <Text fw={500}>Retry Failed Payments</Text>
              <Text size="sm" c="dimmed">Automatically retry failed payments</Text>
            </div>
            <Switch
              checked={preferences.payments.retryFailedPayments}
              onChange={(e) => updatePreference('payments', 'retryFailedPayments', e.currentTarget.checked)}
            />
          </div>
          
          {preferences.payments.retryFailedPayments && (
            <div>
              <Text fw={500} mb="sm">Maximum Retry Attempts</Text>
              <NumberInput
                value={preferences.payments.maxRetries}
                onChange={(value) => updatePreference('payments', 'maxRetries', value || 1)}
                min={1}
                max={10}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Statement Preferences */}
      <Card>
        <Group mb="md">
          <IconFileDescription className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Statement Preferences</h3>
        </Group>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Text fw={500}>Send Monthly Statements</Text>
              <Text size="sm" c="dimmed">Receive monthly billing statements</Text>
            </div>
            <Switch
              checked={preferences.statements.sendMonthlyStatement}
              onChange={(e) => updatePreference('statements', 'sendMonthlyStatement', e.currentTarget.checked)}
            />
          </div>
          
          {preferences.statements.sendMonthlyStatement && (
            <>
              <div>
                <Text fw={500} mb="sm">Delivery Method</Text>
                <Select
                  value={preferences.statements.deliveryMethod}
                  onChange={(value) => updatePreference('statements', 'deliveryMethod', value as 'email' | 'both')}
                  data={[
                    { value: 'email', label: 'Email Only' },
                    { value: 'both', label: 'Email and Download' }
                  ]}
                />
              </div>
              
              <div>
                <Group justify="space-between" mb="sm">
                  <Text fw={500}>Email Recipients</Text>
                  <Button size="xs" variant="outline" onClick={addEmailRecipient}>
                    Add Email
                  </Button>
                </Group>
                
                <div className="space-y-2">
                  {preferences.statements.emailRecipients.map((email, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <Text size="sm">{email}</Text>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        onClick={() => removeEmailRecipient(email)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Risk Management Preferences */}
      <Card>
        <Group mb="md">
          <IconAlertTriangle className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Risk Management</h3>
        </Group>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Text fw={500}>Enable Risk Alerts</Text>
              <Text size="sm" c="dimmed">Get notified about payment risks</Text>
            </div>
            <Switch
              checked={preferences.riskManagement.enableRiskAlerts}
              onChange={(e) => updatePreference('riskManagement', 'enableRiskAlerts', e.currentTarget.checked)}
            />
          </div>
          
          {preferences.riskManagement.enableRiskAlerts && (
            <div>
              <Text fw={500} mb="sm">Risk Alert Threshold</Text>
              <NumberInput
                value={preferences.riskManagement.riskAlertThreshold}
                onChange={(value) => updatePreference('riskManagement', 'riskAlertThreshold', value || 50)}
                min={1}
                max={100}
                suffix="%"
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div>
              <Text fw={500}>Preventive Actions</Text>
              <Text size="sm" c="dimmed">Automatically take preventive actions for high-risk payments</Text>
            </div>
            <Switch
              checked={preferences.riskManagement.preventiveActions}
              onChange={(e) => updatePreference('riskManagement', 'preventiveActions', e.currentTarget.checked)}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
