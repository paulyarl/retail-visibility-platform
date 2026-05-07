"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface GlobalAlert {
  id: string;
  type: 'rate_limit' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  persistent?: boolean; // If true, requires manual dismissal
  autoHideMs?: number; // Auto-hide after this many milliseconds
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface GlobalAlertContextType {
  alerts: GlobalAlert[];
  addAlert: (alert: Omit<GlobalAlert, 'id'>) => string;
  removeAlert: (id: string) => void;
  clearAlerts: () => void;
}

const GlobalAlertContext = createContext<GlobalAlertContextType | undefined>(undefined);

export function useGlobalAlert() {
  const context = useContext(GlobalAlertContext);
  if (!context) {
    throw new Error('useGlobalAlert must be used within GlobalAlertProvider');
  }
  return context;
}

interface GlobalAlertProviderProps {
  children: ReactNode;
}

export function GlobalAlertProvider({ children }: GlobalAlertProviderProps) {
  const [alerts, setAlerts] = useState<GlobalAlert[]>([]);

  const addAlert = (alertData: Omit<GlobalAlert, 'id'>): string => {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const alert: GlobalAlert = {
      ...alertData,
      id,
    };

    setAlerts(current => [...current, alert]);

    // Auto-hide if specified
    if (alert.autoHideMs && !alert.persistent) {
      setTimeout(() => {
        removeAlert(id);
      }, alert.autoHideMs);
    }

    return id;
  };

  const removeAlert = (id: string) => {
    setAlerts(current => current.filter(alert => alert.id !== id));
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  const value = {
    alerts,
    addAlert,
    removeAlert,
    clearAlerts,
  };

  return (
    <GlobalAlertContext.Provider value={value}>
      {children}
    </GlobalAlertContext.Provider>
  );
}

// Global Alert Bar Component
interface GlobalAlertBarProps {
  className?: string;
}

export function GlobalAlertBar({ className = '' }: GlobalAlertBarProps) {
  const { alerts, removeAlert } = useGlobalAlert();

  if (alerts.length === 0) return null;

  // Show the highest priority alert (rate_limit > error > warning > info)
  const priorityOrder = { rate_limit: 4, error: 3, warning: 2, info: 1 };
  const activeAlert = alerts.sort((a, b) => priorityOrder[b.type] - priorityOrder[a.type])[0];

  const getAlertStyles = (type: GlobalAlert['type']) => {
    switch (type) {
      case 'rate_limit':
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className={`border-b ${getAlertStyles(activeAlert.type)} ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-sm">{activeAlert.title}</h3>
              <p className="text-sm mt-1 opacity-90">{activeAlert.message}</p>
              {activeAlert.action && (
                <button
                  onClick={activeAlert.action.onClick}
                  className="mt-2 text-sm font-medium underline hover:no-underline"
                >
                  {activeAlert.action.label}
                </button>
              )}
            </div>
          </div>
          {activeAlert.persistent !== false && (
            <button
              onClick={() => removeAlert(activeAlert.id)}
              className="flex-shrink-0 ml-4 p-1 rounded-md hover:bg-black hover:bg-opacity-10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Convenience hooks for specific alert types
export function useRateLimitAlert() {
  const { addAlert } = useGlobalAlert();

  return {
    showRateLimitAlert: (endpoint: string, retryAfterMinutes: number) => {
      const isStoreStatus = endpoint.includes('/business-hours/status');
      const message = isStoreStatus
        ? `Store status updates are temporarily limited. This usually resolves automatically in a few minutes.`
        : `Request limit exceeded. Please wait ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? 's' : ''} before trying again.`;

      return addAlert({
        type: 'rate_limit',
        title: 'Request Limit Exceeded',
        message,
        persistent: true, // Rate limit alerts should be persistent until dismissed
        action: {
          label: 'Refresh Page',
          onClick: () => window.location.reload(),
        },
      });
    },
  };
}
