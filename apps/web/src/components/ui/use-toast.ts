import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ToastProps } from './toast';

type ToastOptions = Omit<ToastProps, 'id' | 'onClose'>;

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const addToast = useCallback(({ message, variant = 'info', duration = 5000 }: ToastOptions) => {
    const id = uuidv4();
    
    setToasts((currentToasts) => [
      ...currentToasts,
      { id, message, variant, duration, onClose: removeToast },
    ]);

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((currentToasts) => 
      currentToasts.filter((toast) => toast.id !== id)
    );
  }, []);

  const toast = useCallback((message: string, options: Omit<ToastOptions, 'message'> = {}) => {
    return addToast({ message, ...options });
  }, [addToast]);

  const success = useCallback((message: string, duration?: number) => {
    return toast(message, { variant: 'success', duration });
  }, [toast]);

  const error = useCallback((message: string, duration?: number) => {
    return toast(message, { variant: 'error', duration });
  }, [toast]);

  const info = useCallback((message: string, duration?: number) => {
    return toast(message, { variant: 'info', duration });
  }, [toast]);

  const warning = useCallback((message: string, duration?: number) => {
    return toast(message, { variant: 'warning', duration });
  }, [toast]);

  return {
    toasts,
    toast,
    success,
    error,
    info,
    warning,
    removeToast,
  };
}

export type { ToastOptions };
