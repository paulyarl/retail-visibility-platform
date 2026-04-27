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
import { useTenantNotifications } from '@/services/TenantNotificationService';

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
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const resolveTenantId = async () => {
      const resolvedParams = await params;
      setTenantId(resolvedParams.tenantId);
    };
    resolveTenantId();
  }, [params]);

  const {
    notifications,
    unreadCount,
    loading,
    error,
    pagination,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications
  } = useTenantNotifications(tenantId);

  useEffect(() => {
    if (tenantId) {
      loadNotifications({ page: 1, limit: 20 });
    }
  }, [tenantId]);

  const handleNotificationClick = (notification: any) => {
    setSelectedNotification(notification);
    setShowNotificationModal(true);
    
    // Mark as read if unread
    if (!notification.read) {
      markAsRead(notification.id);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    await deleteNotification(notificationId);
    setShowNotificationModal(false);
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

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
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

  if (!tenantId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader size="lg" />
      </div>
    );
  }

  if (loading && notifications.length === 0) {
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
                disabled={loading}
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
                        <Text size="xs" c="dimmed">{formatDate(notification.created_at)}</Text>
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
                    
                    {notification.action_url && (
                      <div className="mt-3">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (notification.action_url) {
                              router.push(notification.action_url);
                            }
                          }}
                        >
                          {notification.action_text}
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
                  {selectedNotification.metadata?.due_date && (
                    <div className="flex justify-between">
                      <span>Due Date:</span>
                      <span>{formatDate(selectedNotification.metadata.due_date)}</span>
                    </div>
                  )}
                  {selectedNotification.metadata?.risk_score && (
                    <div className="flex justify-between">
                      <span>Risk Score:</span>
                      <span>{selectedNotification.metadata.risk_score}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-center pt-4 border-t">
              <Text size="sm" c="dimmed">
                {formatDate(selectedNotification.created_at)}
              </Text>
              
              <div className="flex gap-2">
                {selectedNotification.action_url && (
                  <Button
                    onClick={() => {
                      setShowNotificationModal(false);
                      router.push(selectedNotification.action_url);
                    }}
                  >
                    {selectedNotification.action_text}
                  </Button>
                )}
                <Button
                  variant="outline"
                  color="red"
                  size="sm"
                  onClick={() => handleDeleteNotification(selectedNotification.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
