"use client";

import { useState, useEffect } from 'react';
import { Box } from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/components/tenant/TenantContextProvider';
import { useContext } from 'react';
import PlatformTicker from '@/components/notifications/PlatformTicker';
import { tickerConfigService, TickerMessage } from '@/services/TickerConfigService';
import TickerFallbackService from '@/services/TickerFallbackService';
import { useQuery } from '@tanstack/react-query';

interface ShellWithTickerProps {
  children: React.ReactNode;
  shellHeader: React.ReactNode;
}

export default function ShellWithTicker({ children, shellHeader }: ShellWithTickerProps) {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const [hasLoaded, setHasLoaded] = useState(false);

  // Check if we're on a page that should show ticker
  const shouldShowTicker = user; // Show on all pages for testing
  // const shouldShowTicker = user && 
  //   !window.location.pathname.includes('/settings/admin') &&
  //   !window.location.pathname.includes('/admin/');

  // Use React Query for ticker config with fallback
  const { data: config, isLoading: configLoading, error: configError } = useQuery({
    queryKey: ['ticker-config'],
    queryFn: async () => {
      try {
        const result = await tickerConfigService.getTickerConfig();
        
        // Save successful config to fallback
        if (result.success && result.data) {
          const actualConfig = (result.data as any)?.data;
          if (actualConfig) {
            TickerFallbackService.saveFallbackConfig(actualConfig);
          }
        }
        
        return result;
      } catch (error) {
        console.warn('[ShellWithTicker] Config API failed, using fallback:', error);
        // Return fallback config
        const fallbackConfig = TickerFallbackService.getFallbackConfig();
        return { success: true, data: { data: fallbackConfig } };
      }
    },
    enabled: Boolean(shouldShowTicker),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1, // Only retry once to avoid long delays
  });

  // Use React Query for active messages with fallback
  const { data: messagesData, isLoading: messagesLoading, error: messagesError } = useQuery({
    queryKey: ['ticker-messages', tenantId, user?.tenants?.find(t => t.id === tenantId)?.role],
    queryFn: async () => {
      try {
        const result = await tickerConfigService.getActiveMessages(
          tenantId || undefined, 
          user?.tenants?.find(t => t.id === tenantId)?.role
        );
        
        // Save successful messages to fallback
        if (result.success && result.data) {
          const actualMessages = (result.data as any)?.data || result.data;
          if (actualMessages && Array.isArray(actualMessages)) {
            TickerFallbackService.saveFallbackData(null, actualMessages);
          }
        }
        
        return result;
      } catch (error) {
        console.warn('[ShellWithTicker] Messages API failed, using fallback:', error);
        // Return fallback messages
        const fallbackData = TickerFallbackService.getCombinedFallbackData();
        return { success: true, data: { data: fallbackData.messages } };
      }
    },
    enabled: Boolean(shouldShowTicker && user),
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Only retry once to avoid long delays
  });

  // Check if we're using fallback data
  const isUsingFallback = Boolean(configError || messagesError);
  const fallbackData = isUsingFallback ? TickerFallbackService.getCombinedFallbackData() : null;

  const messages = (messagesData as any)?.data?.data || fallbackData?.messages || [];
  const loading = configLoading || messagesLoading;

  // Extract the actual ticker config from nested response
  const actualConfig = (config as any)?.data?.data || fallbackData?.config;

  // Load ticker immediately when enabled
  const TICKER_DELAY_MS = 0; // No delay - show ticker immediately
  
  useEffect(() => {
    if (!shouldShowTicker || hasLoaded) return;

    const timer = setTimeout(() => {
      // console.log(`[ShellWithTicker] Delayed loading ticker data after ${TICKER_DELAY_MS / 1000} seconds`);
      setHasLoaded(true);
    }, TICKER_DELAY_MS);

    return () => clearTimeout(timer);
  }, [shouldShowTicker, hasLoaded]);

  const handleTickerDismiss = (messageId: string) => {
    // Optional: Track dismissal analytics
    // console.log('Ticker message dismissed:', messageId);
    
    // Note: With React Query, we'd typically invalidate the query
    // For now, this is handled locally in the PlatformTicker component
  };

  return (
    <Box>
      {/* Shell Header */}
      {shellHeader}
      
      {/* Platform Ticker - positioned below header */}
      {!loading && actualConfig?.enabled && messages.length > 0 && (
        <Box pos="relative">
          {/* Emergency mode indicator */}
          {fallbackData?.isEmergencyMode && (
            <Box 
              pos="absolute" 
              top="-8px" 
              right="8px" 
              bg="red" 
              c="white" 
              px="8px" 
              py="2px" 
              fz="10px" 
              fw="bold"
              style={{ zIndex: 1000, borderRadius: '4px' }}
            >
              EMERGENCY
            </Box>
          )}
          <PlatformTicker
            messages={messages}
            tenantId={tenantId || undefined}
            tenantTier={user?.tenants?.find(t => t.id === tenantId)?.role}
            maxMessages={actualConfig?.globalSettings?.maxMessages || 3}
            autoRotate={actualConfig?.globalSettings?.autoRotate !== false}
            rotationInterval={actualConfig?.globalSettings?.rotationInterval || 5}
            onDismiss={handleTickerDismiss}
          />
        </Box>
      )}
      
      {/* Main Content */}
      {children}
    </Box>
  );
}
