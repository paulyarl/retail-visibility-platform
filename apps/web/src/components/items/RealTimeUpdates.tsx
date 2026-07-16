/**
 * Real-Time Updates System with WebSocket Integration
 * 
 * Real-time updates with:
 * - WebSocket-based live updates
 * - Real-time inventory changes
 * - Live stock level updates
 * - Real-time analytics data
 * - Live collaboration indicators
 * - Connection status management
 * - Offline support with sync queue
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Badge, Tooltip, Button } from '@/components/ui';
import { 
  Wifi, 
  WifiOff, 
  Users, 
  Activity, 
  AlertCircle, 
  CheckCircle,
  Eye,
  Package,
  TrendingUp
} from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';

interface RealTimeUpdatesProps {
  tenantId: string;
  onInventoryUpdate: (update: InventoryUpdate) => void;
  onAnalyticsUpdate: (update: AnalyticsUpdate) => void;
  onUserActivity: (activity: UserActivity) => void;
  onConnectionChange: (connected: boolean) => void;
}

interface InventoryUpdate {
  updateType: 'stock_change' | 'price_change' | 'status_change' | 'new_product' | 'deleted_product';
  productId: string;
  productName: string;
  sku: string;
  userId: string;
  userName: string;
  timestamp: string;
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

interface AnalyticsUpdate {
  type: 'view_update' | 'conversion' | 'stock_alert';
  productId?: string;
  productName?: string;
  metric: string;
  value: number;
  change: number;
  timestamp: string;
}

interface UserActivity {
  type: 'user_join' | 'user_leave' | 'product_view' | 'bulk_operation';
  userId: string;
  userName: string;
  action: string;
  details?: any;
  timestamp: string;
}

interface ConnectionStatus {
  connected: boolean;
  lastPing: string;
  latency: number;
  reconnectAttempts: number;
}

interface ActiveUser {
  id: string;
  name: string;
  avatar?: string;
  currentAction: string;
  lastSeen: string;
}

/**
 * Real-Time Updates System with WebSocket integration
 */
export function useRealTimeUpdates({
  tenantId,
  onInventoryUpdate,
  onAnalyticsUpdate,
  onUserActivity,
  onConnectionChange,
}: RealTimeUpdatesProps) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    lastPing: new Date().toISOString(),
    latency: 0,
    reconnectAttempts: 0,
  });
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<(InventoryUpdate | AnalyticsUpdate | UserActivity)[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000'}/ws/inventory/${tenantId}`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[RealTimeUpdates] WebSocket connected');
        setConnectionStatus(prev => ({
          ...prev,
          connected: true,
          reconnectAttempts: 0,
          lastPing: new Date().toISOString(),
        }));
        onConnectionChange(true);
        reconnectAttemptsRef.current = 0;

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const start = Date.now();
            wsRef.current.send(JSON.stringify({ type: 'ping' }));
            
            // Measure latency
            setTimeout(() => {
              const latency = Date.now() - start;
              setConnectionStatus(prev => ({ ...prev, latency }));
            }, 100);
          }
        }, 30000);

        // Process offline queue
        if (offlineQueue.length > 0) {
          console.log(`[RealTimeUpdates] Processing ${offlineQueue.length} queued updates`);
          offlineQueue.forEach(update => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify(update));
            }
          });
          setOfflineQueue([]);
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          clientLogger.error('[RealTimeUpdates] Error parsing WebSocket message:', { detail: error });
        }
      };

      wsRef.current.onclose = () => {
        console.log('[RealTimeUpdates] WebSocket disconnected');
        setConnectionStatus(prev => ({
          ...prev,
          connected: false,
        }));
        onConnectionChange(false);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Attempt reconnection
        attemptReconnect();
      };

      wsRef.current.onerror = (error) => {
        clientLogger.error('[RealTimeUpdates] WebSocket error:', { detail: error });
        setConnectionStatus(prev => ({
          ...prev,
          connected: false,
        }));
      };

    } catch (error) {
      clientLogger.error('[RealTimeUpdates] Failed to connect WebSocket:', { detail: error });
      attemptReconnect();
    }
  }, [tenantId, onConnectionChange, offlineQueue]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'inventory_update':
        onInventoryUpdate(data as InventoryUpdate);
        addRecentUpdate(data);
        break;
      
      case 'analytics_update':
        onAnalyticsUpdate(data as AnalyticsUpdate);
        addRecentUpdate(data);
        break;
      
      case 'user_activity':
        onUserActivity(data as UserActivity);
        handleUserActivityUpdate(data as UserActivity);
        addRecentUpdate(data);
        break;
      
      case 'active_users':
        setActiveUsers(data.users);
        break;
      
      case 'pong':
        // Ping response handled by ping interval
        break;
      
      default:
        console.log('[RealTimeUpdates] Unknown message type:', data.type);
    }
  }, [onInventoryUpdate, onAnalyticsUpdate, onUserActivity]);

  // Handle user activity updates
  const handleUserActivityUpdate = useCallback((activity: UserActivity) => {
    if (activity.type === 'user_join') {
      setActiveUsers(prev => {
        const existing = prev.find(u => u.id === activity.userId);
        if (existing) {
          return prev.map(u => 
            u.id === activity.userId 
              ? { ...u, lastSeen: activity.timestamp, currentAction: activity.action }
              : u
          );
        } else {
          return [...prev, {
            id: activity.userId,
            name: activity.userName,
            currentAction: activity.action,
            lastSeen: activity.timestamp,
          }];
        }
      });
    } else if (activity.type === 'user_leave') {
      setActiveUsers(prev => prev.filter(u => u.id !== activity.userId));
    }
  }, []);

  // Add recent update
  const addRecentUpdate = useCallback((update: any) => {
    setRecentUpdates(prev => [update, ...prev.slice(0, 49)]); // Keep last 50 updates
  }, []);

  // Attempt reconnection
  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= 5) {
      console.log('[RealTimeUpdates] Max reconnection attempts reached');
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);

    console.log(`[RealTimeUpdates] Attempting reconnection ${reconnectAttemptsRef.current}/5 in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      connectWebSocket();
    }, delay);

    setConnectionStatus(prev => ({
      ...prev,
      reconnectAttempts: reconnectAttemptsRef.current,
    }));
  }, [connectWebSocket]);

  // Send message
  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is restored
      setOfflineQueue(prev => [...prev, { ...message, timestamp: new Date().toISOString() }]);
    }
  }, []);

  // Send inventory update
  const sendInventoryUpdate = useCallback((update: Omit<InventoryUpdate, 'timestamp'>) => {
    sendMessage({
      type: 'inventory_update',
      updateType: update.updateType,
      productId: update.productId,
      productName: update.productName,
      sku: update.sku,
      userId: update.userId,
      userName: update.userName,
      changes: update.changes,
      timestamp: new Date().toISOString(),
    });
  }, [sendMessage]);

  // Send user activity
  const sendUserActivity = useCallback((activity: Omit<UserActivity, 'timestamp'>) => {
    sendMessage({
      type: 'user_activity',
      activityType: activity.type,
      userId: activity.userId,
      userName: activity.userName,
      action: activity.action,
      details: activity.details,
      timestamp: new Date().toISOString(),
    });
  }, [sendMessage]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (!connectionStatus.connected) {
        connectWebSocket();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connectionStatus.connected, connectWebSocket]);

  // Initial connection
  useEffect(() => {
    if (tenantId && isOnline) {
      connectWebSocket();
    }

    return () => {
      // Cleanup
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [tenantId, isOnline, connectWebSocket]);

  return {
    connectionStatus,
    activeUsers,
    recentUpdates,
    offlineQueue,
    isOnline,
    sendInventoryUpdate,
    sendUserActivity,
    reconnect: connectWebSocket,
  };
}

/**
 * Real-Time Status Indicator Component
 */
export function RealTimeStatusIndicator({ 
  connectionStatus, 
  activeUsers, 
  recentUpdates 
}: {
  connectionStatus: ConnectionStatus;
  activeUsers: ActiveUser[];
  recentUpdates: any[];
}) {
  const getStatusColor = () => {
    if (!connectionStatus.connected) return 'text-red-500';
    if (connectionStatus.latency > 500) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusText = () => {
    if (!connectionStatus.connected) {
      return connectionStatus.reconnectAttempts > 0 
        ? `Reconnecting... (${connectionStatus.reconnectAttempts}/5)`
        : 'Disconnected';
    }
    return `Connected (${connectionStatus.latency}ms)`;
  };

  return (
    <div className="flex items-center gap-4 text-sm">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        {connectionStatus.connected ? (
          <Wifi className={`w-4 h-4 ${getStatusColor()}`} />
        ) : (
          <WifiOff className="w-4 h-4 text-red-500" />
        )}
        <span className={getStatusColor()}>{getStatusText()}</span>
      </div>

      {/* Active Users */}
      {activeUsers.length > 0 && (
        <Tooltip content={`${activeUsers.length} active users`}>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-blue-500">{activeUsers.length}</span>
          </div>
        </Tooltip>
      )}

      {/* Recent Activity */}
      {recentUpdates.length > 0 && (
        <Tooltip content={`${recentUpdates.length} recent updates`}>
          <div className="flex items-center gap-1">
            <Activity className="w-4 h-4 text-purple-500" />
            <span className="text-purple-500">{recentUpdates.length}</span>
          </div>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * Live Activity Feed Component
 */
export function LiveActivityFeed({ 
  updates, 
  maxItems = 10 
}: { 
  updates: any[];
  maxItems?: number;
}) {
  const getUpdateIcon = (update: any) => {
    switch (update.type) {
      case 'stock_change':
        return <Package className="w-4 h-4 text-orange-500" />;
      case 'price_change':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'view_update':
        return <Eye className="w-4 h-4 text-blue-500" />;
      case 'conversion':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'user_join':
        return <Users className="w-4 h-4 text-purple-500" />;
      case 'stock_alert':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getUpdateText = (update: any) => {
    switch (update.type) {
      case 'stock_change':
        return `${update.userName} updated stock for ${update.productName}`;
      case 'price_change':
        return `${update.userName} changed price for ${update.productName}`;
      case 'view_update':
        return `Product viewed: ${update.productName}`;
      case 'conversion':
        return `Sale: ${update.productName}`;
      case 'user_join':
        return `${update.userName} joined the inventory`;
      case 'stock_alert':
        return `Low stock alert: ${update.productName}`;
      default:
        return 'Unknown activity';
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="space-y-2">
      <h4 className="font-medium text-gray-900 dark:text-white">Live Activity</h4>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {updates.slice(0, maxItems).map((update, index) => (
          <div key={`${update.type}-${update.timestamp}-${index}`} className="flex items-start gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="mt-0.5">
              {getUpdateIcon(update)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-white truncate">
                {getUpdateText(update)}
              </p>
              <p className="text-xs text-gray-500">
                {getTimeAgo(update.timestamp)}
              </p>
            </div>
          </div>
        ))}
        {updates.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No recent activity
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Collaboration Indicators Component
 */
export function CollaborationIndicators({ 
  activeUsers, 
  currentUser 
}: { 
  activeUsers: ActiveUser[];
  currentUser?: string;
}) {
  const otherUsers = activeUsers.filter(u => u.id !== currentUser);

  if (otherUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Also viewing:</span>
      <div className="flex -space-x-2">
        {otherUsers.slice(0, 5).map((user) => (
          <Tooltip key={user.id} content={`${user.name} - ${user.currentAction}`}>
            <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs font-medium border-2 border-white dark:border-gray-800">
              {user.name.charAt(0).toUpperCase()}
            </div>
          </Tooltip>
        ))}
        {otherUsers.length > 5 && (
          <div className="w-8 h-8 bg-gray-500 text-white rounded-full flex items-center justify-center text-xs font-medium border-2 border-white dark:border-gray-800">
            +{otherUsers.length - 5}
          </div>
        )}
      </div>
    </div>
  );
}
