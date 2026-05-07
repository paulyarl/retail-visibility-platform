/**
 * Error Message Component
 * Displays error messages with retry functionality
 */

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorMessageProps {
  title: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({ title, message, onRetry, className }: ErrorMessageProps) {
  return (
    <Card className={cn('border-red-200 bg-red-50', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-red-700">{message}</p>
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
