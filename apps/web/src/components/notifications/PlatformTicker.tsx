"use client";

import { useState, useEffect } from 'react';
import { 
  Alert, 
  Group, 
  Text, 
  ActionIcon, 
  Box,
  ScrollArea,
  useMantineTheme,
  rem,
  Stack
} from '@mantine/core';
import { 
  IconX, 
  IconInfoCircle, 
  IconAlertTriangle, 
  IconCheck, 
  IconBulb,
  IconChevronLeft,
  IconChevronRight
} from '@tabler/icons-react';
import { TickerMessage } from '@/services/TickerConfigService';

interface PlatformTickerProps {
  messages: TickerMessage[];
  tenantId?: string;
  tenantTier?: string;
  maxMessages?: number;
  autoRotate?: boolean;
  rotationInterval?: number;
  onDismiss?: (messageId: string) => void;
}

const iconMap = {
  info: IconInfoCircle,
  warning: IconAlertTriangle,
  success: IconCheck,
  bulb: IconBulb
};

const alertColors = {
  info: 'blue',
  warning: 'yellow',
  success: 'green',
  error: 'red'
};

const scrollSpeeds = {
  slow: 30,
  medium: 20,
  fast: 10
};

export default function PlatformTicker({ 
  messages, 
  tenantId, 
  tenantTier, 
  maxMessages = 3,
  autoRotate = true,
  rotationInterval = 5,
  onDismiss 
}: PlatformTickerProps) {
  const [visibleMessages, setVisibleMessages] = useState<TickerMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedMessages, setDismissedMessages] = useState<Set<string>>(new Set());
  const theme = useMantineTheme();

  // Filter messages for this tenant and sort by priority
  useEffect(() => {
    const now = new Date();
    const activeMessages = messages.filter(message => {
      if (!message.isActive) return false;
      if (dismissedMessages.has(message.id)) return false;
      
      // Check date range
      if (message.startDate && new Date(message.startDate) > now) return false;
      if (message.endDate && new Date(message.endDate) < now) return false;

      // Check audience targeting
      switch (message.targetAudience) {
        case 'all':
          return true;
        case 'specific_tiers':
          return message.targetTiers?.includes(tenantTier || '') || false;
        case 'specific_tenants':
          return message.targetTenants?.includes(tenantId || '') || false;
        default:
          return true;
      }
    });

    // Sort by priority (highest first), then by creation date (newest first)
    activeMessages.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    // Limit to max messages
    setVisibleMessages(activeMessages.slice(0, maxMessages));
    setCurrentIndex(0);
  }, [messages, tenantId, tenantTier, maxMessages, dismissedMessages]);

  // Auto-rotation
  useEffect(() => {
    if (!autoRotate || visibleMessages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleMessages.length);
    }, rotationInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRotate, visibleMessages.length, rotationInterval]);

  const handleDismiss = (messageId: string) => {
    setDismissedMessages(prev => new Set([...prev, messageId]));
    onDismiss?.(messageId);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + visibleMessages.length) % visibleMessages.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % visibleMessages.length);
  };

  if (visibleMessages.length === 0) {
    return null;
  }

  const currentMessage = visibleMessages[currentIndex];
  const IconComponent = iconMap[currentMessage.icon];
  const color = alertColors[currentMessage.type];
  const scrollSpeed = scrollSpeeds[currentMessage.scrolling ? 'medium' : 'slow'];

  const tickerContent = (
    <Alert
      color={color}
      variant="light"
      p="xs"
      styles={{
        root: {
          borderRadius: 0,
          borderBottom: `1px solid ${theme.colors.gray[2]}`,
        },
        icon: {
          marginRight: rem(8),
        }
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="md">
        <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
          {IconComponent && <IconComponent size={16} />}
          
          {currentMessage.scrolling ? (
            <ScrollArea.Autosize mah={30} miw={200}>
              <Text size="sm" fw={500}>
                {currentMessage.message}
              </Text>
            </ScrollArea.Autosize>
          ) : (
            <Text size="sm" fw={500}>
              {currentMessage.message}
            </Text>
          )}
        </Group>
        
        <Group gap="xs">
          {/* Navigation controls for multiple messages */}
          {visibleMessages.length > 1 && (
            <>
              <ActionIcon
                size="sm"
                color={color}
                variant="subtle"
                onClick={handlePrevious}
                title="Previous message"
              >
                <IconChevronLeft size={12} />
              </ActionIcon>
              
              <Text size="xs" c="dimmed" miw={20} ta="center">
                {currentIndex + 1}/{visibleMessages.length}
              </Text>
              
              <ActionIcon
                size="sm"
                color={color}
                variant="subtle"
                onClick={handleNext}
                title="Next message"
              >
                <IconChevronRight size={12} />
              </ActionIcon>
            </>
          )}
          
          {currentMessage.dismissible && (
            <ActionIcon
              size="sm"
              color={color}
              variant="subtle"
              onClick={() => handleDismiss(currentMessage.id)}
              title="Dismiss notification"
            >
              <IconX size={12} />
            </ActionIcon>
          )}
        </Group>
      </Group>
    </Alert>
  );

  // Add scrolling animation if enabled
  if (currentMessage.scrolling) {
    return (
      <Box
        style={{
          overflow: 'hidden',
          position: 'relative',
          background: `linear-gradient(90deg, ${theme.white} 0%, transparent 10%, transparent 90%, ${theme.white} 100%)`,
          zIndex: 1,
        }}
      >
        <Box
          style={{
            animation: `scroll-left ${scrollSpeed}s linear infinite`,
            '&:hover': {
              animationPlayState: 'paused',
            }
          }}
        >
          {tickerContent}
        </Box>
        
        <style jsx>{`
          @keyframes scroll-left {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
      </Box>
    );
  }

  return tickerContent;
}
