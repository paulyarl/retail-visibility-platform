'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface ChangeLocationStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  initialStatus: 'pending' | 'active' | 'inactive' | 'closed' | 'archived';
  onStatusChanged?: () => void;
}

interface StatusOption {
  value: 'pending' | 'active' | 'inactive' | 'closed' | 'archived';
  label: string;
  description: string;
  icon: string;
  color: string;
  requiresReason: boolean;
  allowsReopeningDate: boolean;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: 'pending',
    label: 'Pending',
    description: 'Location is being set up',
    icon: '🚧',
    color: 'yellow',
    requiresReason: false,
    allowsReopeningDate: false,
  },
  {
    value: 'active',
    label: 'Active',
    description: 'Fully operational',
    icon: '✅',
    color: 'green',
    requiresReason: false,
    allowsReopeningDate: false,
  },
  {
    value: 'inactive',
    label: 'Temporarily Closed',
    description: 'Seasonal closure or renovations',
    icon: '⏸️',
    color: 'orange',
    requiresReason: false,
    allowsReopeningDate: true,
  },
  {
    value: 'closed',
    label: 'Permanently Closed',
    description: 'No longer operational',
    icon: '🔒',
    color: 'red',
    requiresReason: true,
    allowsReopeningDate: false,
  },
  {
    value: 'archived',
    label: 'Archived',
    description: 'Historical record only',
    icon: '📦',
    color: 'gray',
    requiresReason: true,
    allowsReopeningDate: false,
  },
];

export default function ChangeLocationStatusModal({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  initialStatus,
  onStatusChanged,
}: ChangeLocationStatusModalProps) {
  const [currentStatus, setCurrentStatus] = useState<string>(initialStatus);
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatus);
  const [reason, setReason] = useState('');
  const [reopeningDate, setReopeningDate] = useState('');
  const [impact, setImpact] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Fetch current status from backend when modal opens
  useEffect(() => {
    if (isOpen && tenantId) {
      fetchCurrentStatus();
    }
  }, [isOpen, tenantId]);

  const fetchCurrentStatus = async () => {
    setStatusLoading(true);
    try {
      const response = await api.get(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenants/${tenantId}`);
      if (response.ok) {
        const tenantData = await response.json();
        const backendStatus = tenantData.locationStatus || 'active';
        setCurrentStatus(backendStatus);
        setSelectedStatus(backendStatus); // Reset selected status to current
      } else {
        console.error('Failed to fetch current tenant status');
        setCurrentStatus(initialStatus); // Fallback to prop
        setSelectedStatus(initialStatus);
      }
    } catch (err) {
      console.error('Error fetching current status:', err);
      setCurrentStatus(initialStatus); // Fallback to prop
      setSelectedStatus(initialStatus);
    } finally {
      setStatusLoading(false);
    }
  };

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setReopeningDate('');
      setImpact(null);
      setError(null);
    }
  }, [isOpen]);

  // Fetch impact preview when status changes
  useEffect(() => {
    if (selectedStatus && selectedStatus !== currentStatus) {
      fetchImpactPreview();
    } else {
      setImpact(null);
    }
  }, [selectedStatus]);

  const fetchImpactPreview = async () => {
    setPreviewLoading(true);
    try {
      const response = await api.post(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenants/${tenantId}/status/preview`,
        { status: selectedStatus }
      );
      
      if (response.ok) {
        const data = await response.json();
        setImpact(data);
      }
    } catch (err) {
      console.error('Failed to fetch impact preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const selectedOption = STATUS_OPTIONS.find(opt => opt.value === selectedStatus);
      
      // Validate reason if required
      if (selectedOption?.requiresReason && !reason.trim()) {
        setError('Reason is required for this status change');
        setLoading(false);
        return;
      }

      const response = await api.patch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tenants/${tenantId}/status`,
        {
          status: selectedStatus,
          reason: reason.trim() || undefined,
          reopeningDate: reopeningDate || undefined,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update status');
      }

      // Success!
      onStatusChanged?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update location status');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (statusLoading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedOption = STATUS_OPTIONS.find(opt => opt.value === selectedStatus);
  const allowedTransitions = STATUS_OPTIONS.filter(opt => {
    // Can't transition to current status
    if (opt.value === currentStatus) return false;
    
    // Archived can't transition to anything
    if (currentStatus === 'archived') return false;
    
    // Define allowed transitions
    const transitions: Record<string, string[]> = {
      pending: ['active', 'archived'],
      active: ['inactive', 'closed', 'archived'],
      inactive: ['active', 'closed', 'archived'],
      closed: ['archived'],
    };
    
    return transitions[currentStatus]?.includes(opt.value);
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-2xl w-full p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">
                Change Location Status
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                {tenantName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Status Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                New Status
              </label>
              <div className="space-y-2">
                {allowedTransitions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      selectedStatus === option.value
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="status"
                      value={option.value}
                      checked={selectedStatus === option.value}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="mt-1 mr-3"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{option.icon}</span>
                        <span className="font-medium text-neutral-900 dark:text-white">
                          {option.label}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                        {option.description}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Reason (if required) */}
            {selectedOption?.requiresReason && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-neutral-700 dark:text-white"
                  placeholder="Explain why this status change is being made..."
                  required
                />
              </div>
            )}

            {/* Reopening Date (if allowed) */}
            {selectedOption?.allowsReopeningDate && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                  Expected Reopening Date (Optional)
                </label>
                <input
                  type="date"
                  value={reopeningDate}
                  onChange={(e) => setReopeningDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-neutral-700 dark:text-white"
                />
              </div>
            )}

            {/* Impact Preview */}
            {impact && !previewLoading && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Impact of This Change
                </h3>
                <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                  <div><strong>Storefront:</strong> {impact.impact?.storefront}</div>
                  <div><strong>Directory:</strong> {impact.impact?.directory}</div>
                  <div><strong>Google Sync:</strong> {impact.impact?.googleSync}</div>
                  <div><strong>Billing:</strong> {impact.impact?.billing}</div>
                  <div><strong>Propagation:</strong> {impact.impact?.propagation}</div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || selectedStatus === currentStatus}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
