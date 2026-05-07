/**
 * Real-Time Stock Indicator with Mantine UI
 * 
 * Displays real-time stock status with notifications and urgency indicators
 * Uses WebSocket or polling for live updates
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Badge,
  Progress,
  Text,
  Group,
  Stack,
  Alert,
  Tooltip,
  ActionIcon,
  Modal,
  Button,
  NumberInput,
  TextInput
} from '@mantine/core';
import {
  IconPackage,
  IconAlertTriangle,
  IconClock,
  IconBell,
  IconBellOff,
  IconX
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface StockData {
  current: number;
  threshold: number;
  max: number;
  lastUpdated: Date;
  isRestocking: boolean;
  estimatedRestockDate?: Date;
}

interface RealTimeStockIndicatorProps {
  productId: string;
  initialStock: StockData;
  onStockChange?: (stock: StockData) => void;
  className?: string;
}

const RealTimeStockIndicator: React.FC<RealTimeStockIndicatorProps> = ({
  productId,
  initialStock,
  onStockChange,
  className = ''
}) => {
  const [stockData, setStockData] = useState<StockData>(initialStock);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [backInStockModalOpen, setBackInStockModalOpen] = useState(false);
  const [emailForNotification, setEmailForNotification] = useState('');

  // Simulate real-time stock updates
  useEffect(() => {
    const interval = setInterval(() => {
      // In production, this would be a WebSocket connection or API call
      const randomChange = Math.random() > 0.8 ? Math.floor(Math.random() * 5) - 2 : 0;
      const newStock = Math.max(0, Math.min(stockData.max, stockData.current + randomChange));
      
      const updatedStock: StockData = {
        ...stockData,
        current: newStock,
        lastUpdated: new Date()
      };

      setStockData(updatedStock);
      onStockChange?.(updatedStock);

      // Show notification for significant changes
      if (notificationsEnabled && Math.abs(randomChange) > 0) {
        if (newStock === 0 && stockData.current > 0) {
          notifications.show({
            title: 'Out of Stock!',
            message: `${productId} is now out of stock`,
            color: 'red',
            icon: <IconAlertTriangle />,
          });
        } else if (newStock > 0 && stockData.current === 0) {
          notifications.show({
            title: 'Back in Stock!',
            message: `${productId} is available again`,
            color: 'green',
            icon: <IconPackage />,
          });
        }
      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [stockData, productId, notificationsEnabled, onStockChange]);

  const getStockStatus = () => {
    const percentage = (stockData.current / stockData.max) * 100;
    
    if (stockData.current === 0) {
      return { status: 'out_of_stock', color: 'red', label: 'Out of Stock', urgency: 'high' };
    } else if (percentage <= 10) {
      return { status: 'critical', color: 'orange', label: 'Only a few left!', urgency: 'high' };
    } else if (percentage <= 25) {
      return { status: 'low', color: 'yellow', label: 'Low Stock', urgency: 'medium' };
    } else if (percentage <= 50) {
      return { status: 'moderate', color: 'blue', label: 'In Stock', urgency: 'low' };
    } else {
      return { status: 'high', color: 'green', label: 'Plenty Available', urgency: 'low' };
    }
  };

  const stockStatus = getStockStatus();
  const stockPercentage = (stockData.current / stockData.max) * 100;

  const handleBackInStockNotification = () => {
    // In production, this would call an API to register for notifications
    notifications.show({
      title: 'Notification Registered',
      message: `We'll notify you at ${emailForNotification} when ${productId} is back in stock`,
      color: 'blue',
    });
    setBackInStockModalOpen(false);
    setEmailForNotification('');
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Stock Status */}
      <Group justify="space-between" align="center">
        <Group>
          <IconPackage className="w-5 h-5" color={stockStatus.color} />
          <Text fw={500} size="lg">
            {stockStatus.label}
          </Text>
          <Badge 
            color={stockStatus.color} 
            variant="filled"
            size="sm"
          >
            {stockData.current} units
          </Badge>
        </Group>
        
        <Group>
          <Tooltip label="Toggle stock notifications">
            <ActionIcon
              variant="light"
              color={notificationsEnabled ? 'blue' : 'gray'}
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            >
              {notificationsEnabled ? <IconBell /> : <IconBellOff />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Stock Progress Bar */}
      <div className="space-y-2">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">Stock Level</Text>
          <Text size="sm" c="dimmed">{Math.round(stockPercentage)}%</Text>
        </Group>
        <Progress
          value={stockPercentage}
          color={stockStatus.color}
          size="md"
          striped={stockStatus.urgency === 'high'}
          animated={stockStatus.urgency === 'high'}
        />
      </div>

      {/* Urgency Indicators */}
      {stockStatus.urgency === 'high' && (
        <Alert
          icon={stockData.current === 0 ? <IconAlertTriangle /> : <IconClock />}
          color={stockStatus.color}
          title={stockData.current === 0 ? 'Out of Stock' : 'Limited Stock'}
        >
          {stockData.current === 0 ? (
            <Stack gap="xs">
              <Text size="sm">
                This item is currently out of stock. Get notified when it becomes available.
              </Text>
              <Button
                size="sm"
                onClick={() => setBackInStockModalOpen(true)}
                fullWidth
              >
                Notify When Available
              </Button>
            </Stack>
          ) : (
            <Text size="sm">
              Only {stockData.current} units left! Order soon to avoid disappointment.
            </Text>
          )}
        </Alert>
      )}

      {/* Restocking Information */}
      {stockData.isRestocking && stockData.estimatedRestockDate && (
        <Alert icon={<IconClock />} color="blue" title="Restocking Soon">
          <Text size="sm">
            Expected restock date: {stockData.estimatedRestockDate.toLocaleDateString()}
          </Text>
        </Alert>
      )}

      {/* Last Updated */}
      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          Last updated: {stockData.lastUpdated.toLocaleTimeString()}
        </Text>
        {stockData.current > 0 && (
          <Text size="xs" c="dimmed">
            Max capacity: {stockData.max} units
          </Text>
        )}
      </Group>

      {/* Back in Stock Notification Modal */}
      <Modal
        opened={backInStockModalOpen}
        onClose={() => setBackInStockModalOpen(false)}
        title="Get Notified When Back in Stock"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Enter your email address and we'll notify you as soon as {productId} is back in stock.
          </Text>
          
          <TextInput
            placeholder="Enter your email"
            value={emailForNotification}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmailForNotification(event.target.value)}
            type="email"
            required
          />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="outline"
              onClick={() => setBackInStockModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBackInStockNotification}
              disabled={!emailForNotification}
            >
              Notify Me
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
};

export default RealTimeStockIndicator;
