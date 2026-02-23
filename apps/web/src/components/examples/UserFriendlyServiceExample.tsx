"use client";

import { useState, useEffect } from 'react';
import { squareIntegrationService } from '@/services/SquareIntegrationSingletonService';

/**
 * Example component showing how to use user-friendly service responses
 */
export default function UserFriendlyServiceExample({ tenantId }: { tenantId: string }) {
  const [status, setStatus] = useState<string>('Loading...');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const loadSquareStatus = async () => {
      const squareResult = await squareIntegrationService.getSquareStatus(tenantId);
      setResult(squareResult);
      
      if (squareResult.success && squareResult.data) {
        setStatus(`Connected: ${squareResult.data.status}`);
        setError('');
      } else {
        setStatus('Not connected');
        // Use the user-friendly message from the service
        setError(squareResult.userMessage || 'Unable to connect to Square');
        
        // Optional: Show different messages based on error type
        if (squareResult.error?.status === 404) {
          setError('Square integration not found. Please set up your Square account.');
        } else if (squareResult.error?.status === 401) {
          setError('Authentication expired. Please reconnect your Square account.');
        }
      }
    };

    loadSquareStatus();
  }, [tenantId]);

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold mb-2">Square Integration Status</h3>
      
      {result.success ? (
        <div className="text-green-600">
          ✓ {status}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-red-600">
            ⚠️ {status}
          </div>
          {error && (
            <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
