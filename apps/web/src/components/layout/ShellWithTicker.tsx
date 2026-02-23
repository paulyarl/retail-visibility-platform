"use client";

import { useState, useEffect } from 'react';
import { Box } from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/components/tenant/TenantContextProvider';
import { useContext } from 'react';
import PlatformTicker from '@/components/notifications/PlatformTicker';
import { tickerConfigService, TickerMessage } from '@/services/TickerConfigService';

interface ShellWithTickerProps {
  children: React.ReactNode;
  shellHeader: React.ReactNode;
}

export default function ShellWithTicker({ children, shellHeader }: ShellWithTickerProps) {
  const [messages, setMessages] = useState<TickerMessage[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { tenantId } = useTenant();

  useEffect(() => {
    const loadTickerData = async () => {
      try {
        // Load both config and active messages
        const [configResult, messagesResult] = await Promise.all([
          tickerConfigService.getTickerConfig(),
          tickerConfigService.getActiveMessages(tenantId || undefined, user?.tenants?.find(t => t.id === tenantId)?.role)
        ]);
        
        if (configResult.success && configResult.data) {
          setConfig(configResult.data);
        }
        
        if (messagesResult.success && messagesResult.data) {
          setMessages(messagesResult.data);
        }
      } catch (error) {
        console.error('Failed to load ticker data:', error);
      } finally {
        setLoading(false);
      }
    };

    // Only load ticker for authenticated users
    if (user) {
      loadTickerData();
    } else {
      setLoading(false);
    }
  }, [user, tenantId]);

  const handleTickerDismiss = (messageId: string) => {
    // Optional: Track dismissal analytics
    console.log('Ticker message dismissed:', messageId);
    
    // Remove message from local state immediately
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  return (
    <Box>
      {/* Shell Header */}
      {shellHeader}
      
      {/* Platform Ticker - positioned below header */}
      {!loading && config?.enabled && messages.length > 0 && (
        <PlatformTicker
          messages={messages}
          tenantId={tenantId || undefined}
          tenantTier={user?.tenants?.find(t => t.id === tenantId)?.role}
          maxMessages={config.globalSettings?.maxMessages || 3}
          autoRotate={config.globalSettings?.autoRotate !== false}
          rotationInterval={config.globalSettings?.rotationInterval || 5}
          onDismiss={handleTickerDismiss}
        />
      )}
      
      {/* Main Content */}
      {children}
    </Box>
  );
}
