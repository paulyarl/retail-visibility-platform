import React from 'react';

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'outline' | 'destructive';
  children: React.ReactNode;
  className?: string;
}

export function Badge({
  variant = 'default',
  children,
  className = '',
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
  
  const variantStyles = {
    default: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    info: 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100',
    secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    outline: 'border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300',
    destructive: 'bg-red-500 text-white',
  };
  
  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  );
}
