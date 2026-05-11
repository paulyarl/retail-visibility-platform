/**
 * Customer Authentication Context
 * 
 * React context for customer account state management:
 * - Authentication status
 * - Customer profile
 * - Login/logout/register functions
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import customerAuthService, { Customer, CustomerAuthResponse } from '@/services/CustomerAuthService';

interface CustomerAuthContextType {
  // State
  customer: Customer | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<CustomerAuthResponse>;
  register: (email: string, password: string, firstName?: string, lastName?: string, phone?: string) => Promise<CustomerAuthResponse>;
  logout: () => Promise<void>;
  oauthLogin: (provider: 'google' | 'facebook' | 'apple', oauthId: string, email: string, firstName?: string, lastName?: string) => Promise<CustomerAuthResponse>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<CustomerAuthResponse>;
  verifyEmail: (token: string) => Promise<{ success: boolean; error?: string }>;
  refreshAuth: () => Promise<boolean>;
  refreshCustomer: () => Promise<void>;
  clearError: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

interface CustomerAuthProviderProps {
  children: ReactNode;
}

export function CustomerAuthProvider({ children }: CustomerAuthProviderProps) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize on mount
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      try {
        const existingCustomer = await customerAuthService.initialize();
        setCustomer(existingCustomer);
      } catch (err) {
        console.error('[CustomerAuthContext] Init error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<CustomerAuthResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await customerAuthService.login(email, password);

      if (result.success && result.customer) {
        setCustomer(result.customer);
      } else {
        setError(result.error || 'Login failed');
      }

      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Login failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    phone?: string
  ): Promise<CustomerAuthResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await customerAuthService.register(email, password, firstName, lastName, phone);

      if (result.success && result.customer) {
        setCustomer(result.customer);
      } else {
        setError(result.error || 'Registration failed');
      }

      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Registration failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await customerAuthService.logout();
      setCustomer(null);
    } catch (err) {
      console.error('[CustomerAuthContext] Logout error:', err);
      setCustomer(null); // Clear anyway
    } finally {
      setIsLoading(false);
    }
  }, []);

  const oauthLogin = useCallback(async (
    provider: 'google' | 'facebook' | 'apple',
    oauthId: string,
    email: string,
    firstName?: string,
    lastName?: string
  ): Promise<CustomerAuthResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await customerAuthService.oauthLogin(provider, oauthId, email, firstName, lastName);

      if (result.success && result.customer) {
        setCustomer(result.customer);
      } else {
        setError(result.error || 'OAuth login failed');
      }

      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'OAuth login failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await customerAuthService.requestPasswordReset(email);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to request reset';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string): Promise<CustomerAuthResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await customerAuthService.resetPassword(token, newPassword);

      if (result.success && result.customer) {
        setCustomer(result.customer);
      } else {
        setError(result.error || 'Password reset failed');
      }

      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Password reset failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyEmail = useCallback(async (token: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await customerAuthService.verifyEmail(token);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Email verification failed';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      const success = await customerAuthService.refreshToken();
      if (success) {
        setCustomer(customerAuthService.getCustomer());
      }
      return success;
    } catch (err) {
      console.error('[CustomerAuthContext] Refresh error:', err);
      return false;
    }
  }, []);

  const refreshCustomer = useCallback(async () => {
    try {
      const existingCustomer = await customerAuthService.initialize();
      if (existingCustomer) {
        setCustomer(existingCustomer);
      }
    } catch (err) {
      console.error('[CustomerAuthContext] Refresh customer error:', err);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: CustomerAuthContextType = {
    customer,
    isAuthenticated: !!customer,
    isLoading,
    error,
    login,
    register,
    logout,
    oauthLogin,
    requestPasswordReset,
    resetPassword,
    verifyEmail,
    refreshAuth,
    refreshCustomer,
    clearError,
  };

  return (
    <CustomerAuthContext.Provider value={value}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth(): CustomerAuthContextType {
  const context = useContext(CustomerAuthContext);
  if (context === undefined) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}

export default CustomerAuthContext;
