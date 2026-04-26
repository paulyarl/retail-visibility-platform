'use client';

import { useState, useEffect } from 'react';
import { Card, Badge, Button, Group, Text, Stack, Alert, Loader, Timeline, Divider, Modal } from '@mantine/core';
import { 
  IconBell, 
  IconCheck, 
  IconX, 
  IconAlertTriangle,
  IconClock,
  IconCreditCard,
  IconFileInvoice,
  IconTrendingUp,
  IconEye,
  IconTrash
} from '@tabler/icons-react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface BillingNotification {
  id: string;
  type: 'payment_reminder' | 'payment_failed' | 'new_invoice' | 'monthly_statement' | 'risk_alert' | 'payment_success';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  createdAt: Date;
  read: boolean;
  actionUrl?: string;
  actionText?: string;
  metadata?: {
    amount?: number;
    dueDate?: Date;
    invoiceId?: string;
    riskScore?: number;
  };
}

export default function BillingNotificationsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('');
  const [notifications, setNotifications] = useState<BillingNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<BillingNotification | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const resolveTenantId = async () => {
      const resolvedParams = await params;
      setTenantId(resolvedParams.tenantId);
    };
    resolveTenantId();
  }, [params]);

  useEffect(() => {
    if (tenantId) {
      loadNotifications();
    }
  }, [tenantId]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock notifications data - replace with actual API call
      const mockNotifications: BillingNotification[] = [
        {
          id: '1',
          type: 'payment_reminder',
          title: 'Payment Due Soon',
          message: 'Your monthly subscription payment of $59.00 is due in 3 days',
          severity: 'warning',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          read: false,
          actionUrl: `/t/${tenantId}/settings/billing/payment-methods`,
          actionText: 'Update Payment Method',
          metadata: {
            amount: 5900,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          }
        },
        {
          id: '2',
          type: 'new_invoice',
          title: 'New Invoice Available',
          message: 'Your monthly invoice for June 2024 is now available',
          severity: 'info',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          read: false,
          actionUrl: `/t/${tenantId}/settings/billing/invoices`,
          actionText: 'View Invoice',
          metadata: {
            amount: 5900,
            invoiceId: 'inv_123456'
          }
        },
        {
          id: '3',
          type: 'payment_success',
          title: 'Payment Successful',
          message: 'Your monthly subscription payment of $59.00 has been processed successfully',
          severity: 'success',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          read: true,
          metadata: {
            amount: 5900
          }
        },
        {
          id: '4',
          type: 'risk_alert',
          title: 'Payment Method Expiring Soon',
          message: 'Your credit card ending in 4242 expires on 12/2024',
          severity: 'warning',
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          read: true,
          actionUrl: `/t/${tenantId}/settings/billing/payment-methods`,
          actionText: 'Update Card',
          metadata: {
            riskScore: 65
          }
        }
      ];
      
      setNotifications(mockNotifications);
    } catch (err) {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (notification: BillingNotification) => {
    setSelectedNotification(notification);
    setShowNotificationModal(true);
    
    // Mark as read if unread
    if (!notification.read) {
      setNotifications(prev => 
        prev.map(n => 
          n.id === notification.id ? { ...n, read: true } : n
        )
      );
    }
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'payment_reminder':
        return <IconClock className="w-5 h-5" />;
      case 'payment_failed':
        return <IconX className="w-5 h-5" />;
      case 'new_invoice':
        return <IconFileInvoice className="w-5 h-5" />;
      case 'monthly_statement':
        return <IconFileInvoice className="w-5 h-5" />;
      case 'risk_alert':
        return <IconAlertTriangle className="w-5 h-5" />;
      case 'payment_success':
        return <IconCheck className="w-5 h-5" />;
      default:
        return <IconBell className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'success':
        return 'text-green-500';
      case 'info':
      default:
        return 'text-blue-500';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <IconX className="w-5 h-5" />;
      case 'warning':
        return <IconAlertTriangle className="w-5 h-5" />;
      case 'success':
        return <IconCheck className="w-5 h-5" />;
      case 'info':
      default:
        return <IconBell className="w-5 h-5" />;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

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

  if (error) {
    return (
      <div className="p-6">
        <Alert color="red" icon={<IconAlertTriangle />}>
          {error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing Notifications"
        description={`You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        icon={Icons.Bell}
        backLink={{
          href: `/t/${tenantId}/settings/billing`,
          label: 'Back to Billing'
        }}
      />

      {/* Notification Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <Text size="xs" c="dimmed">Total</Text>
            <Text size="lg" fw={500}>{notifications.length}</Text>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <Text size="xs" c="dimmed">Unread</Text>
            <Text size="lg" fw={500} c="blue">{unreadCount}</Text>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <Text size="xs" c="dimmed">Warnings</Text>
            <Text size="lg" fw={500} c="yellow">
              {notifications.filter(n => n.severity === 'warning').length}
            </Text>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <Text size="xs" c="dimmed">Errors</Text>
            <Text size="lg" fw={500} c="red">
              {notifications.filter(n => n.severity === 'error').length}
            </Text>
          </div>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <Group justify="space-between">
          <Group>
            <Button
              variant={filter === 'all' ? 'filled' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All ({notifications.length})
            </Button>
            <Button
              variant={filter === 'unread' ? 'filled' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              Unread ({unreadCount})
            </Button>
            <Button
              variant={filter === 'read' ? 'filled' : 'outline'}
              size="sm"
              onClick={() => setFilter('read')}
            >
              Read ({notifications.filter(n => n.read).length})
            </Button>
          </Group>
          
          <Group>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
              >
                Mark All as Read
              </Button>
            )}
          </Group>
        </Group>
      </Card>

      {/* Notifications List */}
      <Card>
        <div className="space-y-2">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-8">
              <IconBell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Notifications</h3>
              <p className="text-gray-600">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications found'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  !notification.read ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                } hover:bg-gray-50`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 ${getSeverityColor(notification.severity)}`}>
                    {getTypeIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Text fw={500} size="sm">{notification.title}</Text>
                          {!notification.read && (
                            <Badge size="xs" color="blue">New</Badge>
                          )}
                        </div>
                        <Text size="sm" c="dimmed" mb="sm">{notification.message}</Text>
                        <Text size="xs" c="dimmed">{formatDate(notification.createdAt)}</Text>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge 
                          size="xs" 
                          color={notification.severity === 'error' ? 'red' : 
                                 notification.severity === 'warning' ? 'yellow' : 
                                 notification.severity === 'success' ? 'green' : 'blue'}
                          variant="light"
                        >
                          {notification.severity}
                        </Badge>
                      </div>
                    </div>
                    
                    {notification.actionUrl && (
                      <div className="mt-3">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(notification.actionUrl!);
                          }}
                        >
                          {notification.actionText}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Notification Detail Modal */}
      <Modal
        opened={showNotificationModal}
        onClose={() => setShowNotificationModal(false)}
        title={selectedNotification?.title}
        size="md"
      >
        {selectedNotification && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={getSeverityColor(selectedNotification.severity)}>
                {getSeverityIcon(selectedNotification.severity)}
              </div>
              <Badge color={getSeverityColor(selectedNotification.severity)} variant="light">
                {selectedNotification.severity.toUpperCase()}
              </Badge>
            </div>
            
            <Text>{selectedNotification.message}</Text>
            
            {selectedNotification.metadata && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <Text size="sm" fw={500} mb="2">Details</Text>
                <div className="space-y-1 text-sm">
                  {selectedNotification.metadata.amount && (
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span>{formatCurrency(selectedNotification.metadata.amount)}</span>
                    </div>
                  )}
                  {selectedNotification.metadata.dueDate && (
                    <div className="flex justify-between">
                      <span>Due Date:</span>
                      <span>{formatDate(selectedNotification.metadata.dueDate)}</span>
                    </div>
                  )}
                  {selectedNotification.metadata.riskScore && (
                    <div className="flex justify-between">
                      <span>Risk Score:</span>
                      <span>{selectedNotification.metadata.riskScore}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-center pt-4 border-t">
              <Text size="sm" c="dimmed">
                {formatDate(selectedNotification.createdAt)}
              </Text>
              
              {selectedNotification.actionUrl && (
                <Button
                  onClick={() => {
                    setShowNotificationModal(false);
                    router.push(selectedNotification.actionUrl!);
                  }}
                >
                  {selectedNotification.actionText}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
