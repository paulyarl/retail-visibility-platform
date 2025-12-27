/**
 * Rate limit error handler - provides user-friendly notifications
 * for HTTP 429 responses with guidance on how to proceed
 */

import { useToast } from '@/components/ui/use-toast';

interface RateLimitError {
  error: string;
  message: string;
  retryAfter?: number;
}

export function useRateLimitErrorHandler() {
  const { error, warning, info } = useToast();

  const handleRateLimitError = (response: Response, endpoint: string) => {
    // Only handle 429 status codes
    if (response.status !== 429) return false;

    try {
      // Try to parse the error response
      response.json().then((errorData: RateLimitError) => {
        const retryAfter = errorData.retryAfter || 900; // Default 15 minutes if not provided
        const retryMinutes = Math.ceil(retryAfter / 60);

        // Determine the type of rate limit based on endpoint or error message
        const isStoreStatus = endpoint.includes('/business-hours/status');
        const isSearch = endpoint.includes('/search') || endpoint.includes('/directory');
        const isAuth = endpoint.includes('/auth') || endpoint.includes('/login');
        const isUpload = endpoint.includes('/upload');

        let userMessage = '';
        let suggestion = '';

        if (isStoreStatus) {
          userMessage = `Store status updates are temporarily limited.`;
          suggestion = `This usually resolves automatically in a few minutes. Please wait before refreshing the page.`;
        } else if (isSearch) {
          userMessage = `Search requests are temporarily limited.`;
          suggestion = `Please wait ${retryMinutes} minute${retryMinutes > 1 ? 's' : ''} before searching again.`;
        } else if (isAuth) {
          userMessage = `Login attempts are temporarily limited for security.`;
          suggestion = `Please wait ${retryMinutes} minute${retryMinutes > 1 ? 's' : ''} before trying again.`;
        } else if (isUpload) {
          userMessage = `File uploads are temporarily limited.`;
          suggestion = `Please wait ${retryMinutes} minute${retryMinutes > 1 ? 's' : ''} before uploading again.`;
        } else {
          userMessage = `Too many requests from your device.`;
          suggestion = `Please wait ${retryMinutes} minute${retryMinutes > 1 ? 's' : ''} before trying again.`;
        }

        // Show user-friendly error notification
        error(`${userMessage} ${suggestion}`, 8000); // Show for 8 seconds

        console.warn('[RateLimit]', {
          endpoint,
          retryAfter,
          error: errorData.error,
          message: errorData.message
        });

      }).catch(() => {
        // Fallback for unparseable error response
        error(`Request limit exceeded. Please wait a few minutes before trying again.`, 8000);
      });

      return true; // Handled
    } catch (err) {
      console.error('[RateLimit] Error handling rate limit response:', err);
      return false; // Not handled
    }
  };

  return { handleRateLimitError };
}
