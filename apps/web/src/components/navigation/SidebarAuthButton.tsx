"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface SidebarAuthButtonProps {
  collapsed?: boolean;
}

export function SidebarAuthButton({ collapsed = false }: SidebarAuthButtonProps) {
  const { isAuthenticated, login, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    if (busy) return;
    setBusy(true);
    if (isAuthenticated) {
      logout();
    } else {
      login();
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={handleClick}
        disabled={busy}
        title={isAuthenticated ? 'Logout' : 'Login'}
        aria-label={isAuthenticated ? 'Logout' : 'Login'}
        className={cn(
          'flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors',
          'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700',
          'dark:hover:bg-neutral-800 dark:hover:text-neutral-200',
          busy && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isAuthenticated ? <LogoutIcon /> : <LoginIcon />}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors',
        isAuthenticated
          ? 'text-neutral-600 hover:bg-red-50 hover:text-red-600 dark:text-neutral-300 dark:hover:bg-red-900/20 dark:hover:text-red-400'
          : 'text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20',
        busy && 'opacity-50 cursor-not-allowed'
      )}
    >
      {isAuthenticated ? <LogoutIcon /> : <LoginIcon />}
      <span>{isAuthenticated ? 'Logout' : 'Login'}</span>
    </button>
  );
}

function LoginIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
